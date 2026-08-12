# Phase 0B.1 — Tenancy and multi-role RBAC foundation

Status: development-branch review only. Production deployment requires a
separate approval after migration, rollback, RLS, frontend, and smoke checks.

## Compatibility contract

- `profiles` and `notification_prefs` remain global identity records.
- `profiles.role` remains the v1 compatibility role; it is neither rewritten
  nor used as the new organization authorization source.
- `platform_role_assignments` contains only `platform_admin`.
- Organization roles are attached to `organization_memberships` and support
  multiple roles per user.
- Existing business rows remain valid with `organization_id = null`.
- New tenant-scoped business rows must satisfy same-organization foreign keys.
- New authorization, relationship, audit, and notification tables are
  browser-read-only. Writes require `service_role` or a future protected
  server endpoint.
- `audit_events` is append-only by privilege design. It must never contain
  passwords, tokens, national IDs, full payment payloads, or other secrets.

## New tables

- `organizations`
- `platform_role_assignments`
- `organization_memberships`
- `organization_member_roles`
- `guardian_riders`
- `coach_rider_assignments`
- `horse_access_assignments`
- `audit_events`
- `notification_outbox`

## Tenant keys added without backfill

- `horses.organization_id`
- `video_analyses.organization_id`
- `lessons.organization_id`
- `membership_plans.organization_id`
- `memberships.organization_id`
- `invoices.organization_id`

Child records continue to inherit tenancy through their parent. No tenant key
is added indiscriminately to `profiles`, `notification_prefs`, `horse_riders`,
`training_log`, `health_records`, `documents`, or `invoice_lines`.

## Development-branch sequence

1. Create a fresh Supabase development branch from production.
2. If the branch does not contain the canonical schema because of historical
   migration drift, apply `tests/fixtures/phase_0a2_branch_baseline.sql`.
3. Apply `supabase/migrations/20260812062006_phase_0a2_security_hotfix.sql`.
4. Apply `supabase/migrations/20260812075717_phase_0b1_tenancy_rbac_foundation.sql`.
5. Run `tests/rls/phase_0a2_personas.sql`.
6. Run `tests/rls/phase_0b1_personas.sql`.
7. Capture security and performance advisors.
8. Run the frontend TypeScript check and production build.
9. Run the rollback file. Confirm the Phase 0B.1 objects and tenant keys are
   gone while Phase 0A.2 remains intact.
10. Reapply the Phase 0B.1 migration and rerun both persona suites.

## Acceptance gates

- No canonical row is deleted or rewritten.
- All existing rows retain `organization_id = null`.
- All nine new tables have RLS enabled and explicit API grants.
- `anon` has no privileges on new tables.
- `authenticated` has `SELECT` only and remains constrained by RLS.
- `service_role` retains the write boundary.
- Global and organization roles cannot be mixed.
- Cross-tenant guardian, coach, horse, lesson, analysis, membership, and
  invoice relationships are rejected by foreign keys.
- Rider, coach, guardian, academy-admin, platform-admin, and other-tenant
  persona tests pass.
- Legacy `rider`, `trainer`, `owner`, and `admin` sessions still load.
- The frontend reads additive roles but falls back to `profiles.role` if the
  new tables are unavailable or empty.
- TypeScript and production builds pass.
- Security Advisor has no new errors from Phase 0B.1.
- Upload, Railway processing, signed playback, Membership, Payments, and
  Billing continue to work unchanged.

## Production checkpoint

Do not merge a Supabase development branch or apply the SQL to production
until the review diff, round-trip evidence, advisor output, and smoke results
receive explicit approval.
