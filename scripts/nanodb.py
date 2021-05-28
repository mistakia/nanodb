# This is a generated file! Please edit source .ksy file and use kaitai-struct-compiler to rebuild

from pkg_resources import parse_version
import kaitaistruct
from kaitaistruct import KaitaiStruct, KaitaiStream, BytesIO
from enum import Enum


if parse_version(kaitaistruct.__version__) < parse_version("0.9"):
    raise Exception(
        "Incompatible Kaitai Struct Python API: 0.9 or later is required, but you have %s"
        % (kaitaistruct.__version__)
    )


class Nanodb(KaitaiStruct):
    class EnumBlocktype(Enum):
        invalid = 0
        not_a_block = 1
        send = 2
        receive = 3
        open = 4
        change = 5
        state = 6

    class MetaKey(Enum):
        version = 1

    class DatabaseVersion(Enum):
        value = 19

    class EnumEpoch(Enum):
        invalid = 0
        unspecified = 1
        epoch_0 = 2
        epoch_1 = 3
        epoch_2 = 4

    class EnumSignatureVerification(Enum):
        unknown = 0
        invalid = 1
        valid = 2
        valid_epoch = 3

    def __init__(self, _io, _parent=None, _root=None):
        self._io = _io
        self._parent = _parent
        self._root = _root if _root else self
        self._read()

    def _read(self):
        pass

    class BlocksKey(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.hash = self._io.read_bytes(32)

    class BlockSend(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.previous = self._io.read_bytes(32)
            self.destination = self._io.read_bytes(32)
            self.balance = self._io.read_bytes(16)
            self.signature = self._io.read_bytes(64)
            self.work = self._io.read_u8le()

    class Unchecked(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.key = Nanodb.UncheckedKey(self._io, self, self._root)
            self.value = Nanodb.UncheckedValue(self._io, self, self._root)

    class MetaVersion(KaitaiStruct):
        """Value of key meta_key#version."""

        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.database_version = self._io.read_bytes(32)

    class VoteValue(KaitaiStruct):
        """Vote and block(s)."""

        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.account = self._io.read_bytes(32)
            self.signature = self._io.read_bytes(64)
            self.sequence = self._io.read_u8le()
            self.block_type = KaitaiStream.resolve_enum(
                Nanodb.EnumBlocktype, self._io.read_u1()
            )
            if self.block_type == Nanodb.EnumBlocktype.not_a_block:
                self.votebyhash = Nanodb.VoteByHash(self._io, self, self._root)

            if self.block_type != Nanodb.EnumBlocktype.not_a_block:
                self.block = Nanodb.BlockSelector(
                    self.block_type.value, self._io, self, self._root
                )

    class FrontiersKey(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.hash = self._io.read_bytes(32)

    class Blocks(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.key = Nanodb.BlocksKey(self._io, self, self._root)
            self.value = Nanodb.BlocksValue(self._io, self, self._root)

    class BlockSelector(KaitaiStruct):
        """Selects a block based on the argument."""

        def __init__(self, arg_block_type, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self.arg_block_type = arg_block_type
            self._read()

        def _read(self):
            _on = self.arg_block_type
            if _on == Nanodb.EnumBlocktype.receive.value:
                self.block = Nanodb.BlockReceive(self._io, self, self._root)
            elif _on == Nanodb.EnumBlocktype.change.value:
                self.block = Nanodb.BlockChange(self._io, self, self._root)
            elif _on == Nanodb.EnumBlocktype.state.value:
                self.block = Nanodb.BlockState(self._io, self, self._root)
            elif _on == Nanodb.EnumBlocktype.open.value:
                self.block = Nanodb.BlockOpen(self._io, self, self._root)
            elif _on == Nanodb.EnumBlocktype.send.value:
                self.block = Nanodb.BlockSend(self._io, self, self._root)
            else:
                self.block = Nanodb.IgnoreUntilEof(self._io, self, self._root)

    class BlockReceive(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.previous = self._io.read_bytes(32)
            self.source = self._io.read_bytes(32)
            self.signature = self._io.read_bytes(64)
            self.work = self._io.read_u8le()

    class MetaKey(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.key = self._io.read_bytes(32)

    class BlockChange(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.previous = self._io.read_bytes(32)
            self.representative = self._io.read_bytes(32)
            self.signature = self._io.read_bytes(64)
            self.work = self._io.read_u8le()

    class PendingKey(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.account = self._io.read_bytes(32)
            self.hash = self._io.read_bytes(32)

    class PendingValue(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.source = self._io.read_bytes(32)
            self.amount = self._io.read_bytes(16)
            self.epoch = KaitaiStream.resolve_enum(Nanodb.EnumEpoch, self._io.read_u1())

    class VoteKey(KaitaiStruct):
        """Key of the vote table."""

        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.account = self._io.read_bytes(32)

    class AccountsKey(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.account = self._io.read_bytes(32)

    class Frontiers(KaitaiStruct):
        """Mapping from block hash to account. This is not used after epoch 1."""

        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.key = Nanodb.FrontiersKey(self._io, self, self._root)
            self.value = Nanodb.FrontiersValue(self._io, self, self._root)

    class AccountsValue(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.head = self._io.read_bytes(32)
            self.representative = self._io.read_bytes(32)
            self.open_block = self._io.read_bytes(32)
            self.balance = self._io.read_bytes(16)
            self.modified = self._io.read_u8le()
            self.block_count = self._io.read_u8le()

    class OnlineWeightValue(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.amount = self._io.read_bytes(16)

    class FrontiersValue(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.account = self._io.read_bytes(32)

    class ReceiveValue(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.block = Nanodb.BlockReceive(self._io, self, self._root)
            self.sideband = Nanodb.ReceiveSideband(self._io, self, self._root)

    class VoteByHashEntry(KaitaiStruct):
        """The serialized hash in VBH is prepended by not_a_block."""

        def __init__(self, idx, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self.idx = idx
            self._read()

        def _read(self):
            if self.idx > 0:
                self.block_type = KaitaiStream.resolve_enum(
                    Nanodb.EnumBlocktype, self._io.read_u1()
                )

            self.block_hash = self._io.read_bytes(32)

    class BlockOpen(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.source = self._io.read_bytes(32)
            self.representative = self._io.read_bytes(32)
            self.account = self._io.read_bytes(32)
            self.signature = self._io.read_bytes(64)
            self.work = self._io.read_u8le()

    class IgnoreUntilEof(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            if not (self._io.is_eof()):
                self.empty = []
                i = 0
                while True:
                    _ = self._io.read_u1()
                    self.empty.append(_)
                    if self._io.is_eof():
                        break
                    i += 1

    class SendValue(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.block = Nanodb.BlockSend(self._io, self, self._root)
            self.sideband = Nanodb.SendSideband(self._io, self, self._root)

    class UncheckedKey(KaitaiStruct):
        """Key of the unchecked table."""

        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.previous = self._io.read_bytes(32)
            self.hash = self._io.read_bytes(32)

    class StateSideband(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.successor = self._io.read_bytes(32)
            self.height = self._io.read_u8be()
            self.timestamp = self._io.read_u8be()
            self.is_send = self._io.read_bits_int_be(1) != 0
            self.is_receive = self._io.read_bits_int_be(1) != 0
            self.is_epoch = self._io.read_bits_int_be(1) != 0
            self.epoch = KaitaiStream.resolve_enum(
                Nanodb.EnumEpoch, self._io.read_bits_int_be(5)
            )

    class OnlineWeightKey(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.timestamp = self._io.read_u8be()

    class ConfirmationHeight(KaitaiStruct):
        """Confirmed height per account."""

        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.key = Nanodb.ConfirmationHeightKey(self._io, self, self._root)
            self.value = Nanodb.ConfirmationHeightValue(self._io, self, self._root)

    class ChangeSideband(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.successor = self._io.read_bytes(32)
            self.account = self._io.read_bytes(32)
            self.height = self._io.read_u8be()
            self.balance = self._io.read_bytes(16)
            self.timestamp = self._io.read_u8be()

    class OpenSideband(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.successor = self._io.read_bytes(32)
            self.balance = self._io.read_bytes(16)
            self.timestamp = self._io.read_u8be()

    class ConfirmationHeightKey(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.account = self._io.read_bytes(32)

    class ConfirmationHeightValue(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.height = self._io.read_u8le()
            self.frontier = self._io.read_bytes(32)

    class SendSideband(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.successor = self._io.read_bytes(32)
            self.account = self._io.read_bytes(32)
            self.height = self._io.read_u8be()
            self.timestamp = self._io.read_u8be()

    class BlocksValue(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.block_type = KaitaiStream.resolve_enum(
                Nanodb.EnumBlocktype, self._io.read_u1()
            )
            _on = self.block_type
            if _on == Nanodb.EnumBlocktype.change:
                self.block_value = Nanodb.ChangeValue(self._io, self, self._root)
            elif _on == Nanodb.EnumBlocktype.send:
                self.block_value = Nanodb.SendValue(self._io, self, self._root)
            elif _on == Nanodb.EnumBlocktype.receive:
                self.block_value = Nanodb.ReceiveValue(self._io, self, self._root)
            elif _on == Nanodb.EnumBlocktype.state:
                self.block_value = Nanodb.StateValue(self._io, self, self._root)
            elif _on == Nanodb.EnumBlocktype.open:
                self.block_value = Nanodb.OpenValue(self._io, self, self._root)
            else:
                self.block_value = Nanodb.IgnoreUntilEof(self._io, self, self._root)

    class BlockState(KaitaiStruct):
        """State block."""

        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.account = self._io.read_bytes(32)
            self.previous = self._io.read_bytes(32)
            self.representative = self._io.read_bytes(32)
            self.balance = self._io.read_bytes(16)
            self.link = self._io.read_bytes(32)
            self.signature = self._io.read_bytes(64)
            self.work = self._io.read_u8be()

    class OpenValue(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.block = Nanodb.BlockOpen(self._io, self, self._root)
            self.sideband = Nanodb.OpenSideband(self._io, self, self._root)

    class StateValue(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.block = Nanodb.BlockState(self._io, self, self._root)
            self.sideband = Nanodb.StateSideband(self._io, self, self._root)

    class ReceiveSideband(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.successor = self._io.read_bytes(32)
            self.account = self._io.read_bytes(32)
            self.height = self._io.read_u8be()
            self.balance = self._io.read_bytes(16)
            self.timestamp = self._io.read_u8be()

    class ChangeValue(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.block = Nanodb.BlockChange(self._io, self, self._root)
            self.sideband = Nanodb.ChangeSideband(self._io, self, self._root)

    class VoteByHash(KaitaiStruct):
        """A sequence of up to 12 hashes, terminated by EOF."""

        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            if not (self._io.is_eof()):
                self.hashes = []
                i = 0
                while True:
                    _ = Nanodb.VoteByHashEntry(i, self._io, self, self._root)
                    self.hashes.append(_)
                    if (i == 12) or (self._io.is_eof()):
                        break
                    i += 1

    class Peers(KaitaiStruct):
        """Peer cache table. All data is stored in the key."""

        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.address = self._io.read_bytes(16)
            self.port = self._io.read_u2be()

    class Vote(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.key = Nanodb.VoteKey(self._io, self, self._root)
            self.value = Nanodb.VoteValue(self._io, self, self._root)

    class Pending(KaitaiStruct):
        """Pending table."""

        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.key = Nanodb.PendingKey(self._io, self, self._root)
            self.value = Nanodb.PendingValue(self._io, self, self._root)

    class Accounts(KaitaiStruct):
        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.key = Nanodb.AccountsKey(self._io, self, self._root)
            self.value = Nanodb.AccountsValue(self._io, self, self._root)

    class UncheckedValue(KaitaiStruct):
        """Information about an unchecked block."""

        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.block_type = KaitaiStream.resolve_enum(
                Nanodb.EnumBlocktype, self._io.read_u1()
            )
            self.block = Nanodb.BlockSelector(
                self.block_type.value, self._io, self, self._root
            )
            self.account = self._io.read_bytes(32)
            self.modified = self._io.read_u8le()
            self.verified = KaitaiStream.resolve_enum(
                Nanodb.EnumSignatureVerification, self._io.read_u1()
            )

    class OnlineWeight(KaitaiStruct):
        """Stores online weight trended over time."""

        def __init__(self, _io, _parent=None, _root=None):
            self._io = _io
            self._parent = _parent
            self._root = _root if _root else self
            self._read()

        def _read(self):
            self.key = Nanodb.OnlineWeightKey(self._io, self, self._root)
            self.value = Nanodb.OnlineWeightValue(self._io, self, self._root)
