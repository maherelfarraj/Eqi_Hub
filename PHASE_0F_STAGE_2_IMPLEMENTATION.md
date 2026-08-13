# Phase 0F Stage 2 — Frontend CI and Browser Security Headers

**Implementation date:** 2026-08-13  
**Status:** Published in draft PR #22; not merged or deployed.

## Scope

- Add a root/frontend GitHub Actions workflow.
- Add production browser-security headers to the existing Replit configuration.
- Preserve all existing Replit deployment, workflow, agent, and post-merge settings.

## Frontend CI

The `frontend-verify` job runs for every pull request and for relevant pushes
to `main`.
It uses Node.js 22 and pnpm 11.16.0 and performs:

1. Frozen-lockfile dependency installation.
2. Workspace TypeScript checks.
3. Workspace production builds.

`PORT=4173` and `BASE_PATH=/` are supplied because the production Vite
configuration validates both variables during configuration loading.

The check context is intentionally named `frontend-verify`. The existing
Worker and Supabase jobs already use `verify`, so reusing that name would make
required-check ownership ambiguous.

The pull-request trigger intentionally has no path filter. GitHub leaves a
required workflow skipped by path filtering in a pending state, which would
block unrelated pull requests after `frontend-verify` becomes required. The
push-to-`main` trigger remains path-scoped to avoid unnecessary duplicate runs.

The repository does not currently define root lint or test scripts. Adding
those quality gates is follow-up product-engineering work and is not simulated
by this workflow.

## Browser security headers

The existing `.replit` configuration is extended with:

- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- A restrictive `Permissions-Policy`

The CSP permits the application itself, Google Fonts, the EquiVista Supabase
custom domain, Supabase project domains, signed HTTPS images/video, and blob
URLs used for browser media handling. It blocks plugins, framing, and foreign
form submissions.

Replit already supplies HSTS in production, so the patch does not duplicate
provider-managed HSTS configuration.

## Publication and rollout gates

Before production deployment:

1. Confirm the corrected `frontend-verify` check passes on draft PR #22.
2. Verify branch protection requires the intended distinct checks.
3. Validate a Replit preview for login, password recovery, Google Fonts, Supabase
   reads/writes, riding-video upload, playback, and Realtime behavior.
4. Redeploy Replit separately, then verify every header on the live domain.

Supabase ignored PR #22 because it contains no `supabase/**` changes, so no
paid Supabase preview branch was created. Publishing this correction changes
only the existing GitHub feature branch; it does not mutate Replit, Railway,
Supabase, or production.
