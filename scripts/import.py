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
    "%s, %s, %s) ON DUPLICATE KEY UPDATE amount=amount, balance=balance, height=height,"
    "account=account, previous=previous, representative=representative, link=link,"
    "link_as_account=link_as_account, signature=signature, work=work, subtype=subtype"
)

add_account = (
    "INSERT INTO accounts "
    "(account, frontier, open_block, representative_block, balance, modified_timestamp,"
    "block_count, confirmation_height, confirmation_height_frontier) VALUES (%s, %s, %s, %s,"
    "%s, %s, %s, %s, %s) ON DUPLICATE KEY UPDATE frontier=frontier, open_block=open_block,"
    "representative_block=representative_block, balance=balance,"
    "modified_timestamp=modeified_timestamp, block_count=block_count,"
    "confirmation_height=confirmation_height,"
    "confirmation_height_frontier=confirmation_height_frontier"
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

    # Accounts table
    if args.table == "all" or args.table == "accounts":
        print("Importing Accounts")
        accounts_db = env.open_db("accounts".encode())
        confirmation_db = env.open_db("confirmation_height".encode())

        count = 0
        with env.begin() as txn:
            cursor = txn.cursor(accounts_db)
            if args.key:
                cursor.set_key(bytearray.fromhex(args.key))

            for key, value in cursor:

                keystream = KaitaiStream(io.BytesIO(key))
                valstream = KaitaiStream(io.BytesIO(value))

                account_key = Nanodb.AccountsKey(keystream)
                account_info = Nanodb.AccountsValue(valstream)

                balance = nanolib.blocks.parse_hex_balance(
                    account_info.balance.hex().upper()
                )

                print(
                    "count: {}, account {}".format(
                        count, account_key.account.hex().upper()
                    ),
                    end="\r",
                )

                confirmation_value = txn.get(
                    account_key.account, default=None, db=confirmation_db
                )
                confirmation_valstream = KaitaiStream(io.BytesIO(confirmation_value))
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
                    datetime.datetime.utcfromtimestamp(account_info.modified).strftime(
                        "%s"
                    ),
                    # #block_count
                    account_info.block_count,
                    # #confirmation_height
                    height_info.height,
                    # #confirmation_height_frontier
                    height_info.frontier.hex().upper(),
                )

                # mysql_cursor.execute(add_account, data_account)
                # cnx.commit()

                count += 1
                if count >= args.count:
                    break

            cursor.close()
        if count == 0:
            print("(empty)\n")

    # State blocks table
    if args.table == "all" or args.table == "state_blocks":
        print("Importing State Blocks")
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

                if state_block.sideband.height == 1 and state_block.sideband.is_receive:
                    subtype = 1
                elif state_block.sideband.is_receive:
                    subtype = 2
                elif state_block.sideband.is_send:
                    subtype = 3

                data_block = (
                    # hash
                    state_key.hash.hex().upper(),
                    # amount
                    None,
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

    # Send blocks table
    if args.table == "all" or args.table == "send":
        print("Importing Send Blocks")
        send_db = env.open_db("send".encode())

        with env.begin() as txn:
            cursor = txn.cursor(send_db)
            if args.key:
                cursor.set_key(bytearray.fromhex(args.key))

            count = 0
            for key, value in cursor:
                keystream = KaitaiStream(io.BytesIO(key))
                valstream = KaitaiStream(io.BytesIO(value))
                try:
                    send_key = Nanodb.SendKey(keystream)
                    send_block = Nanodb.SendValue(valstream, None, Nanodb(None))
                except Exception as ex:
                    print(ex)
                    continue

                print(
                    "count: {}, hash {}".format(count, send_key.hash.hex().upper()),
                    end="\r",
                )

                data_block = (
                    # hash
                    send_key.hash.hex().upper(),
                    # amount
                    None,
                    # balance
                    nanolib.blocks.parse_hex_balance(
                        send_block.block.balance.hex().upper()
                    ),
                    # height
                    send_block.sideband.height,
                    # local_timestamp
                    datetime.datetime.utcfromtimestamp(
                        send_block.sideband.timestamp
                    ).strftime("%s"),
                    # confirmed
                    "1",
                    # type
                    "4",
                    # account
                    nanolib.accounts.get_account_id(
                        prefix=nanolib.AccountIDPrefix.NANO,
                        public_key=send_block.sideband.account.hex(),
                    ),
                    # previous
                    send_block.block.previous.hex().upper(),
                    # representative
                    None,
                    # link
                    None,
                    # link_as_account,
                    None,
                    # signature
                    send_block.block.signature.hex().upper(),
                    # work
                    hex(send_block.block.work)[2:],
                    # subtype
                    None,
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

    # Receive blocks table
    if args.table == "all" or args.table == "receive":
        print("Importing Receive Blocks")
        receive_db = env.open_db("receive".encode())

        with env.begin() as txn:
            cursor = txn.cursor(receive_db)
            if args.key:
                cursor.set_key(bytearray.fromhex(args.key))

            count = 0
            for key, value in cursor:
                keystream = KaitaiStream(io.BytesIO(key))
                valstream = KaitaiStream(io.BytesIO(value))
                try:
                    receive_key = Nanodb.ReceiveKey(keystream)
                    receive_block = Nanodb.ReceiveValue(valstream, None, Nanodb(None))
                except Exception as ex:
                    print(ex)
                    continue

                print(
                    "count: {}, hash {}".format(count, receive_key.hash.hex().upper()),
                    end="\r",
                )

                data_block = (
                    # hash
                    receive_key.hash.hex().upper(),
                    # amount
                    None,
                    # balance
                    nanolib.blocks.parse_hex_balance(
                        receive_block.sideband.balance.hex().upper()
                    ),
                    # height
                    receive_block.sideband.height,
                    # local_timestamp
                    datetime.datetime.utcfromtimestamp(
                        receive_block.sideband.timestamp
                    ).strftime("%s"),
                    # confirmed
                    "1",
                    # type
                    "3",
                    # account
                    nanolib.accounts.get_account_id(
                        prefix=nanolib.AccountIDPrefix.NANO,
                        public_key=receive_block.sideband.account.hex(),
                    ),
                    # previous
                    receive_block.block.previous.hex().upper(),
                    # representative
                    None,
                    # link
                    None,
                    # link_as_account,
                    None,
                    # signature
                    receive_block.block.signature.hex().upper(),
                    # work
                    hex(receive_block.block.work)[2:],
                    # subtype
                    None,
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

    # Open blocks table
    if args.table == "all" or args.table == "open":
        print("Importing Open Blocks")
        open_db = env.open_db("open".encode())

        with env.begin() as txn:
            cursor = txn.cursor(open_db)
            if args.key:
                cursor.set_key(bytearray.fromhex(args.key))

            count = 0
            for key, value in cursor:
                keystream = KaitaiStream(io.BytesIO(key))
                valstream = KaitaiStream(io.BytesIO(value))
                try:
                    open_key = Nanodb.OpenKey(keystream)
                    open_block = Nanodb.OpenValue(valstream, None, Nanodb(None))
                except Exception as ex:
                    print(ex)
                    continue

                print(
                    "count: {}, hash {}".format(count, open_key.hash.hex().upper()),
                    end="\r",
                )

                data_block = (
                    # hash
                    open_key.hash.hex().upper(),
                    # amount
                    None,
                    # balance
                    nanolib.blocks.parse_hex_balance(
                        open_block.sideband.balance.hex().upper()
                    ),
                    # height
                    "1",
                    # local_timestamp
                    datetime.datetime.utcfromtimestamp(
                        open_block.sideband.timestamp
                    ).strftime("%s"),
                    # confirmed
                    "1",
                    # type
                    "2",
                    # account
                    nanolib.accounts.get_account_id(
                        prefix=nanolib.AccountIDPrefix.NANO,
                        public_key=open_block.block.account.hex(),
                    ),
                    # previous
                    "0000000000000000000000000000000000000000000000000000000000000000",
                    # representative
                    nanolib.accounts.get_account_id(
                        prefix=nanolib.AccountIDPrefix.NANO,
                        public_key=open_block.block.representative.hex(),
                    ),
                    # link
                    None,
                    # link_as_account,
                    None,
                    # signature
                    open_block.block.signature.hex().upper(),
                    # work
                    hex(open_block.block.work)[2:],
                    # subtype
                    None,
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

    # Change blocks table
    if args.table == "all" or args.table == "change":
        print("Importing Change Blocks")
        change_db = env.open_db("change".encode())

        with env.begin() as txn:
            cursor = txn.cursor(change_db)
            if args.key:
                cursor.set_key(bytearray.fromhex(args.key))

            count = 0
            for key, value in cursor:
                keystream = KaitaiStream(io.BytesIO(key))
                valstream = KaitaiStream(io.BytesIO(value))
                try:
                    change_key = Nanodb.ChangeKey(keystream)
                    change_block = Nanodb.ChangeValue(valstream, None, Nanodb(None))
                except Exception as ex:
                    print(ex)
                    continue

                print(
                    "count: {}, hash {}".format(count, change_key.hash.hex().upper()),
                    end="\r",
                )

                data_block = (
                    # hash
                    change_key.hash.hex().upper(),
                    # amount
                    None,
                    # balance
                    nanolib.blocks.parse_hex_balance(
                        change_block.sideband.balance.hex().upper()
                    ),
                    # height
                    "1",
                    # local_timestamp
                    datetime.datetime.utcfromtimestamp(
                        change_block.sideband.timestamp
                    ).strftime("%s"),
                    # confirmed
                    "1",
                    # type
                    "5",
                    # account
                    nanolib.accounts.get_account_id(
                        prefix=nanolib.AccountIDPrefix.NANO,
                        public_key=change_block.sideband.account.hex(),
                    ),
                    # previous
                    change_block.block.previous.hex().upper(),
                    # representative
                    nanolib.accounts.get_account_id(
                        prefix=nanolib.AccountIDPrefix.NANO,
                        public_key=change_block.block.representative.hex(),
                    ),
                    # link
                    None,
                    # link_as_account,
                    None,
                    # signature
                    change_block.block.signature.hex().upper(),
                    # work
                    hex(change_block.block.work)[2:],
                    # subtype
                    None,
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
