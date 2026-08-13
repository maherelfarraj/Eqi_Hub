# Phase 0F Stage 6B — Focused Security Corrective Implementation

Date: 2026-08-13 (Asia/Amman)

Baseline: GitHub `main` commit `730686d5412c9db5cd1247a7d76f8c1d1a178f71`

Workspace: isolated local branch `codex/phase-0f-stage6b-security-corrections`

Delivery status: implementation was completed and verified locally before the separately tracked GitHub delivery workflow

## Implemented scope

### Dependency security corrections

- Updated root API-generation tooling from `orval` 8.23 to 8.24.
- Updated the API-server manifest and workspace-wide override from `esbuild` 0.27.3 to 0.28.2.
- Added deterministic patched security floors:
  - `brace-expansion` 5.0.9
  - `fast-uri` 3.1.5
  - `js-yaml` 4.3.1
  - `nanoid` 3.3.18
- Updated worker `tsx` from 4.21.0 to 4.23.12, which updates its isolated esbuild dependency to 0.28.2.
- Regenerated both root and worker lockfiles while preserving `worker/pnpm-lock.yaml` setting `autoInstallPeers: true`.
- Preserved the intentional React and React DOM 19.1.0 pins and avoided all unrelated Dependabot major upgrades.

The `nanoid` floor was added after the local package audit detected a newly reported high-severity advisory through Vite/PostCSS that was absent from the earlier GitHub alert inventory.

### CodeQL defensive corrections

- Avatar handling:
  - allowlists GIF, JPEG, PNG, and WebP uploads;
  - rejects SVG and unrecognized MIME types;
  - validates stored avatar URLs, allowing HTTPS or same-origin HTTP only;
  - creates one object URL per selected file and revokes it during cleanup;
  - adds localized invalid-file feedback in English and Arabic.
- Base URL normalization:
  - replaces the trailing-slash regular expression with a linear character scan;
  - includes a large adversarial-input regression test.
- Mockup code generation:
  - allowlists characters and path segments before generating import source;
  - rejects traversal, absolute, hidden/internal, newline, quote, and non-TypeScript paths;
  - includes focused acceptance and rejection tests.

## Verification evidence

All checks completed successfully:

- root `pnpm install --frozen-lockfile`;
- root supply-chain lockfile policy verification;
- full root/library/artifact TypeScript verification;
- seven existing production web-server tests;
- seven new focused security regression tests;
- complete root build, including mockup sandbox, API server, and EquiVista frontend;
- worker `pnpm install --frozen-lockfile` with `autoInstallPeers: true`;
- worker typecheck;
- all 18 worker tests;
- worker build;
- root `pnpm audit --audit-level high`: no known vulnerabilities;
- worker `pnpm audit --audit-level high`: no known vulnerabilities;
- dependency tracing confirms only patched versions of the targeted packages;
- lockfile search finds none of `brace-expansion@5.0.8`, `fast-uri@3.1.4`, `js-yaml@4.3.0`, or `esbuild@0.27.x`;
- `git diff --check` passes.

## Expected GitHub effect after a separately authorized publication

The dependency changes are designed to resolve visible Dependabot alerts #1, #2, #3, #4, #5, and #7. The code changes are designed to remove or materially harden all three current CodeQL findings. Actual alert resolution must be confirmed by GitHub after publication and scanning; no alert was dismissed during this local phase.

Existing Dependabot PRs #27, #30, #35, and #36 should be evaluated for supersession only after a corrective PR is merged and GitHub confirms the alerts are closed. No Dependabot PR was modified or closed in Stage 6B.

## Closeout

Local implementation is complete and verified. A separate authorization is required to create a feature branch, stage files, commit, publish, create a PR, trigger a Supabase preview, modify alerts, or change GitHub settings.
