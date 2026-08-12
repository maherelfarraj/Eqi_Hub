# Phase 0C.2A — Canonical baseline

Date: 2026-08-12

## Outcome

Phase 0C.2A replaces the invalid 69-file clean-replay chain with one
schema-only canonical baseline extracted from the current live catalog.
Historical migrations remain available for audit and forensics, but they are
outside Supabase's active `supabase/migrations` replay path.

This phase was local-only. It did not create a Supabase branch, execute DDL or
DML against the live project, change migration-history metadata, stage or
commit files, push a Git branch, create or update a pull request, or deploy the
application.

## Source and version boundary

- Read-only source: `equivista-development`
  (`gtogwivozgrmjnrtungm`)
- PostgreSQL: 17.6
- Canonical migration:
  `supabase/migrations/20260812101436_canonical_live_schema_baseline.sql`
- Baseline version: `20260812101436`, intentionally reusing the latest
  recorded live migration version rather than inventing a new timestamp
- Live catalog fingerprints:
  `supabase/canonical-baseline.inventory.json`

The version reuse is only a local baseline design choice. It does not repair or
otherwise modify the live `supabase_migrations.schema_migrations` ledger.

## Canonical schema coverage

The baseline contains:

- required extensions and the `private` schema;
- 23 application tables with 211 columns and one sequence;
- 127 constraints, including 63 foreign keys;
- 52 non-constraint indexes (86 indexes total when constraint indexes are
  included);
- 74 `public` and `private` functions;
- 14 application triggers, including the `auth.users` profile-bootstrap
  trigger;
- RLS enabled on all 23 application tables;
- 36 application policies and five Storage object policies;
- effective schema, table, sequence, function, and default privileges; and
- application comments.

`check_function_bodies` is disabled only while creating the baseline
functions. This preserves legacy live function definitions whose referenced
historical modules no longer exist. It is reset before the migration ends.
Those functions are catalog parity, not an assertion that every legacy
function is currently callable.

## Operational configuration

Supabase's schema-only squash model excludes data manipulation, including
Storage bucket rows and cron jobs. Phase 0C.2A therefore keeps these outside
the schema migration:

- five non-secret bucket declarations in `supabase/config.toml`; and
- one non-secret scheduled-job declaration in `supabase/seed.sql`.

The extraction included zero Vault secrets and zero Realtime publication
tables. The repository contains no production rows, Auth identities, Storage
object rows or contents, Vault secret values, API keys, service-role keys, or
remote database credentials.

## Forensic migration ledger

The 69 live-recorded statement bodies now reside in
`supabase/migration-history`. They remain protected by
`supabase/migration-ledger.sha256`.

`node scripts/verify-supabase-migration-ledger.mjs` verifies:

1. the active replay path contains only the canonical migration;
2. the canonical migration hash matches
   `supabase/canonical-baseline.sha256`;
3. all 69 forensic files match the live-ledger hashes, allowing only the
   terminal-newline normalization introduced by text patching;
4. filenames and versions are valid and unique; and
5. canonical schema-object counts match the read-only live inventory.

## Required validation gate

Local static checks do not prove that a fresh Supabase environment can apply
the baseline. A separately authorized Phase 0C.2B must:

1. create a disposable Supabase staging branch;
2. apply only the canonical migration and operational configuration;
3. compare catalog counts and fingerprints to
   `canonical-baseline.inventory.json`;
4. run Security and Performance Advisors;
5. run the reusable tenancy persona suite;
6. verify no production access or persistent live changes occurred; and
7. delete the staging branch.

If any schema object, policy, grant, trigger, bucket, or cron fingerprint
diverges, stop without repairing live migration history. Staging success,
commit, push, PR, and live migration-ledger repair each remain separate gates.
