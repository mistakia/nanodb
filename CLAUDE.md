# CLAUDE.md

Guidance for Claude Code working in this repository.

For graph context (related task dir, tags, sibling nano repos), see [ABOUT.md](ABOUT.md).

## Project Overview

Nano cryptocurrency ledger data in multiple formats (SQL, Parquet, CSV) plus IPFS/IPLD exploration. Provides import pipelines from the nano node's lmdb store and REST API for querying ledger state. Node.js + Python hybrid.

## Build / Run

```bash
yarn install
yarn start             # Express dev server
yarn test              # Mocha (TZ=America/New_York)
python3 scripts/export-lmdb-to-<format>.py
```

## Architecture

```
server/                # Express API
api/                   # REST endpoints
db/                    # Schema and migrations (knex)
scripts/               # Python lmdb exporters (MySQL, PostgreSQL, Neo4j, Parquet)
common/                # Shared utilities
data/                  # Snapshots
```

## Subsystems

- Ledger importer from lmdb (node's native store)
- Multi-format exporters: MySQL, PostgreSQL, Neo4j, Parquet
- REST API for ledger state queries
- Nano IPFS-Log spec implementation (IPFS/IPLD ledger exploration)

## Conventions

- ESM throughout; `#libs-server/*` import aliases (recent refactor).
- JWT auth via `jose` (migrated from older `jsonwebtoken`).
- Knex migrations; MySQL and PostgreSQL both supported.
- `config.json` holds DB credentials and stays out of the repo. Use `config.sample.json` as the template.

## Deployment

Production deployment is via SSH + PM2.
