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
from nanodb import Nanodb
from kaitaistruct import KaitaiStream
import psycopg2
import multiprocessing
from joblib import Parallel, delayed
import dill as pickle

with open("config.json") as json_data_file:
    config = json.load(json_data_file)

postgresql_config = config["postgresql"]["connection"]

blocks_disable_index = "UPDATE pg_index SET indisready=false WHERE indrelid = (SELECT oid FROM pg_class WHERE relname='blocks');"
blocks_enable_index = "UPDATE pg_index SET indisready=true WHERE indrelid = (SELECT oid FROM pg_class WHERE relname='blocks'); REINDEX TABLE blocks ;"

accounts_disable_index = "UPDATE pg_index SET indisready=false WHERE indrelid = (SELECT oid FROM pg_class WHERE relname='accounts'); "
accounts_enable_index = "UPDATE pg_index SET indisready=true WHERE indrelid = (SELECT oid FROM pg_class WHERE relname='accounts'); REINDEX TABLE accounts ;"


add_block = (
    "INSERT INTO blocks "
    "(hash, amount, balance, height, local_timestamp, confirmed,"
    "type, account, previous, representative, link, link_account, signature,"
    "work, subtype) VALUES (%(hash)s, %(amount)s, %(balance)s, %(height)s,"
    "%(local_timestamp)s, %(confirmed)s, %(type)s, %(account)s, %(previous)s,"
    "%(representative)s, %(link)s, %(link_account)s, %(signature)s, %(work)s,"
    "%(subtype)s)"
    "ON CONFLICT (hash) DO UPDATE SET amount=excluded.amount, balance=excluded.balance, height=excluded.height,"
    "account=excluded.account, previous=excluded.previous, representative=excluded.representative, link=excluded.link,"
    "link_account=excluded.link_account, signature=excluded.signature, work=excluded.work, subtype=excluded.subtype"
)

add_account = (
    "INSERT INTO accounts "
    "(account, frontier, open_block, representative_block, balance, modified_timestamp,"
    "block_count, confirmation_height, confirmation_height_frontier) VALUES (%s, %s, %s, %s,"
    "%s, %s, %s, %s, %s) "
    "ON CONFLICT (account) DO UPDATE SET frontier=excluded.frontier, open_block=excluded.open_block,"
    "representative_block=excluded.representative_block, balance=excluded.balance,"
    "modified_timestamp=excluded.modified_timestamp, block_count=excluded.block_count,"
    "confirmation_height=excluded.confirmation_height,"
    "confirmation_height_frontier=excluded.confirmation_height_frontier"
)


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
        "local_timestamp": datetime.datetime.utcfromtimestamp(
            block.sideband.timestamp
        ).strftime("%s"),
        "subtype": subtype,
    }


def get_legacy_block(block):
    return {
        "height": getattr(block.sideband, "height", 1),
        "local_timestamp": datetime.datetime.utcfromtimestamp(
            block.sideband.timestamp
        ).strftime("%s"),
        "subtype": None,
    }


def disableIndex():
    conn = psycopg2.connect(
        "host={} port={} dbname={} user={} password={}".format(
            postgresql_config["host"],
            postgresql_config["port"],
            postgresql_config["dbname"],
            postgresql_config["user"],
            postgresql_config["password"],
        )
    )
    postgresql_cursor = conn.cursor()
    postgresql_cursor.execute(blocks_disable_index)
    postgresql_cursor.execute(accounts_disable_index)


def enableIndex():
    conn = psycopg2.connect(
        "host={} port={} dbname={} user={} password={}".format(
            postgresql_config["host"],
            postgresql_config["port"],
            postgresql_config["dbname"],
            postgresql_config["user"],
            postgresql_config["password"],
        )
    )
    postgresql_cursor = conn.cursor()
    postgresql_cursor.execute(blocks_enable_index)
    postgresql_cursor.execute(accounts_enable_index)


def processAccounts(data_in):
    # export_counter = 0
    conn = psycopg2.connect(
        "host={} port={} dbname={} user={} password={}".format(
            postgresql_config["host"],
            postgresql_config["port"],
            postgresql_config["dbname"],
            postgresql_config["user"],
            postgresql_config["password"],
        )
    )
    conn.set_session(autocommit=False)
    postgresql_cursor = conn.cursor()
    # postgresql_cursor.execute("SET foreign_key_checks = 0")
    # postgresql_cursor.execute("SET unique_checks = 0")
    for data_account in data_in:
        postgresql_cursor.execute(add_account, data_account)
        # export_counter += 1
        # print("import_count : [{}]".format(export_counter))
    conn.commit()
    conn.close()


def processBlocks(data_in):
    # export_counter = 0
    conn = psycopg2.connect(
        "host={} port={} dbname={} user={} password={}".format(
            postgresql_config["host"],
            postgresql_config["port"],
            postgresql_config["dbname"],
            postgresql_config["user"],
            postgresql_config["password"],
        )
    )
    conn.set_session(autocommit=False)
    postgresql_cursor = conn.cursor()
    # postgresql_cursor.execute("SET foreign_key_checks = 0")
    # postgresql_cursor.execute("SET unique_checks = 0")
    for data_blocks in data_in:
        postgresql_cursor.execute(add_block, data_blocks)
        # export_counter += 1
        # print("import_count : [{}]".format(export_counter))
    conn.commit()
    conn.close()


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

    env = lmdb.open(filename, subdir=False, readonly=True, lock=False, max_dbs=100)
    num_cores = multiprocessing.cpu_count()
    print("Disable Indexes for faster inserts")
    disableIndex()

    # Accounts table
    if args.table == "all" or args.table == "accounts":
        print("Importing Accounts")
        accounts_db = env.open_db("accounts".encode())
        confirmation_db = env.open_db("confirmation_height".encode())
        error_count = 0
        count = 0
        with env.begin() as txn:
            cursor = txn.cursor(accounts_db)
            if args.key:
                cursor.set_key(bytearray.fromhex(args.key))
            mem_cache = []
            tmp = []

            for key, value in cursor:
                try:
                    keystream = KaitaiStream(io.BytesIO(key))
                    valstream = KaitaiStream(io.BytesIO(value))

                    account_key = Nanodb.AccountsKey(keystream)
                    account_info = Nanodb.AccountsValue(valstream)

                    balance = nanolib.blocks.parse_hex_balance(
                        account_info.balance.hex().upper()
                    )

                    confirmation_value = txn.get(
                        account_key.account, default=None, db=confirmation_db
                    )
                    confirmation_valstream = KaitaiStream(
                        io.BytesIO(confirmation_value)
                    )
                    height_info = Nanodb.ConfirmationHeightValue(
                        confirmation_valstream, None, Nanodb(None)
                    )

                    data_account = (
                        # account
                        nanolib.accounts.get_account_id(
                            prefix=nanolib.AccountIDPrefix.NANO,
                            public_key=account_key.account.hex(),
                        ),
                        # frontier
                        account_info.head.hex().upper(),
                        # open_block
                        account_info.open_block.hex().upper(),
                        # representative_block
                        None,
                        # balance
                        balance,
                        # #modified_timestamp
                        datetime.datetime.utcfromtimestamp(
                            account_info.modified
                        ).strftime("%s"),
                        # #block_count
                        account_info.block_count,
                        # #confirmation_height
                        height_info.height,
                        # #confirmation_height_frontier
                        height_info.frontier.hex().upper(),
                    )

                    tmp.append(data_account)
                except Exception as ex:
                    print(ex)
                    error_count += 1
                print(
                    "count: {} acocunts ".format(
                        count  # , account_key.account.hex().upper()
                    ),
                    end="\r",
                )
                count += 1

                if count >= args.count:
                    break
                if count % 10000 == 0:
                    mem_cache.append(tmp)
                    tmp = []
                if count % 500000 == 0:
                    Parallel(n_jobs=num_cores)(
                        delayed(processAccounts)(data_accounts)
                        for data_accounts in mem_cache
                    )
                    mem_cache = []
            cursor.close()

            # add the last batch of accounts to mysql
            mem_cache.append(tmp)
            Parallel(n_jobs=num_cores)(
                delayed(processAccounts)(data_accounts) for data_accounts in mem_cache
            )
            print(
                "exported: [{}] with [{}] error(s), last mysql batch size: [{}]".format(
                    count, error_count, sum(len(x) for x in mem_cache)
                )
            )

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
            error_count = 0
            mem_cache = []
            tmp = []
            for key, value in cursor:
                try:
                    keystream = KaitaiStream(io.BytesIO(key))
                    valstream = KaitaiStream(io.BytesIO(value))

                    try:
                        block_key = Nanodb.BlocksKey(keystream)
                        block = Nanodb.BlocksValue(valstream, None, Nanodb(None))
                    except Exception as ex:
                        print(ex)
                        continue

                    btype = block.block_type

                    if btype == Nanodb.EnumBlocktype.change:
                        data_block = get_legacy_block(block.block_value)
                        data_block["type"] = "5"
                    elif btype == Nanodb.EnumBlocktype.send:
                        data_block = get_legacy_block(block.block_value)
                        data_block["type"] = "4"
                    elif btype == Nanodb.EnumBlocktype.receive:
                        data_block = get_legacy_block(block.block_value)
                        data_block["type"] = "3"
                    elif btype == Nanodb.EnumBlocktype.state:
                        data_block = get_state_block(block.block_value)
                        data_block["type"] = "1"
                    elif btype == Nanodb.EnumBlocktype.open:
                        data_block = get_legacy_block(block.block_value)
                        data_block["type"] = "2"

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

                    data_block["balance"] = balance
                    data_block["confirmed"] = "1"
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
                        data_block["link_account"] = None
                        # TODO
                    elif btype == Nanodb.EnumBlocktype.send:
                        data_block[
                            "link"
                        ] = block.block_value.block.destination.hex().upper()
                        data_block["link_account"] = nanolib.accounts.get_account_id(
                            prefix=nanolib.AccountIDPrefix.NANO,
                            public_key=block.block_value.block.destination.hex(),
                        )
                    elif btype == Nanodb.EnumBlocktype.receive:
                        data_block[
                            "link"
                        ] = block.block_value.block.source.hex().upper()
                        data_block["link_account"] = None
                        # TODO - use source has to get account
                    else:
                        data_block["link"] = None
                        data_block["link_account"] = None

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

                        data_block["amount"] = str(
                            abs(int(previous_balance) - int(balance))
                        )
                    else:
                        data_block["amount"] = balance

                    data_block["confirmed"] = (
                        "1" if height >= data_block["height"] else "0"
                    )

                    tmp.append(data_block)
                except Exception as ex:
                    print(ex)
                    error_count += 1
                print(
                    "count: {} hashes".format(
                        count  # , block_key.hash.hex().upper()),
                    ),
                    end="\r",
                )

                count += 1
                if count >= args.count:
                    break
                if count % 10000 == 0:
                    mem_cache.append(tmp)
                    tmp = []
                if count % 500000 == 0:
                    Parallel(n_jobs=num_cores)(
                        delayed(processBlocks)(data_blocks) for data_blocks in mem_cache
                    )
                    mem_cache = []

            cursor.close()
            mem_cache.append(tmp)
            Parallel(n_jobs=num_cores)(
                delayed(processBlocks)(data_blocks) for data_blocks in mem_cache
            )
            print(
                "exported: [{}] with [{}] error(s), last mysql batch size: [{}]".format(
                    count, error_count, sum(len(x) for x in mem_cache)
                )
            )

        if count == 0:
            print("(empty)\n")

    env.close()
    print("Re-Enable Indexes")
    enableIndex()

    # cnx.close()
except Exception as ex:
    print(ex)
