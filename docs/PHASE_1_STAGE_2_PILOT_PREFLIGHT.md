# Phase 1 Stage 2 — Pilot Activation Preflight and Evidence Gate

Date: 2026-08-13 (Asia/Amman)

## Outcome

Stage 2 adds a fail-closed, reusable production preflight for the controlled academy pilot. The check aggregates Auth, profile, organization-role, and assignment coverage without returning names or email addresses. It does not create users, assign roles, link family members, deploy code, or mutate production data.

## Read-only production observation

The 2026-08-13 production preflight found:

- 7 Auth users, all confirmed;
- 3 application profiles;
- 2 active organization memberships;
- 2 distinct users holding required pilot roles;
- active `academy_admin`, `coach`, and `rider` role coverage;
- no active `guardian` role coverage;
- one active coach–rider assignment;
- no active guardian–rider assignment;
- three active horse-access assignments; and
- 14 organization-scoped video analyses: 13 analyzed and one rejected/failed.

Result: **HOLD**. The repository and production services are healthy, but the controlled pilot cannot start until one distinct parent/member account has an active `guardian` organization role and an active link to the pilot rider. Four distinct active pilot members must be present in one organization.

## Generate a fresh snapshot

Run `pilot/sql/phase1-production-preflight.sql` through an authorized read-only Supabase SQL connection. Save only its JSON result to the ignored file:

```text
pilot/phase1-production-preflight.json
```

Then run:

```sh
node scripts/verify-phase1-pilot-preflight.mjs pilot/phase1-production-preflight.json
```

Exit status `0` means READY, `1` means HOLD, and `2` means the snapshot is invalid. A HOLD must never be bypassed by editing counts or reusing one account for multiple personas.

## Activation boundary

Before the pilot window opens:

1. select or create one real parent/member Auth account through the approved identity process;
2. create its application profile if absent;
3. activate membership in the same organization as the rider;
4. assign the `guardian` organization role;
5. create the active guardian–rider link;
6. generate a fresh preflight snapshot and require READY;
7. populate the ignored `pilot/phase1-pilot.json` with four distinct account UUIDs and evidence locations; and
8. execute the Stage 1 acceptance matrix in a named test window.

Do not commit names, emails, UUID-bearing production snapshots, passwords, recovery links, session tokens, or service credentials.

## Verification

```sh
pnpm verify:pilot
pnpm test:pilot
pnpm typecheck
pnpm build
```

The preflight follows current Supabase security guidance: authorization uses database roles and relationships, not editable `user_metadata`; RLS remains the enforcement layer; and this stage introduces no table or Data API grant changes.
