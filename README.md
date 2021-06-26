# NanoDB

This project aims to provide up-to-date data pertaining to the [Nano cryptocurrency network](https://github.com/nanocurrency/nano-node) in various popular formats (sql, parquet, csv) in order to make it more accessible. The secondary purpose is to explore structuring Nano block data on [IPFS](https://github.com/ipfs/go-ipfs) and to support an [IPLD](https://github.com/ipld/specs) implementation for Nano for use in distributed applications.

- [ ] Public Real-time API
- [ ] Google Big Query Public Dataset ([Link](https://console.cloud.google.com/bigquery?project=nano-node-310304&page=project))
- [x] Export scripts (from lmdb)
  - [x] Mysql
  - [x] Parquet
  - [x] Postgres
  - [x] Neo4j
- [ ] Hosted snapshots
  - [ ] SQL
  - [ ] Parquet
  - [ ] CSV
- [ ] Nano IPLD Implementation
- [ ] Nano IPFS-Log Implementation
- [ ] IPFS Node pinning Nano State Blocks / IPLD blocks

#### Roadmap

- Transaction Classification
- Account Labeling / Classification
- Pruned Snapshots
  - Snapshot without spam blocks
  - Exchange blocks only
  - Faucet distribution

## Usage

#### Read from lmdb to console

```py
python3 scripts/read-lmdb.py --filename [path_lmdb.ldb] [--table] [--count]
```

#### Export from lmdb to mysql

```py
python3 scripts/export-lmdb-to-mysql.py --filename [path_lmdb.ldb] [--table] [--count]
```

_Edit `config.json` with mysql information_

#### Export from lmdb to postgres

```py
python3 scripts/export-lmdb-to-postgres.py --filename [path_lmdb.ldb] [--table] [--count]
```

_Edit `config.json` with postgres information_

#### Export from postgres to neo4j

```py
python3 scripts/create-postgresql-stats-tables.py && \
python3 export-postgresql-to-neo4j-relations-merged.py
```

_Edit `config.json` with neo4j information_

#### Export from lmdb to parquet

```py
python3 scripts/export-lmdb-to-parquet.py --filename [path_lmdb.ldb] [--table] [--count]
```

## Nano IPFS-Log

A spec allowing for per account data structures on IPFS. This would alow applications to subscribe for updates on a per account basis via [IPFS pubsub](https://docs.libp2p.io/concepts/publish-subscribe/). Upon joining an [IPFS pubsub topic](https://docs.libp2p.io/concepts/publish-subscribe/) using the database address, applications would exchange heads (i.e. frontiers), enabling them to sync any missing entries. Each nano state block is content addressable. This system supports the trustless propgation of valid/checked blocks but can not be relied on for block confirmation information (or fork resolution). You would separately have to request votes from the nano network on heads (i.e. frontiers) and the ability to track representative voting weight.

### Address & Manifest.

A [CID](https://github.com/multiformats/cid) of a manifest object is used as the address, an identifier used to retrieve the manifest and for the IPFS pubsub topic.

```js
zdpuAzr1QDRxAhHZAXNA84UvHbtbvCTPEU4e3LoLva8fHFxF8 // base58btc encoded CID of manifest
```

### Manifest

```js
{
  account: 'nano_11111746jddhkmjhfb8haumd97cpasftkap1j89gah1mc44exsq3uohbkw95',
  key: '0000014448AD6F94E2F6A4CF46E6B39556465BA922C0898EE43C135084CEE6E1'
}
```

### Entry

An entry is considered valid if the state block it contains is valid and the heights match.

```js
{
  hash: 'zdpuAnctNUahQ2hRBeVSt7B3ymMKZ1qiHcGZUS8vABbwQ9LBs', // Nano IPFS-Log Entry hash
  id: 'zdpuAzr1QDRxAhHZAXNA84UvHbtbvCTPEU4e3LoLva8fHFxF8', // Nano IPFS-Log Address
  block: 'zBwWX5GSt1YAYJYortZ4HSkWHD2JsDLjMmo5piYyZfgPqYiNMDEdPGcGLxjmt6nhmPApErDew6eVBdGECYtF6W73kZ1dk', // IPFS hash of Nano State Block
  previous: '', // previous Nano IPFS-Log Entry hash
  refs: [], // references to previous entries, allows for skipping around and faster sync (using Nano IPFS-Log Entry hash)
  v: 1,
  height: 0
}
```

## Related

- [Nano Database Specifications](https://github.com/nanocurrency/nanodb-specification)
