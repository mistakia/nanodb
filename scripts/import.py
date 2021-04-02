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
import mysql.connector

with open("config.json") as json_data_file:
    config = json.load(json_data_file)

add_block = (
    "INSERT INTO blocks "
    "(hash, amount, balance, height, local_timestamp, confirmed,"
    "type, account, previous, representative, link, link_as_account, signature,"
    "work, subtype) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,"
    "%s, %s, %s) ON DUPLICATE KEY UPDATE amount=amount, balance=balance, height=height, account=account, previous=previous, representative=representative, link=link, link_as_account=link_as_account, signature=signature, work=work, subtype=subtype"
)

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

    mysql_config = config["mysql"]["connection"]
    cnx = mysql.connector.connect(
        user=mysql_config["user"],
        host=mysql_config["host"],
        database=mysql_config["database"],
    )
    mysql_cursor = cnx.cursor()

    # State blocks table
    if args.table == "all" or args.table == "state_blocks":
        state_db = env.open_db("state_blocks".encode())

        with env.begin() as txn:
            cursor = txn.cursor(state_db)
            if args.key:
                cursor.set_key(bytearray.fromhex(args.key))

            count = 0
            for key, value in cursor:
                keystream = KaitaiStream(io.BytesIO(key))
                valstream = KaitaiStream(io.BytesIO(value))
                try:
                    state_key = Nanodb.StateBlocksKey(keystream)
                    state_block = Nanodb.StateBlocksValue(valstream, None, Nanodb(None))
                except Exception as ex:
                    print(ex)
                    continue

                print(
                    "count: {}, hash {}".format(count, state_key.hash.hex().upper()),
                    end="\r",
                )

                if state_block.sideband.height == 0 and state_block.sideband.is_receive:
                    subtype = 1
                elif state_block.sideband.is_receive:
                    subtype = 2
                elif state_block.sideband.is_send:
                    subtype = 3

                data_block = (
                    # hash
                    state_key.hash.hex().upper(),
                    # amount
                    "",
                    # balance
                    nanolib.blocks.parse_hex_balance(
                        state_block.block.balance.hex().upper()
                    ),
                    # height
                    state_block.sideband.height,
                    # local_timestamp
                    datetime.datetime.utcfromtimestamp(
                        state_block.sideband.timestamp
                    ).strftime("%s"),
                    # confirmed
                    "0",
                    # type
                    "1",
                    # account
                    nanolib.accounts.get_account_id(
                        prefix=nanolib.AccountIDPrefix.NANO,
                        public_key=state_block.block.account.hex(),
                    ),
                    # previous
                    state_block.block.previous.hex().upper(),
                    # representative
                    nanolib.accounts.get_account_id(
                        prefix=nanolib.AccountIDPrefix.NANO,
                        public_key=state_block.block.representative.hex(),
                    ),
                    # link
                    state_block.block.link.hex().upper(),
                    # link_as_account
                    nanolib.accounts.get_account_id(
                        prefix=nanolib.AccountIDPrefix.NANO,
                        public_key=state_block.block.link.hex(),
                    ),
                    # signature
                    state_block.block.signature.hex().upper(),
                    # work
                    hex(state_block.block.work)[2:],
                    # subtype
                    subtype,
                )

                mysql_cursor.execute(add_block, data_block)
                cnx.commit()

                count += 1
                if count >= args.count:
                    break
            mysql_cursor.close()
            cursor.close()
        if count == 0:
            print("(empty)\n")

    env.close()
    cnx.close()
except Exception as ex:
    print(ex)
