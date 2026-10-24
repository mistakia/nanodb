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
```

### Export pipelines (Python)

Each export reads from the node's lmdb store and writes to the target. Configure connection details in a plaintext `config.json` (not committed; see Conventions for the secrets model).

```bash
python3 scripts/read-lmdb.py             --filename <path/to/lmdb.ldb> [--table NAME] [--count N]
python3 scripts/export-lmdb-to-mysql.py  --filename <path/to/lmdb.ldb> [--table NAME] [--count N]
python3 scripts/export-lmdb-to-postgres.py --filename <path/to/lmdb.ldb> [--table NAME] [--count N]
python3 scripts/export-lmdb-to-parquet.py --filename <path/to/lmdb.ldb> [--table NAME] [--count N]
```

### Postgres → Neo4j

```bash
python3 scripts/create-postgresql-stats-tables.py && \
python3 export-postgresql-to-neo4j-relations-merged.py
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
- Production secrets are sops/age-encrypted at rest in the host-only, gitignored `config.production.json`, encrypted to the database host's recipient in `.sops.yaml`. `config.js` decrypts it with the system `sops` and fails closed; test and development load plaintext `config.${env}.js`, which holds no secrets (`config.sample.js` is the structural template). Edit the production config on the host with `sops config.production.json`, per [[user:guideline/homelab/sops-age-authoring.md]].

## Deployment

Production deployment is via SSH + PM2.
