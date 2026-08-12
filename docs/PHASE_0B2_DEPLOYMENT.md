# Phase 0B.2 — organization operations deployment

## Scope

Phase 0B.2 keeps the Phase 0B.1 foundation live and adds its missing operational
layer:

- active organization context in the EquiVista shell;
- an organization screen for membership and role visibility;
- platform-admin-only organization creation;
- academy-admin member management with explicit role boundaries;
- append-only audit events for organization and member changes;
- one missing composite foreign-key index;
- English and Arabic UI copy.

It does **not** create a production organization, assign a platform admin,
backfill legacy business rows, or alter membership/payment behavior.

## Security boundary

PostgREST exposes only `SECURITY INVOKER` functions in `public`. Each delegates
to a fixed-search-path implementation in `private`. The private implementation
derives identity from `auth.uid()`, checks platform or organization authority,
validates every role/status, prevents academy admins from changing themselves
or other academy admins, preserves a last active academy admin, and writes an
audit event in the same transaction.

Direct browser writes to Phase 0B.1 tables remain denied.

## Review and staging sequence

1. Apply Phase 0A.2 and Phase 0B.1 to a disposable Supabase branch.
2. Apply `20260812081411_phase_0b2_organization_operations.sql`.
3. Run `tests/rls/phase_0b1_personas.sql`.
4. Run `tests/rls/phase_0b2_personas.sql`.
5. Run Security and Performance Advisors.
6. Run frontend TypeScript and production builds.
7. Apply the Phase 0B.2 rollback.
8. Verify all organization/member/audit rows remain present and only the RPCs
   and Phase 0B.2 index are absent.
9. Reapply Phase 0B.2 and rerun both persona suites.

## Production checkpoint

Production requires a separate explicit approval after the staging round trip.
After deployment, the existing app remains in legacy mode until a platform role
and organization are deliberately adopted. No bootstrap data is included in the
migration.

## Post-deployment smoke

- signed-in legacy user sees the existing nine-route application unchanged;
- organization navigation appears only for a platform admin or organization
  member;
- organization selection survives refresh and is revalidated against active
  membership;
- unauthorized users cannot list or manage organization members;
- authorized changes appear in `audit_events` without tokens or secrets;
- upload, Railway processing, signed playback, Membership, Payments, and Billing
  remain operational.
