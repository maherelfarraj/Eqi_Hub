# Batch 5 — Controlled Pilot Observation and Exit Review

Date: 2026-08-15 (Asia/Amman)

## Goal

Batch 5 operates Phase 1 Stage 6 for seven consecutive calendar days. It proves
that the accepted four-persona production pilot remains reliable under routine,
repeat use before EquiVista adds another major product workflow.

The observation window is 2026-08-16 through 2026-08-22. The cohort remains
limited to one rider, one guardian, one coach, and one academy administrator.

## Daily evidence

Each day records:

- public availability for `/auth` and `/safety`, plus required security
  headers;
- authenticated rider, guardian, coach, and academy-admin journey results;
- journey success and application error rates;
- maximum observed video-processing duration and estimated provider cost;
- completed riding analyses and correctly rejected non-riding submissions;
- support events, incidents, and private evidence references.

The committed example manifest contains no credentials, account identifiers,
email addresses, names, medical answers, or other personal data. The populated
production register must remain outside source control.

## Thresholds

- journey success rate: at least 95% every day;
- application error rate: at most 5% every day;
- video-processing time: at most 10 minutes;
- estimated provider cost: at most USD 2 per analysis;
- at least three completed riding analyses across the window;
- at least one confirmed non-riding rejection;
- no unresolved P0 or P1 incident;
- no open exit blocker.

A cross-tenant read, authentication outage, unsafe AI guidance, uncontrolled
cost, failed compliance boundary, or unresolved P0/P1 incident stops the pilot
and forces a HOLD decision.

## Automation boundary

`.github/workflows/batch5-pilot-observation.yml` runs daily and on demand. It
performs read-only public checks against `www.equivista.net`; it never signs
in, stores credentials, mutates production, or claims persona acceptance.
Authenticated persona checks remain controlled human/browser evidence.

## Exit decision

At the end of day seven, the pilot owner records exactly one decision:

- **CONTINUE** — all thresholds pass and there are no open blockers;
- **EXTEND** — evidence is incomplete but no stop condition occurred;
- **HOLD** — a threshold, security boundary, or stop condition failed.

The validator fails closed: a completed manifest cannot pass without seven
consecutive days, every required public/persona check, minimum AI evidence, and
a blocker-free exit review.

## Acceptance commands

```bash
node scripts/verify-phase1-stage6-observation.mjs \
  --template pilot/phase1-stage6-observation.example.json
node --test scripts/test-phase1-stage6-observation.mjs
```

The root `verify:pilot` and `test:pilot` commands include these gates.

## Exclusions

Batch 5 does not widen registration or the cohort, enable payments, change
medical data, authorize unrestricted AI instructions, or approve commercial
launch. It introduces no database migration and makes no production data
change.

## Final exit review — 2026-08-22

**Decision: CONTINUE**

The seven-day observation window is accepted and closed. No unresolved P0/P1
incident, cross-tenant exposure, authentication outage, compliance-boundary
failure, or other exit blocker remained at the final review.

Final acceptance evidence:

- authenticated Rider, Guardian, Coach, and Academy Administrator smoke journeys
  passed in production;
- role-specific navigation and access boundaries matched the accepted portal
  design;
- Guardian access resolved only the verified linked rider and retained the
  approved financial-visibility boundary;
- Coach access resolved the active assigned rider without exposing Guardian or
  Safety navigation;
- Academy Administrator routes and member-management visibility loaded without
  application-origin browser errors;
- the production custom domain and SPA routes `/`, `/auth`, `/safety`,
  `/payments`, and `/billing` returned HTTP 200;
- the deployed bundle referenced the intended production Supabase project and
  exposed no service-role or secret-key marker;
- `main` remained identical to accepted merge commit
  `3a87942b8f3c1f9add82645f086ff6e618e46f1c`, with successful Railway commit
  statuses;
- the Supabase Security Advisor returned zero findings;
- the Supabase Performance Advisor returned 47 INFO notices only: 46 unused
  index observations and one database-connection sizing observation;
- the final API sample contained 100 successful responses (99 HTTP 200 and one
  HTTP 204) with no API errors.

The log review also identified test-generated and resolved events from the
acceptance procedure: rejected invalid-password attempts, one transient Auth
timeout followed by successful requests, one rolled-back setup query error, and
one Guardian access denial observed before the test-data role correction. None
remained an open production issue.

Temporary-account retirement is intentionally recorded separately after
action-time confirmation. Until that confirmation is received, this review does
not claim that relationships, sessions, memberships, or Auth users were removed.
