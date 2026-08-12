# Phase 0E.3 Stage 2 worker CI audit

Baseline: GitHub `main` commit `5986055dd50951ee8f53eb4db4ee706aeb218893`.

## Finding

The repository has a path-filtered Supabase replay workflow but no workflow
that validates the Railway worker. Railway's **Wait for CI** setting should
remain disabled until a worker workflow is published and observed passing.

The worker already provides deterministic, secret-free scripts for
`typecheck`, `test`, and `build`, plus a pinned `pnpm-lock.yaml`. Its Dockerfile
uses Node 22 and pnpm 11.16.0.

## Local implementation

`.github/workflows/worker-ci.yml`:

- runs for worker/workflow changes in pull requests and pushes to `main`;
- grants only `contents: read`;
- pins the same checkout and setup-node action SHAs used by the existing CI;
- matches production's Node 22 and pnpm 11.16.0 toolchain;
- installs from the frozen lockfile, then typechecks, tests, and builds;
- cancels superseded runs and has a ten-minute timeout;
- requires no repository or production secrets.

## Rollout gate

Do not enable Railway **Wait for CI** in this stage. Publish the workflow on a
feature branch, confirm `verify` passes in the pull request, merge it,
confirm the `main` run passes, and only then enable Railway **Wait for CI** in a
separately authorized provider change.

## Local verification

Verified with pnpm 11.16.0 against the frozen production lockfile:

- dependency install and lockfile supply-chain check: passed;
- TypeScript typecheck: passed;
- test suite: 18 passed, 0 failed;
- production build: passed.

The local sandbox required task-local cache directories because its root home
is read-only. This does not affect GitHub-hosted runners.
