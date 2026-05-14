# NanoDB

Up-to-date data from the [Nano cryptocurrency network](https://github.com/nanocurrency/nano-node) in widely-used formats (SQL, Parquet, CSV) plus an exploration of structuring Nano block data on IPFS for use in distributed applications.

## Capabilities

- **Multi-format export** from the upstream Nano node's lmdb store to MySQL, PostgreSQL, Parquet, and Neo4j.
- **Postgres-to-Neo4j relation export** for graph-shaped block / account analysis.
- **REST API** for querying ledger state.
- **Nano IPFS-Log spec** — a per-account, content-addressed log primitive that lets applications exchange and sync ledger heads over IPFS pubsub (described below).

## Roadmap

- Public real-time API
- Google BigQuery public dataset ([project link](https://console.cloud.google.com/bigquery?project=nano-node-310304&page=project))
- Hosted snapshots (SQL, Parquet, CSV)
- Nano IPLD implementation
- Nano IPFS-Log implementation
- IPFS node pinning Nano state blocks / IPLD blocks
- Transaction classification
- Account labeling / classification
- Pruned snapshots (spam-free, exchange-only, faucet distribution)

## Nano IPFS-Log

A specification for per-account data structures on IPFS, allowing applications to subscribe to updates per account via [IPFS pubsub](https://docs.libp2p.io/concepts/publish-subscribe/). On joining an IPFS pubsub topic by database address, applications exchange heads (frontiers) and sync any missing entries. Each Nano state block is content-addressable.

The system supports trustless propagation of valid blocks but is not a substitute for the Nano network's consensus — block confirmation and fork resolution still require representative votes from the live network.

### Address

A [CID](https://github.com/multiformats/cid) of a manifest object is the address — used both to retrieve the manifest and as the IPFS pubsub topic.

```
zdpuAzr1QDRxAhHZAXNA84UvHbtbvCTPEU4e3LoLva8fHFxF8
```

### Manifest

```json
{
  "account": "nano_11111746jddhkmjhfb8haumd97cpasftkap1j89gah1mc44exsq3uohbkw95",
  "key":     "0000014448AD6F94E2F6A4CF46E6B39556465BA922C0898EE43C135084CEE6E1"
}
```

### Entry

An entry is valid if the contained state block is valid and the heights match.

```json
{
  "hash":     "zdpuAnctNUahQ2hRBeVSt7B3ymMKZ1qiHcGZUS8vABbwQ9LBs",
  "id":       "zdpuAzr1QDRxAhHZAXNA84UvHbtbvCTPEU4e3LoLva8fHFxF8",
  "block":    "zBwWX5GSt1YAYJYortZ4HSkWHD2JsDLjMmo5piYyZfgPqYiNMDEdPGcGLxjmt6nhmPApErDew6eVBdGECYtF6W73kZ1dk",
  "previous": "",
  "refs":     [],
  "v":        1,
  "height":   0
}
```

## Related

- [Nano Database Specifications](https://github.com/nanocurrency/nanodb-specification)
