# Phase 0F Stage 5 — Repository Security and Hygiene Corrections

## Scope and baseline

- Repository: `maherelfarraj/Eqi_Hub`
- Baseline branch: `main`
- Baseline commit: `229241fa9d896c1b99bb37c6e39197d1aed95b1d`
- Mode: local implementation only; no staging, commit, publication, branch
  creation, deployment, or GitHub settings changes are authorized.

## Local corrections

1. Renamed the Supabase replay job from the ambiguous `verify` context to
   `supabase-replay`. The Worker CI job retains the protected `verify` context.
2. Added Dependabot version-update coverage for the root pnpm workspace, the
   independent Worker project, and pinned GitHub Actions.
3. Added a repository security policy that directs vulnerability reports away
   from public issues and avoids collection of live credentials or unnecessary
   personal data.
4. Added default code ownership for review routing to `@maherelfarraj`.
5. Removed the tracked `.migration-backup` snapshot from the local worktree and
   ignored future local copies.

## GitHub settings still pending separate authorization

- Enable dependency graph, Dependabot alerts, and Dependabot security updates.
- Enable private vulnerability reporting.
- Enable CodeQL default setup and Secret Protection.
- Add `frontend-verify` to the required status checks for `main`.
- Keep `verify` as the Worker CI required context. Do not require
  `supabase-replay` while that workflow remains path-filtered.
- Consider requiring conversation resolution and code-owner review after a
  second eligible reviewer is available.
- Enable automatic deletion of merged head branches and allow only the desired
  merge strategy.

## Local validation

- Parsed all GitHub workflow files and `.github/dependabot.yml` as YAML.
- Verified JSON package manifests and a whitespace-clean Git diff.
- Installed the root workspace with pnpm `11.16.0` and the frozen lockfile.
- Passed root TypeScript checks and all seven production server/security-header
  tests.
- Passed the complete root production build with the workflow environment
  (`CI=true`, `PORT=4173`, and `BASE_PATH=/`).
- Passed all Supabase migration-ledger, operational-config, and Storage-policy
  verification scripts.
- Installed the Worker with its frozen lockfile; passed Worker typechecking, all
  18 tests, and the production build.
- Verified Prettier formatting for the new YAML and Markdown files.

## Branch hygiene boundaries

- Preserve `codex/canonical-roadmap` until its unique roadmap commit is
  reconciled with `main`.
- Review `codex/equivista-v1.0.1-membership-count` before deciding whether to
  merge or delete its unique membership-label commit.
- The 14 fully merged non-main branches identified by the Stage 5 audit remain
  eligible for deletion under separate authorization.

## Deliberate exclusions

- No GitHub settings were changed.
- No remote branch was created or deleted.
- No license file was added. Although `package.json` declares `MIT`, publishing
  a repository-level license should be an explicit owner decision.
- No root README was added because product documentation scope was not part of
  this corrective security implementation.
