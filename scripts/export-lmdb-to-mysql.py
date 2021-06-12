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
import multiprocessing
from joblib import Parallel, delayed
import dill as pickle

with open("config.json") as json_data_file:
    config = json.load(json_data_file)

add_block = (
    "INSERT INTO blocks "
    "(hash, amount, balance, height, local_timestamp, confirmed,"
    "type, account, previous, representative, link, link_as_account, signature,"
    "work, subtype) VALUES (%(hash)s, %(amount)s, %(balance)s, %(height)s,"
    "%(local_timestamp)s, %(confirmed)s, %(type)s, %(account)s, %(previous)s,"
    "%(representative)s, %(link)s, %(link_as_account)s, %(signature)s, %(work)s,"
    "%(subtype)s) ON DUPLICATE KEY UPDATE amount=amount, balance=balance, height=height,"
    "account=account, previous=previous, representative=representative, link=link,"
    "link_as_account=link_as_account, signature=signature, work=work, subtype=subtype"
)

add_account = (
    "INSERT INTO accounts "
    "(account, frontier, open_block, representative_block, balance, modified_timestamp,"
    "block_count, confirmation_height, confirmation_height_frontier) VALUES (%s, %s, %s, %s,"
    "%s, %s, %s, %s, %s) ON DUPLICATE KEY UPDATE frontier=frontier, open_block=open_block,"
    "representative_block=representative_block, balance=balance,"
    "modified_timestamp=modified_timestamp, block_count=block_count,"
    "confirmation_height=confirmation_height,"
    "confirmation_height_frontier=confirmation_height_frontier"
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

mysql_config = config["mysql"]["connection"]


def processInput(data_accounts):
    export_counter = 0
    conn = mysql.connector.connect(
            user=mysql_config["user"],
            host=mysql_config["host"],
            password=mysql_config["password"],
            database=mysql_config["database"],
        )
    conn.autocommit = False
    mysql_cursor = conn.cursor()    
    for data_account in data_accounts:   
        mysql_cursor.execute(add_account, data_account) 
        export_counter += 1
        print("import_count : [{}]".format(export_counter))
    conn.commit()        
    conn.close()
    

try:
    # Override database filename
    filename = "data.ldb"
    if args.filename:
        filename = args.filename
    if not os.path.isfile(filename):
        raise Exception("Database doesn't exist")

    env = lmdb.open(filename, subdir=False, max_dbs=100)   

    # Accounts table
    if args.table == "all" or args.table == "accounts":
        print("Importing Accounts")
        accounts_db = env.open_db("accounts".encode())
        confirmation_db = env.open_db("confirmation_height".encode())
        memory_accounts = []
        num_cores = multiprocessing.cpu_count() 

        count = 0
        with env.begin() as txn:
            cursor = txn.cursor(accounts_db)
            if args.key:
                cursor.set_key(bytearray.fromhex(args.key))               
            
            tmp = []
            for key, value in cursor:
                
                keystream = KaitaiStream(io.BytesIO(key))
                valstream = KaitaiStream(io.BytesIO(value))

                account_key = Nanodb.AccountsKey(keystream)
                account_info = Nanodb.AccountsValue(valstream)

                balance = nanolib.blocks.parse_hex_balance(
                    account_info.balance.hex().upper()
                )

                print(
                    "export_count: {}, account {}".format(
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
                
                # tmp.append(data_account) 
                memory_accounts.append(data_account)

                count += 1                                               
                
                if count >= 1000000: #args.count: 
                    break
                # if count % 10000 == 0:                 
                    # memory_accounts.append(tmp)
                    # tmp = []
            
            cursor.close()
        if count == 0:
            print("(empty)\n")
        
        # Parallel(n_jobs=num_cores)(delayed(processInput)(data_accounts) for data_accounts in memory_accounts)      
            
           
            
       

    # blocks table
    if args.table == "all" or args.table == "blocks":
    
        mysql_config = config["mysql"]["connection"]
        cnx = mysql.connector.connect(
            user=mysql_config["user"],
            host=mysql_config["host"],
            password=mysql_config["password"],
            database=mysql_config["database"],
        )
        mysql_cursor = cnx.cursor()    
         
        print("Importing State Blocks")
        blocks_db = env.open_db("blocks".encode())
        confirmation_db = env.open_db("confirmation_height".encode())

        with env.begin() as txn:
            cursor = txn.cursor(blocks_db)
            if args.key:
                cursor.set_key(bytearray.fromhex(args.key))

            count = 0
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
                    data_block["link_as_account"] = nanolib.accounts.get_account_id(
                        prefix=nanolib.AccountIDPrefix.NANO,
                        public_key=block.block_value.block.link.hex(),
                    )
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

                    data_block["amount"] = str(
                        abs(int(previous_balance) - int(balance))
                    )
                else:
                    data_block["amount"] = balance

                data_block["confirmed"] = "1" if height >= data_block["height"] else "0"

                mysql_cursor.execute(add_block, data_block)
                

                count += 1
                if count >= args.count:
                    break
            cnx.commit()
            mysql_cursor.close()
            cursor.close()
        if count == 0:
            print("(empty)\n")

    env.close()
    # cnx.close()
except Exception as ex:
    print(ex)
