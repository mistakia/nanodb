import io
import sys
import os.path
import datetime
import argparse
import ipaddress
import lmdb
import nanolib
from nanodb import Nanodb
from kaitaistruct import KaitaiStream


def print_state_block(block, level, sideband=None):
    print(
        "{}account         : {}".format(
            " " * level,
            nanolib.accounts.get_account_id(
                prefix=nanolib.AccountIDPrefix.NANO, public_key=block.account.hex()
            ),
        )
    )
    print(
        "{}representative  : {}".format(
            " " * level,
            nanolib.accounts.get_account_id(
                prefix=nanolib.AccountIDPrefix.NANO,
                public_key=block.representative.hex(),
            ),
        )
    )
    print("{}previous        : {}".format(" " * level, block.previous.hex().upper()))
    print(
        "{}balance         : {}".format(
            " " * level, nanolib.blocks.parse_hex_balance(block.balance.hex().upper())
        )
    )
    print("{}link            : {}".format(" " * level, block.link.hex().upper()))
    print(
        "{}link as account : {}".format(
            " " * level,
            nanolib.accounts.get_account_id(
                prefix=nanolib.AccountIDPrefix.NANO, public_key=block.link.hex()
            ),
        )
    )
    print("{}signature       : {}".format(" " * level, block.signature.hex().upper()))
    print("{}work            : {}".format(" " * level, hex(block.work)))
    if sideband:
        print("  sideband:")
        print("    successor     : {}".format(sideband.successor.hex().upper()))
        print("    height        : {}".format(sideband.height))
        print(
            "    timestamp     : {}".format(
                datetime.datetime.utcfromtimestamp(sideband.timestamp)
            )
        )
        print("    is_send       : {}".format(sideband.is_send))
        print("    is_receive    : {}".format(sideband.is_receive))
        print("    is_epoch      : {}".format(sideband.is_epoch))
        print("    epoch         : {}".format(sideband.epoch.name))


def print_send_block(block, level, sideband=None):
    print("{}previous        : {}".format(" " * level, block.previous.hex().upper()))
    print(
        "{}destination     : {}".format(
            " " * level,
            nanolib.accounts.get_account_id(
                prefix=nanolib.AccountIDPrefix.NANO, public_key=block.destination.hex()
            ),
        )
    )
    print(
        "{}balance         : {}".format(
            " " * level, nanolib.blocks.parse_hex_balance(block.balance.hex().upper())
        )
    )
    print("{}signature       : {}".format(" " * level, block.signature.hex().upper()))
    print("{}work            : {}".format(" " * level, hex(block.work)))

    if sideband:
        print("  sideband:")
        print("    successor     : {}".format(sideband.successor.hex().upper()))
        print(
            "    account       : {}".format(
                nanolib.accounts.get_account_id(
                    prefix=nanolib.AccountIDPrefix.NANO,
                    public_key=sideband.account.hex(),
                )
            )
        )
        print("    height        : {}".format(sideband.height))
        print(
            "    timestamp     : {}".format(
                datetime.datetime.utcfromtimestamp(sideband.timestamp)
            )
        )


def print_receive_block(block, level, sideband=None):
    print("{}previous        : {}".format(" " * level, block.previous.hex().upper()))
    print("{}source hash     : {}".format(" " * level, block.source.hex().upper()))
    print("{}signature       : {}".format(" " * level, block.signature.hex().upper()))
    print("{}work            : {}".format(" " * level, hex(block.work)))

    if sideband:
        print("  sideband:")
        print("    successor     : {}".format(sideband.successor.hex().upper()))
        print(
            "    account       : {}".format(
                nanolib.accounts.get_account_id(
                    prefix=nanolib.AccountIDPrefix.NANO,
                    public_key=sideband.account.hex(),
                )
            )
        )
        print("    height        : {}".format(sideband.height))
        print(
            "    balance       : {}".format(
                nanolib.blocks.parse_hex_balance(sideband.balance.hex().upper())
            )
        )
        print(
            "    timestamp     : {}".format(
                datetime.datetime.utcfromtimestamp(sideband.timestamp)
            )
        )


def print_open_block(block, level, sideband=None):
    print(
        "{}account         : {}".format(
            " " * level,
            nanolib.accounts.get_account_id(
                prefix=nanolib.AccountIDPrefix.NANO, public_key=block.account.hex()
            ),
        )
    )
    print("{}source hash     : {}".format(" " * level, block.source.hex().upper()))
    print(
        "{}representative  : {}".format(
            " " * level,
            nanolib.accounts.get_account_id(
                prefix=nanolib.AccountIDPrefix.NANO,
                public_key=block.representative.hex(),
            ),
        )
    )
    print("{}signature       : {}".format(" " * level, block.signature.hex().upper()))
    print("{}work            : {}".format(" " * level, hex(block.work)))

    if sideband:
        print("  sideband:")
        print("    successor     : {}".format(sideband.successor.hex().upper()))
        print(
            "    balance       : {}".format(
                nanolib.blocks.parse_hex_balance(sideband.balance.hex().upper())
            )
        )
        print(
            "    timestamp     : {}".format(
                datetime.datetime.utcfromtimestamp(sideband.timestamp)
            )
        )


def print_change_block(block, level, sideband=None):
    print("{}previous        : {}".format(" " * level, block.previous.hex().upper()))
    print(
        "{}representative  : {}".format(
            " " * level,
            nanolib.accounts.get_account_id(
                prefix=nanolib.AccountIDPrefix.NANO,
                public_key=block.representative.hex(),
            ),
        )
    )
    print("{}signature       : {}".format(" " * level, block.signature.hex().upper()))
    print("{}work            : {}".format(" " * level, hex(block.work)))

    if sideband:
        print("  sideband:")
        print("    successor     : {}".format(sideband.successor.hex().upper()))
        print(
            "    account       : {}".format(
                nanolib.accounts.get_account_id(
                    prefix=nanolib.AccountIDPrefix.NANO,
                    public_key=sideband.account.hex(),
                )
            )
        )
        print("    height        : {}".format(sideband.height))
        print(
            "    balance       : {}".format(
                nanolib.blocks.parse_hex_balance(sideband.balance.hex().upper())
            )
        )
        print(
            "    timestamp     : {}".format(
                datetime.datetime.utcfromtimestamp(sideband.timestamp)
            )
        )


def print_header(header):
    print(header)
    print("-" * len(header))


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
    default=10,
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

    # Accounts table
    # Print details about the first N accounts with balance
    if args.table == "all" or args.table == "accounts":
        print_header("accounts")
        accounts_db = env.open_db("accounts".encode())

        count = 0
        with env.begin() as txn:
            cursor = txn.cursor(accounts_db)
            for key, value in cursor:

                keystream = KaitaiStream(io.BytesIO(key))
                valstream = KaitaiStream(io.BytesIO(value))

                account_key = Nanodb.AccountsKey(keystream)
                account_info = Nanodb.AccountsValue(valstream)

                balance = nanolib.blocks.parse_hex_balance(
                    account_info.balance.hex().upper()
                )

                if balance > 0:
                    print(
                        "account          : {}".format(
                            nanolib.accounts.get_account_id(
                                prefix=nanolib.AccountIDPrefix.NANO,
                                public_key=account_key.account.hex(),
                            )
                        )
                    )
                    print(
                        "  head block     : {}".format(account_info.head.hex().upper())
                    )
                    print(
                        "  open block     : {}".format(
                            account_info.open_block.hex().upper()
                        )
                    )
                    print("  balance        : {}".format(balance))
                    print("  block count    : {}".format(account_info.block_count))
                    print(
                        "  last modified  : {}".format(
                            datetime.datetime.utcfromtimestamp(account_info.modified)
                        )
                    )
                    print(
                        "  representative : {}".format(
                            nanolib.accounts.get_account_id(
                                prefix=nanolib.AccountIDPrefix.NANO,
                                public_key=account_info.representative.hex(),
                            )
                        )
                    )
                    print("")

                    count += 1
                    if count >= args.count:
                        break
            cursor.close()
        if count == 0:
            print("(empty)\n")

    # Blocks table
    if args.table == "all" or args.table == "blocks":
        print_header("blocks")
        state_db = env.open_db("blocks".encode())

        count = 0
        with env.begin() as txn:
            cursor = txn.cursor(state_db)
            if args.key:
                cursor.set_key(bytearray.fromhex(args.key))
            count = 0
            for key, value in cursor:
                keystream = KaitaiStream(io.BytesIO(key))
                valstream = KaitaiStream(io.BytesIO(value))
                bkey = Nanodb.BlocksKey(keystream)
                bvalue = Nanodb.BlocksValue(valstream, None, Nanodb(None))
                btype = bvalue.block_type

                print("hash              : {}".format(bkey.hash.hex().upper()))

                block = bvalue.block_value.block
                sideband = bvalue.block_value.sideband
                if btype == Nanodb.EnumBlocktype.change:
                    print("type              : change")
                    print_change_block(block, 2, sideband)
                elif btype == Nanodb.EnumBlocktype.send:
                    print("type              : send")
                    print_send_block(block, 2, sideband)
                elif btype == Nanodb.EnumBlocktype.receive:
                    print("type              : receive")
                    print_receive_block(block, 2, sideband)
                elif btype == Nanodb.EnumBlocktype.state:
                    print("type              : state")
                    print_state_block(block, 2, sideband)
                elif btype == Nanodb.EnumBlocktype.open:
                    print("type              : open")
                    print_open_block(block, 2, sideband)

                print("")

                count += 1
                if count >= args.count:
                    break
            cursor.close()
        if count == 0:
            print("(empty)\n")

    # Vote table
    if args.table == "all" or args.table == "vote":
        print_header("vote")
        vote_db = env.open_db("vote".encode())

        count = 0
        with env.begin() as txn:
            cursor = txn.cursor(vote_db)
            count = 0
            for key, value in cursor:

                keystream = KaitaiStream(io.BytesIO(key))
                valstream = KaitaiStream(io.BytesIO(value))
                vote_key = Nanodb.VoteKey(keystream)
                vote_info = Nanodb.VoteValue(valstream, None, Nanodb(None))

                print(
                    "vote account      : {}".format(
                        nanolib.accounts.get_account_id(
                            prefix=nanolib.AccountIDPrefix.NANO,
                            public_key=vote_key.account.hex(),
                        )
                    )
                )
                print(
                    "  signature       : {}".format(vote_info.signature.hex().upper())
                )
                print("  sequence        : {}".format(vote_info.sequence))
                print("  block type      : {}".format(vote_info.block_type.name))
                if vote_info.block_type == Nanodb.EnumBlocktype.not_a_block:
                    print("  vbh hashes:")
                    for entry in vote_info.votebyhash.hashes:
                        print("    {}".format(entry.block_hash.hex().upper()))
                elif vote_info.block_type == Nanodb.EnumBlocktype.state:
                    print_state_block(vote_info.block.block, 2)
                elif vote_info.block_type == Nanodb.EnumBlocktype.receive:
                    print_receive_block(vote_info.block.block, 2)
                elif vote_info.block_type == Nanodb.EnumBlocktype.send:
                    print_send_block(vote_info.block.block, 2)
                elif vote_info.block_type == Nanodb.EnumBlocktype.open:
                    print_open_block(vote_info.block.block, 2)
                elif vote_info.block_type == Nanodb.EnumBlocktype.change:
                    print_change_block(vote_info.block.block, 2)
                print("")

                count += 1
                if count >= args.count:
                    break
            cursor.close()
        if count == 0:
            print("(empty)\n")

    # Unchecked table
    if args.table == "all" or args.table == "unchecked":
        print_header("unchecked")
        state_db = env.open_db("unchecked".encode())

        count = 0
        with env.begin() as txn:
            cursor = txn.cursor(state_db)
            if args.key:
                cursor.set_key(bytearray.fromhex(args.key))
            count = 0
            for key, value in cursor:
                keystream = KaitaiStream(io.BytesIO(key))
                valstream = KaitaiStream(io.BytesIO(value))
                unchecked_key = Nanodb.UncheckedKey(keystream)
                unchecked_info = Nanodb.UncheckedValue(valstream, None, Nanodb(None))

                print(
                    "key previous      : {}".format(
                        unchecked_key.previous.hex().upper()
                    )
                )
                print("key hash          : {}".format(unchecked_key.hash.hex().upper()))
                print("  block type      : {}".format(unchecked_info.block_type.name))
                if unchecked_info.block_type == Nanodb.EnumBlocktype.state:
                    print_state_block(unchecked_info.block.block, 2)
                elif unchecked_info.block_type == Nanodb.EnumBlocktype.receive:
                    print_receive_block(unchecked_info.block.block, 2)
                elif unchecked_info.block_type == Nanodb.EnumBlocktype.send:
                    print_send_block(unchecked_info.block.block, 2)
                elif unchecked_info.block_type == Nanodb.EnumBlocktype.open:
                    print_open_block(unchecked_info.block.block, 2)
                elif unchecked_info.block_type == Nanodb.EnumBlocktype.change:
                    print_change_block(unchecked_info.block.block, 2)
                print("")

                count += 1
                if count >= args.count:
                    break
            cursor.close()
        if count == 0:
            print("(empty)\n")

    # Pending table
    if args.table == "all" or args.table == "pending":
        print_header("pending")
        state_db = env.open_db("pending".encode())

        count = 0
        with env.begin() as txn:
            cursor = txn.cursor(state_db)
            if args.key:
                cursor.set_key(bytearray.fromhex(args.key))
            count = 0
            for key, value in cursor:
                keystream = KaitaiStream(io.BytesIO(key))
                valstream = KaitaiStream(io.BytesIO(value))
                pending_key = Nanodb.PendingKey(keystream)
                pending_info = Nanodb.PendingValue(valstream, None, Nanodb(None))

                print(
                    "key account       : {}".format(pending_key.account.hex().upper())
                )
                print("key hash          : {}".format(pending_key.hash.hex().upper()))
                print(
                    "  source          : {}".format(
                        nanolib.accounts.get_account_id(
                            prefix=nanolib.AccountIDPrefix.NANO,
                            public_key=pending_info.source.hex(),
                        )
                    )
                )
                print(
                    "  amount          : {}".format(
                        nanolib.blocks.parse_hex_balance(pending_info.amount.hex())
                    )
                )
                print("  epoch           : {}".format(pending_info.epoch.name))
                print("")

                count += 1
                if count >= args.count:
                    break
            cursor.close()
        if count == 0:
            print("(empty)\n")

    # Peers table
    if args.table == "all" or args.table == "peers":
        print_header("peers")
        state_db = env.open_db("peers".encode())

        count = 0
        with env.begin() as txn:
            cursor = txn.cursor(state_db)
            if args.key:
                cursor.set_key(bytearray.fromhex(args.key))
            count = 0
            for key, value in cursor:
                keystream = KaitaiStream(io.BytesIO(key))
                peer_key = Nanodb.Peers(keystream)

                address = ipaddress.IPv6Address(peer_key.address)
                print("address     : {}".format(address))
                print("ipv4 mapped : {}".format(address.ipv4_mapped))
                print("port        : {}".format(peer_key.port))
                print("")

                count += 1
                if count >= args.count:
                    break
            cursor.close()
        if count == 0:
            print("(empty)\n")

    # Online weight table
    if args.table == "all" or args.table == "online_weight":
        print_header("online_weight")
        state_db = env.open_db("online_weight".encode())

        count = 0
        with env.begin() as txn:
            cursor = txn.cursor(state_db)
            if args.key:
                cursor.set_key(bytearray.fromhex(args.key))
            count = 0
            for key, value in cursor:
                keystream = KaitaiStream(io.BytesIO(key))
                valstream = KaitaiStream(io.BytesIO(value))
                weight_key = Nanodb.OnlineWeightKey(keystream)
                weight_info = Nanodb.OnlineWeightValue(valstream, None, Nanodb(None))

                # Weight timestamp is stored in microseconds since epoch
                print(
                    "timestamp      : {}".format(
                        datetime.datetime.utcfromtimestamp(
                            weight_key.timestamp / 1000000
                        )
                    )
                )
                print(
                    "online weight  : {}".format(
                        nanolib.blocks.parse_hex_balance(
                            weight_info.amount.hex().upper()
                        )
                    )
                )
                print("")

                count += 1
                if count >= args.count:
                    break
            cursor.close()
        if count == 0:
            print("(empty)\n")

    # Confirmation height table
    if args.table == "all" or args.table == "confirmation_height":
        print_header("confirmation_height")
        state_db = env.open_db("confirmation_height".encode())

        count = 0
        with env.begin() as txn:
            cursor = txn.cursor(state_db)
            if args.key:
                cursor.set_key(bytearray.fromhex(args.key))
            count = 0
            for key, value in cursor:
                keystream = KaitaiStream(io.BytesIO(key))
                valstream = KaitaiStream(io.BytesIO(value))
                height_key = Nanodb.ConfirmationHeightKey(keystream)
                height_info = Nanodb.ConfirmationHeightValue(
                    valstream, None, Nanodb(None)
                )

                # height timestamp is stored in microseconds since epoch
                print(
                    "account          : {}".format(
                        nanolib.accounts.get_account_id(
                            prefix=nanolib.AccountIDPrefix.NANO,
                            public_key=height_key.account.hex(),
                        )
                    )
                )
                print("confirmed height : {}".format(height_info.height))
                print(
                    "frontier hash    : {}".format(height_info.frontier.hex().upper())
                )
                print("")

                count += 1
                if count >= args.count:
                    break
            cursor.close()
        if count == 0:
            print("(empty)\n")

    # Frontiers table. This is usually empty on synced ledgers, because frontiers
    # are removed when inserting epoch blocks.
    if args.table == "all" or args.table == "frontiers":
        print_header("frontiers")
        state_db = env.open_db("frontiers".encode())

        count = 0
        with env.begin() as txn:
            cursor = txn.cursor(state_db)
            if args.key:
                cursor.set_key(bytearray.fromhex(args.key))
            count = 0
            for key, value in cursor:
                keystream = KaitaiStream(io.BytesIO(key))
                valstream = KaitaiStream(io.BytesIO(value))
                frontiers_key = Nanodb.FrontiersKey(keystream)
                frontiers_info = Nanodb.FrontiersValue(valstream, None, Nanodb(None))

                # Weight timestamp is stored in microseconds since epoch
                print("hash      : {}".format(frontiers_key.hash.hex().upper()))
                print(
                    "account   : {}".format(
                        nanolib.accounts.get_account_id(
                            prefix=nanolib.AccountIDPrefix.NANO,
                            public_key=frontiers_info.account.hex(),
                        )
                    )
                )
                print("")

                count += 1
                if count >= args.count:
                    break
            cursor.close()
        if count == 0:
            print("(empty)\n")

    # Meta table
    if args.table == "all" or args.table == "meta":
        print_header("meta")
        state_db = env.open_db("meta".encode())

        with env.begin() as txn:
            cursor = txn.cursor(state_db)
            if args.key:
                cursor.set_key(bytearray.fromhex(args.key))
            count = 0
            for key, value in cursor:
                keystream = KaitaiStream(io.BytesIO(key))
                valstream = KaitaiStream(io.BytesIO(value))
                meta_key = Nanodb.MetaKey(keystream)
                key = int.from_bytes(meta_key.key, byteorder="big", signed=False)
                if key == 1:
                    meta_version = Nanodb.MetaVersion(valstream, None, Nanodb(None))
                    print(
                        "Database version: ",
                        int.from_bytes(
                            meta_version.database_version, byteorder="big", signed=False
                        ),
                    )
                else:
                    print("Key not recognized: ", key)
            cursor.close()
        if count == 0:
            print("(empty)\n")

    env.close()
except Exception as ex:
    print(ex)
