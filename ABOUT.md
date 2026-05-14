---
title: nanodb Repository Graph Entry
type: text
description: >-
  Graph entry for nanodb, which provides nano cryptocurrency ledger data in SQL, Parquet, CSV
  formats plus IPFS/IPLD exploration; maps to sibling nano repos and the nano-cryptocurrency task
  umbrella.
base_uri: user:repository/active/nanodb/ABOUT.md
created_at: '2026-05-13T18:07:35.063Z'
entity_id: 80dd8071-6afb-4158-beff-253ba17dfcba
public_read: false
relations:
  - follows [[user:guideline/directory-markdown-standards.md]]
tags:
  - user:tag/nanodb-project.md
  - user:tag/nano-cryptocurrency.md
updated_at: '2026-05-13T18:07:35.063Z'
user_public_key: 10ba842b1307fd60475b887df61ccc7e697970a2d222e7cbf011e51f5de3349b
---

## Purpose

Nano cryptocurrency ledger data in multiple formats (SQL, Parquet, CSV) with IPFS/IPLD exploration. Provides import pipelines from the nano node's lmdb store, multi-format exporters, and a REST API for querying ledger state.

For public overview, see [[README.md]]. For agent-facing build, layout, and conventions, see [[CLAUDE.md]].

## Context

Part of the nano cryptocurrency ecosystem maintained here. Consumes lmdb dumps from the upstream nano node and produces SQL / Parquet / Neo4j artifacts for analysis. Implements the Nano IPFS-Log spec for distributed ledger exploration.

## Notable Context

**Tags**:

- [[user:tag/nanodb-project.md]] — entities for this project
- [[user:tag/nano-cryptocurrency.md]] — broader nano domain

**Task directory**: [[user:task/nano-cryptocurrency/]] — umbrella tasks; nanodb items typically live under this directory.

**Sibling repositories**:

- [[user:repository/active/nano-node-light/ABOUT.md]] — lightweight nano protocol implementation
- [[user:repository/active/nano-community/ABOUT.md]] — community site / monitoring
- [[user:repository/active/ed25519-blake2b/ABOUT.md]] — crypto bindings

**Governing guidelines**:

- [[user:guideline/directory-markdown-standards.md]] — structure for this file

## Scope

**Belongs in this repo**: ledger importers, exporters (SQL / Parquet / Neo4j), REST API, schema migrations, Python data pipelines, IPFS-Log spec implementation.

**Belongs elsewhere**:

- Protocol implementation → `nano-node-light/`
- Crypto primitives → `ed25519-blake2b/`
- Community site → `nano-community/`
- Open work → `task/nano-cryptocurrency/`
