# Phase 1 Stage 1 — Controlled Pilot Foundation

Date: 2026-08-13 (Asia/Amman)

## Outcome

This stage converts the canonical roadmap's controlled-pilot milestone into a repeatable, CI-validated operating package. It does not activate pilot accounts, transmit credentials, charge customers, or deploy application/database changes.

## Pilot boundary

The first cohort contains exactly one production account for each required persona:

- rider;
- parent/member (`guardian` database role);
- coach; and
- academy administrator.

Use Supabase user UUIDs as `account_ref` values in the ignored local file `pilot/phase1-pilot.json`. Do not commit names, email addresses, passwords, recovery links, access tokens, or API keys.

Create the activation manifest locally:

```sh
cp pilot/phase1-pilot.example.json pilot/phase1-pilot.json
```

Replace every placeholder, change `status` to `ready`, and validate it:

```sh
node scripts/verify-phase1-pilot-readiness.mjs pilot/phase1-pilot.json
```

## Acceptance matrix

| Journey                     | Rider    | Parent/guardian             | Coach                          | Academy admin               | Minimum evidence                                            |
| --------------------------- | -------- | --------------------------- | ------------------------------ | --------------------------- | ----------------------------------------------------------- |
| Authentication and session  | Required | Required                    | Required                       | Required                    | Sign-in, refresh, recovery, sign-out                        |
| Rider and horse records     | Required | Required, linked rider only | Required, assigned riders only | Required, organization only | Authorized success plus cross-tenant denial                 |
| Lessons                     | Required | Required, linked rider only | Required, assigned lessons     | Required                    | Schedule, conflict, attendance, cancellation                |
| Progress                    | Required | Required, linked rider only | Required, assigned riders only | Observe                     | Role-appropriate visibility and updates                     |
| Membership                  | Required | Observe                     | Not required                   | Required                    | Lifecycle without live payment capture                      |
| AI analysis                 | Required | Observe                     | Required                       | Observe                     | Riding success, non-riding rejection, timing, quality, cost |
| Organization administration | No       | No                          | No                             | Required                    | Member/role change plus audit evidence                      |
| Notifications               | Observe  | Required                    | Required                       | Required                    | Delivery, preference, suppression, failure handling         |

Any unexpected cross-tenant or cross-persona access is a stop condition, not a minor defect.

## Operating rhythm

1. Pilot owner opens the test window and records the deployed commit.
2. Monitoring owner confirms frontend, Supabase, Railway API, and Worker health.
3. Each persona runs only the journeys assigned in the activation manifest.
4. Support owner records user-visible failures and feedback without credentials or unnecessary personal data.
5. Incident owner triages stop conditions immediately.
6. Pilot owner closes the window, records metrics, and makes a continue/hold decision.

## Metrics and exit criteria

- journey success rate is at least the manifest threshold;
- application error rate stays at or below the manifest threshold;
- riding-video processing stays within the time and cost ceilings;
- all four required personas provide acceptance evidence;
- no unresolved critical/high security or tenancy defect remains;
- support, monitoring, incident, feedback, and rollback ownership is explicit.

Stage 1 is complete when the repository foundation passes CI. Pilot activation is a later production operation and requires a fully populated local activation manifest and a named test window.

## Incident and rollback

Immediately stop new pilot activity for cross-tenant exposure, authentication outage, sustained error rate above threshold, uncontrolled analysis cost, or materially unsafe AI guidance.

Preserve evidence; disable only the affected workflow; notify incident and rollback owners; restore the last known-good application/worker/database state using the existing platform runbooks; and require fresh acceptance evidence before resuming. Do not delete failed analyses, audit events, or operational evidence during triage.

## Verification commands

```sh
pnpm verify:pilot
pnpm test:pilot
pnpm typecheck
pnpm build
```

Frontend CI runs the template validator and negative tests on every relevant pull request and protected-branch push.
