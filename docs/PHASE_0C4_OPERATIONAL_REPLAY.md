# Phase 0C.4 — Reproducible operational replay

## Goal

Make the repository inputs capable of reproducing the non-schema operational
state excluded from the canonical migration: five Storage buckets and one
non-secret pg_cron job. Git-integrated preview replay is a separate acceptance
gate and must be observed before merge.

## Repository contract

- `supabase/config.toml` declares all five buckets and their access, size, and
  MIME-type settings.
- `supabase/seed.sql` idempotently replaces the stable-name cron job.
- `scripts/verify-supabase-operational-config.mjs` rejects missing or changed
  declarations, commented-out or malformed cron SQL, and obvious secret
  material.
- `npm run verify:supabase` verifies both the canonical migration ledger and
  operational replay inputs.
- `.github/workflows/verify-supabase-replay.yml` runs that command for relevant
  pull requests and changes merged to `main`.

The Supabase GitHub integration must use repository working directory `.` and
have **Automatic branching** enabled. Only a Git-integrated preview performs the
repository checkout, `config.toml` configuration, migration, and seed steps.
Branches created directly through the Dashboard, Management API, or MCP prove
the schema replay but do not prove Git configuration or seed orchestration.

Production bucket deployment requires the integration's **Deploy to
production** option. Seed files remain preview-only and are not merged into
production.

## Required validation gate

Before merging Phase 0C.4:

1. Run `npm run verify:supabase`.
2. Confirm the Supabase GitHub integration points to this repository, uses
   working directory `.`, and has **Automatic branching** enabled.
3. Observe the preview branch created for this pull request. A manually created
   branch is not sufficient for this gate.
4. Wait for the Git-integrated branch action's Configure, Migrate, and Seed
   steps to finish successfully.
5. Verify exactly five expected rows in `storage.buckets`.
6. Verify exactly one `cron.job` named
   `equivista-continuous-controls-daily`, scheduled at `15 2 * * *`, with the
   expected `private.run_continuous_controls_monitoring('scheduled')` command.
7. Rerun `supabase/seed.sql` and confirm the cron job remains a single row.
8. Confirm all six representative application tables are empty.
9. Run Security and Performance Advisors; security findings and performance
   warning/error findings must be zero.
10. Delete the disposable branch and confirm only `main` remains.

Branch creation is billable and requires a fresh explicit cost authorization.
If opening the pull request creates no Supabase preview branch, this gate fails
and the pull request must not merge until the integration is corrected and the
Git-integrated replay is observed.

## Production safety

This phase introduces no schema migration and no production business-row seed.
Never add auth identities, Storage objects, Vault/project secrets, or production
table rows to these operational files.
