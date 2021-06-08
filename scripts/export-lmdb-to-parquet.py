import io
import sys
import os.path
import datetime
import argparse
import ipaddress
import lmdb
import nanolib
import json
import math
import decimal
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

from nanodb import Nanodb
from kaitaistruct import KaitaiStream


def get_state_block(block):
    if block.sideband.height == 1 and block.sideband.is_receive:
        subtype = 1  # open
    elif block.sideband.is_receive:
        subtype = 2  # receive
    elif block.sideband.is_send:
        subtype = 3  # send
    elif block.sideband.is_epoch:
        subtype = 5  # epoch
    else:
        subtype = 4  # change

    return {
        "height": block.sideband.height,
        "local_timestamp": int(
            datetime.datetime.utcfromtimestamp(block.sideband.timestamp).strftime("%s")
        ),
        "subtype": subtype,
    }


def get_legacy_block(block):
    return {
        "height": getattr(block.sideband, "height", 1),
        "local_timestamp": int(
            datetime.datetime.utcfromtimestamp(block.sideband.timestamp).strftime("%s")
        ),
        "subtype": None,
    }


# Parse arguments
parser = argparse.ArgumentParser()
parser.add_argument(
    "--filename",
    type=str,
    help="Path to the data.ldb file (not directory). If omitted, data.ldb is assumed to be in the current directory",
)
parser.add_argument(
    "--table",
    type=str,
    default="all",
    help="Name of table to dump, or all to dump all tables.",
)
parser.add_argument(
    "--count",
    type=int,
    default=math.inf,
    help="Number of entries to display from the table(s)",
)
parser.add_argument(
    "--key",
    type=str,
    help="Start iterating at this exact key. This must be a byte array in hex representation.",
)
args = parser.parse_args()

try:
    # Override database filename
    filename = "data.ldb"
    if args.filename:
        filename = args.filename
    if not os.path.isfile(filename):
        raise Exception("Database doesn't exist")

    env = lmdb.open(filename, subdir=False, max_dbs=100)

    pqwriter = None
    # Accounts table
    if args.table == "all" or args.table == "accounts":
        print("Importing Accounts")
        accounts_db = env.open_db("accounts".encode())
        confirmation_db = env.open_db("confirmation_height".encode())

        count = 0
        batch_size = 100000
        data_accounts = []

        fields = [
            pa.field("balance", pa.decimal128(39, 0)),
            pa.field("account", pa.string()),
            pa.field("frontier", pa.string()),
            pa.field("open_block", pa.string()),
            pa.field("representative_block", pa.string()),
            pa.field("modified_timestamp", pa.int64()),
            pa.field("block_count", pa.int64()),
            pa.field("confirmation_height", pa.int64()),
            pa.field("confirmation_height_frontier", pa.string()),
        ]
        schema = pa.schema(fields)
        pqwriter = pq.ParquetWriter("accounts.parquet", schema)

        with env.begin() as txn:
            cursor = txn.cursor(accounts_db)
            if args.key:
                cursor.set_key(bytearray.fromhex(args.key))

            for key, value in cursor:

                keystream = KaitaiStream(io.BytesIO(key))
                valstream = KaitaiStream(io.BytesIO(value))

                account_key = Nanodb.AccountsKey(keystream)
                account_info = Nanodb.AccountsValue(valstream)

                print(
                    "count: {}, account {}".format(
                        count, account_key.account.hex().upper()
                    ),
                    end="\r",
                )

                try:
                    confirmation_value = txn.get(
                        account_key.account, default=None, db=confirmation_db
                    )
                    confirmation_valstream = KaitaiStream(
                        io.BytesIO(confirmation_value)
                    )
                    height_info = Nanodb.ConfirmationHeightValue(
                        confirmation_valstream, None, Nanodb(None)
                    )
                    height = height_info.height
                    height_frontier = height_info.frontier.hex().upper()
                except Exception as ex:
                    print(ex)
                    height = 0
                    height_frontier = None

                data_account = {}
                balance = nanolib.blocks.parse_hex_balance(
                    account_info.balance.hex().upper()
                )

                data_account["balance"] = decimal.Decimal(balance)
                data_account["account"] = nanolib.accounts.get_account_id(
                    prefix=nanolib.AccountIDPrefix.NANO,
                    public_key=account_key.account.hex(),
                )

                data_account["frontier"] = account_info.head.hex().upper()
                data_account["open_block"] = account_info.open_block.hex().upper()
                # TODO
                data_account["representative_block"] = None
                data_account["modified_timestamp"] = datetime.datetime.utcfromtimestamp(
                    account_info.modified
                ).strftime("%s")

                data_account["block_count"] = account_info.block_count
                data_account["confirmation_height"] = height
                data_account["confirmation_height_frontier"] = height_frontier

                data_accounts.append(data_account)

                if len(data_accounts) == batch_size:
                    df_raw = pd.DataFrame(data_accounts)
                    df_raw = df_raw.astype({"modified_timestamp": int})
                    table = pa.Table.from_pandas(
                        df_raw, schema=schema, preserve_index=False
                    )
                    pqwriter.write_table(table)
                    data_accounts = []

                count += 1
                if count >= args.count:
                    df_raw = pd.DataFrame(data_accounts)
                    df_raw = df_raw.astype({"modified_timestamp": int})
                    table = pa.Table.from_pandas(
                        df_raw, schema=schema, preserve_index=False
                    )
                    pqwriter.write_table(table)
                    break

            cursor.close()
        if count == 0:
            print("(empty)\n")

    # blocks table
    if args.table == "all" or args.table == "blocks":
        print("Importing State Blocks")
        blocks_db = env.open_db("blocks".encode())
        confirmation_db = env.open_db("confirmation_height".encode())

        with env.begin() as txn:
            cursor = txn.cursor(blocks_db)
            if args.key:
                cursor.set_key(bytearray.fromhex(args.key))

            count = 0
            index = 0
            append = False
            batch_size = 100000
            data_blocks = []

            fields = [
                pa.field("height", pa.int64()),
                pa.field("local_timestamp", pa.int64()),
                pa.field("subtype", pa.int8()),
                pa.field("type", pa.int8()),
                pa.field("hash", pa.string()),
                pa.field("balance", pa.decimal128(39, 0)),
                pa.field("account", pa.string()),
                pa.field("previous", pa.string()),
                pa.field("representative", pa.string()),
                pa.field("link", pa.string()),
                pa.field("link_as_account", pa.string()),
                pa.field("signature", pa.string()),
                pa.field("work", pa.string()),
                pa.field("amount", pa.decimal128(39, 0)),
                pa.field("confirmed", pa.bool_()),
            ]
            schema = pa.schema(fields)
            pqwriter = pq.ParquetWriter("blocks.parquet", schema)

            for key, value in cursor:
                keystream = KaitaiStream(io.BytesIO(key))
                valstream = KaitaiStream(io.BytesIO(value))

                try:
                    block_key = Nanodb.BlocksKey(keystream)
                    block = Nanodb.BlocksValue(valstream, None, Nanodb(None))
                except Exception as ex:
                    print(ex)
                    continue

                print(
                    "count: {}, hash {}".format(count, block_key.hash.hex().upper()),
                    end="\r",
                )

                btype = block.block_type

                if btype == Nanodb.EnumBlocktype.change:
                    data_block = get_legacy_block(block.block_value)
                    data_block["type"] = 5
                elif btype == Nanodb.EnumBlocktype.send:
                    data_block = get_legacy_block(block.block_value)
                    data_block["type"] = 4
                elif btype == Nanodb.EnumBlocktype.receive:
                    data_block = get_legacy_block(block.block_value)
                    data_block["type"] = 3
                elif btype == Nanodb.EnumBlocktype.state:
                    data_block = get_state_block(block.block_value)
                    data_block["type"] = 1
                elif btype == Nanodb.EnumBlocktype.open:
                    data_block = get_legacy_block(block.block_value)
                    data_block["type"] = 2

                data_block["hash"] = block_key.hash.hex().upper()
                if (
                    btype == Nanodb.EnumBlocktype.state
                    or btype == Nanodb.EnumBlocktype.send
                ):
                    balance = nanolib.blocks.parse_hex_balance(
                        block.block_value.block.balance.hex().upper()
                    )
                else:
                    balance = nanolib.blocks.parse_hex_balance(
                        block.block_value.sideband.balance.hex().upper()
                    )

                data_block["balance"] = decimal.Decimal(balance)
                if (
                    btype == Nanodb.EnumBlocktype.send
                    or btype == Nanodb.EnumBlocktype.receive
                    or btype == Nanodb.EnumBlocktype.change
                ):
                    account = block.block_value.sideband.account
                else:
                    account = block.block_value.block.account

                data_block["account"] = nanolib.accounts.get_account_id(
                    prefix=nanolib.AccountIDPrefix.NANO, public_key=account.hex()
                )

                if btype == Nanodb.EnumBlocktype.open:
                    data_block[
                        "previous"
                    ] = "0000000000000000000000000000000000000000000000000000000000000000"
                else:
                    data_block[
                        "previous"
                    ] = block.block_value.block.previous.hex().upper()

                if (
                    btype == Nanodb.EnumBlocktype.receive
                    or btype == Nanodb.EnumBlocktype.send
                ):
                    data_block["representative"] = None
                else:
                    data_block["representative"] = nanolib.accounts.get_account_id(
                        prefix=nanolib.AccountIDPrefix.NANO,
                        public_key=block.block_value.block.representative.hex(),
                    )

                if btype == Nanodb.EnumBlocktype.state:
                    data_block["link"] = block.block_value.block.link.hex().upper()
                    # TODO - Pairing send's block hash (open/receive), 0 (change) or destination public key (send)
                    data_block["link_as_account"] = None
                elif btype == Nanodb.EnumBlocktype.send:
                    data_block[
                        "link"
                    ] = block.block_value.block.destination.hex().upper()
                    data_block["link_as_account"] = nanolib.accounts.get_account_id(
                        prefix=nanolib.AccountIDPrefix.NANO,
                        public_key=block.block_value.block.destination.hex(),
                    )
                elif btype == Nanodb.EnumBlocktype.receive:
                    data_block["link"] = block.block_value.block.source.hex().upper()
                    data_block["link_as_account"] = None
                    # TODO - use source has to get account
                else:
                    data_block["link"] = None
                    data_block["link_as_account"] = None

                data_block[
                    "signature"
                ] = block.block_value.block.signature.hex().upper()
                data_block["work"] = hex(block.block_value.block.work)[2:]

                try:
                    confirmation_value = txn.get(
                        account, default=None, db=confirmation_db
                    )
                    confirmation_valstream = KaitaiStream(
                        io.BytesIO(confirmation_value)
                    )
                    height_info = Nanodb.ConfirmationHeightValue(
                        confirmation_valstream, None, Nanodb(None)
                    )
                    height = height_info.height
                except Exception as ex:
                    print(ex)
                    height = 0

                if data_block["height"] > 1:
                    previous = txn.get(
                        block.block_value.block.previous, default=None, db=blocks_db
                    )
                    previous_valstream = KaitaiStream(io.BytesIO(previous))
                    previous_block = Nanodb.BlocksValue(
                        previous_valstream, None, Nanodb(None)
                    )
                    ptype = previous_block.block_type
                    if (
                        ptype == Nanodb.EnumBlocktype.state
                        or ptype == Nanodb.EnumBlocktype.send
                    ):
                        previous_balance = nanolib.blocks.parse_hex_balance(
                            previous_block.block_value.block.balance.hex().upper()
                        )
                    else:
                        previous_balance = nanolib.blocks.parse_hex_balance(
                            previous_block.block_value.sideband.balance.hex().upper()
                        )
                    data_block["amount"] = decimal.Decimal(
                        abs(previous_balance - balance)
                    )
                else:
                    data_block["amount"] = decimal.Decimal(balance)

                data_block["confirmed"] = (
                    True if height >= data_block["height"] else False
                )

                data_blocks.append(data_block)

                if len(data_blocks) == batch_size:
                    df_raw = pd.DataFrame(data_blocks)
                    table = pa.Table.from_pandas(
                        df_raw, schema=schema, preserve_index=False
                    )
                    pqwriter.write_table(table)
                    data_blocks = []

                count += 1

                if count >= args.count:
                    df_raw = pd.DataFrame(data_blocks)
                    table = pa.Table.from_pandas(
                        df_raw, schema=schema, preserve_index=False
                    )
                    pqwriter.write_table(table)
                    break
            cursor.close()
        if count == 0:
            print("(empty)\n")

    pqwriter.close()
    env.close()
except Exception as ex:
    print(ex)
