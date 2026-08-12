# Phase 0C.4 — Reproducible operational replay

## Goal

Make every clean Supabase preview branch reproduce the non-schema operational
state excluded from the canonical migration: five Storage buckets and one
non-secret pg_cron job.

## Repository contract

- `supabase/config.toml` declares all five buckets and their access, size, and
  MIME-type settings.
- `supabase/seed.sql` idempotently replaces the stable-name cron job.
- `scripts/verify-supabase-operational-config.mjs` rejects missing or changed
  declarations and obvious secret material.
- `npm run verify:supabase` verifies both the canonical migration ledger and
  operational replay inputs.
- `.github/workflows/verify-supabase-replay.yml` runs that command for relevant
  pull requests and changes merged to `main`.

The Supabase GitHub integration must use repository working directory `.`.
Automatic branching must be enabled. Supabase applies migrations, bucket
configuration, and the configured seed to preview branches; seed data is not
merged into production. Production bucket deployment requires the integration's
**Deploy to production** option, while seed files remain preview-only.

## Required validation gate

Before merging Phase 0C.4:

1. Run `npm run verify:supabase`.
2. Create exactly one data-free disposable branch after confirming its current
   hourly price.
3. Wait for its branch action to finish successfully.
4. Verify exactly five expected rows in `storage.buckets`.
5. Verify exactly one `cron.job` named
   `equivista-continuous-controls-daily`, scheduled at `15 2 * * *`, with the
   expected `private.run_continuous_controls_monitoring('scheduled')` command.
6. Rerun `supabase/seed.sql` and confirm the cron job remains a single row.
7. Confirm all six representative application tables are empty.
8. Run Security and Performance Advisors; security findings and performance
   warning/error findings must be zero.
9. Delete the disposable branch and confirm only `main` remains.

Branch creation is billable and requires a fresh explicit cost authorization.

## Production safety

This phase introduces no schema migration and no production business-row seed.
Never add auth identities, Storage objects, Vault/project secrets, or production
table rows to these operational files.
