# Phase 1 Stage 3 — Pilot Persona Activation Closeout

Date: 2026-08-13 (Asia/Amman)

## Outcome

The authorized production persona provisioning is complete. One confirmed Auth account was selected as the guardian and the sole existing rider profile without an active organization scope was selected as the distinct pilot rider. The guarded transaction created the missing guardian profile, activated guardian and rider memberships, assigned authoritative organization roles, linked guardian to rider, linked coach to rider, and assigned rider horse access. No schema, deployment, credential, or Auth-password change was made.

The PII-minimized production preflight now returns **READY**. Four distinct active users cover `academy_admin`, `coach`, `guardian`, and `rider`; one active guardian–rider link, two active coach–rider links, and four active horse-access assignments are present.

This closes persona provisioning. It does **not** authorize unrestricted commercial launch or claim that the complete four-persona browser acceptance matrix has passed.

## Guardrails and auditability

- Every identity and organization candidate had to resolve uniquely before writes began.
- Guardian, rider, coach, and administrator were asserted to be four distinct Auth users.
- All writes ran in one transaction and were rechecked before commit.
- Existing roles were preserved; only the authorized `guardian` and `rider` roles were added.
- Two platform audit events record the membership provisioning without publishing email addresses or account UUIDs.
- The production snapshot remains in the ignored `pilot/phase1-production-preflight.json` file and is not committed.

The guardian profile uses the legacy compatibility value `owner` because `profiles.role` predates organization RBAC and accepts only `rider`, `trainer`, `owner`, or `admin`. Authorization uses the active organization membership and the authoritative `guardian` organization role.

## RLS verification

Production impersonation checks were executed with `authenticated` and the guardian and rider Auth subjects:

- each persona could read exactly its own active membership and organization role;
- each persona could read exactly its own profile;
- the guardian could read the single authorized guardian–rider relationship;
- the rider could read the guardian relationship, coach assignment, and rider horse-access assignment; and
- neither persona received administrator-wide membership or role visibility.

The checks also documented a product gap: existing `horses` and `video_analyses` policies do not derive guardian access from `guardian_riders`, and horse visibility still uses the legacy `horse_riders` relation rather than `horse_access_assignments`. A production legacy horse link was not added because it was outside the approved mutation set. These are acceptance blockers for the guardian and rider browser journeys, not failures of the newly provisioned organization-role boundaries.

## READY preflight evidence

The fresh production snapshot observed:

- 7 Auth users, all confirmed;
- 4 application profiles;
- 4 active organization memberships;
- 4 distinct users covering the four required pilot roles;
- 1 academy administrator, 1 coach, 1 guardian, and 2 users carrying a rider role;
- 1 active guardian–rider link;
- 2 active coach–rider links; and
- 4 active horse-access assignments.

`node scripts/verify-phase1-pilot-preflight.mjs pilot/phase1-production-preflight.json` returned READY.

## Next controlled stage

Before opening the named pilot window:

1. implement and test guardian-derived read policies for the intended linked-rider records;
2. reconcile the canonical horse-access model with the legacy `horse_riders` visibility helper;
3. populate the ignored activation manifest with named owners and evidence locations; and
4. run the four-persona browser acceptance matrix for horse, rider, lesson, progress, membership, notifications, and AI-analysis journeys.

Unrestricted commercial launch remains on hold for the roadmap's payment-provider and legal gates.

## Verification

```sh
pnpm verify:pilot
pnpm test:pilot
pnpm typecheck
pnpm build
```
