# Phase 0C.1 — Repository migration-ledger recovery

Date: 2026-08-12

## Purpose

Restore the current live Supabase migration ledger as repository-native source
so local and disposable environments can be rebuilt without the historical
Phase 0A.2 schema fixture.

This phase is repository-only. It does not create a Supabase branch, apply SQL
to the live project, change migration-history metadata, deploy Replit, or alter
production data, Auth, Storage, or configuration.

## Authorized baseline

- GitHub base: `e0a32c3518be71d2ef9c0b496210d531b3b834e1`
- Local branch: `codex/phase-0c1-migration-ledger-recovery`
- Live project used read-only: `equivista-development`
  (`gtogwivozgrmjnrtungm`)
- PostgreSQL major version: 17

## Recovery method

The live `supabase_migrations.schema_migrations` ledger retained one SQL
statement body for every recorded migration. Phase 0C.1 recovered each body
under its exact recorded `<version>_<name>.sql` filename.

The active migration directory now contains 69 files:

- 64 historical migrations that were absent from the repository;
- the corrected live versions for Phase 0A.2, Phase 0B.1, and Phase 0B.2;
- the existing, already aligned Phase 0B.5 and Phase 0B.6 migrations.

The non-versioned `05_FIX_HORSE_RLS.sql` file and three differently
timestamped duplicates were removed from the active migration path. Their
paired rollback filenames and documentation references were aligned with the
live versions.

## Integrity controls

- `supabase/migration-ledger.sha256` records every recovered migration hash.
- `node scripts/verify-supabase-migration-ledger.mjs` rejects malformed names,
  duplicate versions, missing or extra files, and content drift.
- `supabase/config.toml` is local/disposable-environment configuration only;
  it contains no remote linkage or secret.
- The recovered active files and manifest were compared with the live statement
  bodies: 69 of 69 SHA-256 values matched byte-for-byte.

## Phase 0C.2 replay result and Phase 0C.2A successor

Phase 0C.2 proved that the recovered ledger is not a valid clean-replay chain.
The disposable branch replayed 64 migrations into an obsolete 89-table schema,
then Phase 0A.2 failed because `public.memberships` was absent. The branch was
deleted and the live project remained unchanged.

Phase 0C.2A consequently moved this exact recovered ledger to the non-replay
`supabase/migration-history` forensic archive and created the current
live-catalog baseline documented in
`docs/PHASE_0C2A_CANONICAL_BASELINE.md`. No live migration-history repair has
been performed.
