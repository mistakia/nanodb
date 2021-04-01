# NanoDB

The primary goal of this project is to provide up-to-date data pertaining to the [Nano cryptocurrency network](https://github.com/nanocurrency/nano-node) in various popular database formats (mysql, postgres, neo4j, etc). The secondary goal is to structuring Nano block data on [IPFS](https://github.com/ipfs/go-ipfs) and to support an [IPLD spec compliant](https://github.com/ipld/specs) implementation for Nano.

- [ ] Public API
- [ ] Mysql import script from lmdb
- [ ] Postgres import script from lmdb
- [ ] Neo4j import script from lmdb
- [ ] Mysql import script from rocksdb
- [ ] Postgres import script from rocksdb
- [ ] Neo4j import script from rocksdb
- [ ] Hosted Mysql snapshot
- [ ] Hosted Postgres snapshot
- [ ] Hosted Neo4j snapshot
- [ ] Nano IPLD Implementation
- [ ] NanoDB IPFS-Log Implementation
- [ ] IPFS Node pinning Nano State Blocks / IPLD blocks

## NanoDB IPFS-Log

A spec allowing for per account data structures on IPFS. This would alow applications to subscribe for updates on a per account basis via [IPFS pubsub](https://docs.libp2p.io/concepts/publish-subscribe/). Upon joining an [IPFS pubsub topic](https://docs.libp2p.io/concepts/publish-subscribe/) using the database address, applications would exchange heads (i.e. frontiers), enabling them to sync any missing entries. This system supports the trustless propgation of valid/checked blocks but can not be relied for block confirmation information (or fork resolution). You would separately have to request votes from the nano network on heads (i.e. frontiers) and the ability to track representative voting weight.

### Address & Manifest.

A [CID](https://github.com/multiformats/cid) of a manifest object is used as the address, an identifier used to retrieve the manifest and for the IPFS pubsub topic.

```js
zdpuAzr1QDRxAhHZAXNA84UvHbtbvCTPEU4e3LoLva8fHFxF8 // base58btc encoded CID
```

### Manifest

```js
{
  account: 'nano_11111746jddhkmjhfb8haumd97cpasftkap1j89gah1mc44exsq3uohbkw95',
  key: '0000014448AD6F94E2F6A4CF46E6B39556465BA922C0898EE43C135084CEE6E1'
}
```

### Entry

```js
{
  hash: 'zdpuAnctNUahQ2hRBeVSt7B3ymMKZ1qiHcGZUS8vABbwQ9LBs', // NanoDB IPFS-Log Entry hash
  id: 'zdpuAzr1QDRxAhHZAXNA84UvHbtbvCTPEU4e3LoLva8fHFxF8', // NanoDB IPFS-Log Address
  block: 'zBwWX5GSt1YAYJYortZ4HSkWHD2JsDLjMmo5piYyZfgPqYiNMDEdPGcGLxjmt6nhmPApErDew6eVBdGECYtF6W73kZ1dk', // IPFS hash of Nano State Block
  previous: '', // previous NanoDB IPFS-Log Entry hash
  refs: [], // references to previous entries, allows for skipping around and faster sync (using NanoDB IPFS-Log Entry hash)
  v: 1,
  height: 0
}
```

## Related

- [Nano Database Specifications](https://github.com/nanocurrency/nanodb-specification)
