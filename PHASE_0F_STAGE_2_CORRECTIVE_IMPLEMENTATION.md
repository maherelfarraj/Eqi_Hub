# Phase 0F Stage 2 — Corrective Header-Serving Implementation

**Implementation date:** 2026-08-13  
**Status:** Implemented and tested locally; not published or deployed.

## Trigger

Replit deployment `0a88c3b3-891e-4a70-b029-195c991d9b0b` successfully
published GitHub `main` commit `88f296f89945978c084abe9921f1121d823c8605`,
but live verification found that the five security headers were absent.

The root deployment uses `deploymentTarget = "autoscale"` with the application
router. Replit's `deployment.responseHeaders` configuration applies to Static
Deployments, not to artifact-level static serving inside this autoscale
architecture. HSTS continued to be injected by the Replit edge.

## Corrective implementation

- Replace the EquiVista artifact's infrastructure-level static serving with a
  dependency-free Node HTTP process.
- Set CSP, anti-framing, MIME-sniffing, referrer, and permissions-policy headers
  on every response, including errors.
- Preserve SPA route fallback while returning a real `404` for missing assets.
- Support `GET` and `HEAD`; reject other methods with `405`.
- Prevent decoded path traversal and canonical-path escape.
- Preserve correct MIME types and immutable caching for hashed assets.
- Add an artifact startup health check on `/`.
- Remove the ineffective autoscale `deployment.responseHeaders` entries.
- Add the server test suite to `frontend-verify`.

No new runtime dependency is introduced.

## Local validation

The focused Node test suite verifies:

1. All five security headers on the application shell.
2. Header presence and empty body for `HEAD`.
3. MIME and immutable caching for hashed assets.
4. SPA fallback for extensionless routes.
5. A real `404` for missing assets.
6. `405` handling for unsupported methods.
7. Encoded traversal paths cannot escape the public directory.

## Remaining rollout gates

1. Publish the corrective files on a dedicated branch.
2. Open a draft PR and confirm `verify` plus `frontend-verify` pass.
3. Review the artifact configuration and server implementation.
4. Squash-merge under separate authorization.
5. Synchronize Replit to the resulting `main` commit and republish separately.
6. Verify the five headers on `/`, an SPA route, an asset, a missing asset, and
   a rejected method; also verify HSTS and core application availability.

Production is currently healthy but the five-header acceptance gate remains
open until that final live verification passes.
