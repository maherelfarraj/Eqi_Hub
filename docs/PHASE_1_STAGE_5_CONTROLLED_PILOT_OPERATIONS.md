# Phase 1 Stage 5 — Controlled Pilot Operations

Date: 2026-08-14 (Asia/Amman)

## Boundary

Stage 5 opens one named, controlled four-persona acceptance window for the
existing EquiVista production academy. It does not open registration, capture
live payments, widen the cohort, transmit credentials, or authorize
unrestricted commercial launch.

The ignored `pilot/phase1-pilot.json` manifest contains production account
references and names the pilot, support, monitoring, incident, and rollback
owners. It must validate before the window opens and must never be committed.

## Production finding and correction

The read-only preflight was READY. Production impersonation then showed that
the coach could read two active assignments and four lessons but only their own
profile, while the academy administrator could read all four memberships but
only two profiles. This blocks role-appropriate member and lesson rendering.

Migration `20260813222839_phase1_stage5_pilot_profile_access` changes only the
`profiles_select_authorized` SELECT policy. It adds:

- assigned-rider profile reads for an active coach assignment and active coach
  role; and
- active organization-member profile reads for academy administrators and
  stable managers.

Guardian and rider behavior is preserved. Profile insert, update, and delete
permissions are unchanged. The paired rollback restores the Stage 4 policy.

## Window gates

1. Replay every canonical migration on one disposable preview.
2. Run rider, guardian, coach, academy-admin, and unaffiliated RLS checks.
3. Require zero security-advisor findings and passing repository CI.
4. Apply only the approved Stage 5 migration to production.
5. Perform read-only production verification before browser acceptance.
6. Exercise authentication, records, lessons, progress, membership,
   AI-analysis visibility, organization administration, and notifications.
7. Stop immediately for cross-tenant exposure, authentication outage,
   sustained error rate above 5%, uncontrolled analysis cost, or unsafe AI
   guidance.

## Acceptance thresholds

- journey success rate: at least 95%;
- application error rate: at most 5%;
- analysis processing time: at most 10 minutes;
- analysis cost: at most USD 2;
- feedback responses: at least four.

The pilot owner records a continue/hold decision after evidence review.
Unrestricted launch remains on hold regardless of the Stage 5 outcome.
