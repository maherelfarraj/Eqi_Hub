# Batch 4 — Digital medical, waiver, and consent gate

Batch 4 makes current, version-matched safety documents a prerequisite for a
new lesson booking or active membership renewal. It does not provide medical
advice, replace emergency services, or enable payments.

## Document lifecycle

Each organization receives an active version of the medical/safety
declaration, riding liability waiver, and emergency-treatment consent. Every
signature binds to the exact bilingual document hash and consent hash. A later
template version requires a new signature; an older signature cannot satisfy
the readiness gate.

An adult rider signs their own documents. A rider under 18 requires an active,
verified guardian relationship with recorded legal authority. Missing date of
birth is treated as not ready, not as adult.

## Medical boundary

Medical answers are stored separately from profiles, lessons, RiderSync, and
Guardian View. Only the rider, their verified guardian, academy safety staff,
or a platform administrator may read them. Coaches do not receive medical
answers through the rider-development or Guardian View payloads.

A declaration that explicitly reports medical attention is required enters a
staff-review state. It does not satisfy lesson or renewal readiness until an
authorized academy administrator approves it. Rejection remains auditable and
requires a fresh declaration.

## Fail-closed gates

- Missing date of birth: blocked.
- Missing active template signature: blocked.
- Wrong template version or hash: blocked.
- Expired signature: blocked.
- Minor self-signature or unverified guardian: blocked.
- Pending/rejected medical review: blocked.
- New pending/confirmed lesson while not ready: blocked.
- New activation or renewal while not ready: blocked.

Existing lessons and memberships are not rewritten. The gates run when a
future lesson is inserted or its rider/date/status changes, and when a
membership is activated or its renewal date changes.

## Security and rollback

All five public tables have RLS and explicit authenticated `SELECT` grants;
writes occur only through guarded RPCs. Signature receipts and audit events are
append-only. The rollback refuses to delete the Batch 4 domain after any rider
profile, declaration, or signature evidence exists.

## Acceptance

- Static verifier: `node scripts/verify-medical-waiver-gate.mjs`
- Verifier tests: `node --test scripts/test-medical-waiver-gate.mjs`
- Disposable persona/RLS fixture: `tests/rls/batch_4_medical_waiver_gate.sql`
- Frontend state guards: included in the frontend `test:server` command
