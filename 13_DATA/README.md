# 13_DATA

## Purpose
Documentation of the project's data: schemas, models, storage structure,
and data flow — the "shape" of what the system stores, independent of the
code that manipulates it.

## What belongs here
- Database schema documentation (tables/collections, fields, relationships)
- Data model diagrams or descriptions
- Data flow notes (where data comes from, where it goes, what transforms it)
- Data retention / lifecycle policy
- Sample data structures (anonymized — never real user data or secrets)

## What does NOT belong here
- Actual credentials or connection strings → `09_SECURITY` (status only,
  never the secrets themselves — those belong in environment variables)
- API endpoint documentation → `14_API`
- Actual data files/exports (that's a backup, not documentation)

## Structure
```
13_DATA/
  SCHEMA.md         → current schema, kept in sync with reality
  MODELS.md          → entities, relationships, ownership
  DATA_FLOW.md        → how data moves through the system
  RETENTION.md        → what's kept, for how long, and why
```

## Rule
If the schema changes, this folder updates in the same commit as the code
change. Stale schema docs are worse than no schema docs — they actively
mislead future AI agents.

## Status
✅ `SCHEMA.md` documents the live D1 schema as of 2026-09-12 (pulled
directly from `sqlite_master`), including the correction that D1 — not
Grist — is now the source of truth for products/content/analysis (see
`SCHEMA.md`'s note at the top). `MODELS.md`, `DATA_FLOW.md`, and
`RETENTION.md` are still not written.
