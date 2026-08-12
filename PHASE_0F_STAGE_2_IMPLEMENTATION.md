# Phase 0F Stage 2 — Frontend CI and Browser Security Headers

**Implementation date:** 2026-08-13  
**Status:** Implemented locally; not published or deployed.

## Scope

- Add a root/frontend GitHub Actions workflow.
- Add production browser-security headers to the existing Replit configuration.
- Preserve all existing Replit deployment, workflow, agent, and post-merge settings.

## Frontend CI

The `frontend-verify` job runs for relevant pull requests and pushes to `main`.
It uses Node.js 22 and pnpm 11.16.0 and performs:

1. Frozen-lockfile dependency installation.
2. Workspace TypeScript checks.
3. Workspace production builds.

`PORT=4173` and `BASE_PATH=/` are supplied because the production Vite
configuration validates both variables during configuration loading.

The check context is intentionally named `frontend-verify`. The existing
Worker and Supabase jobs already use `verify`, so reusing that name would make
required-check ownership ambiguous.

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

1. Publish the patch on a dedicated branch and open a draft PR.
2. Confirm the new `frontend-verify` check passes.
3. Verify branch protection requires the intended distinct checks.
4. Validate a preview for login, password recovery, Google Fonts, Supabase
   reads/writes, riding-video upload, playback, and Realtime behavior.
5. Redeploy Replit separately, then verify every header on the live domain.

No GitHub, Replit, Railway, or Supabase mutation is included in this local
implementation.
