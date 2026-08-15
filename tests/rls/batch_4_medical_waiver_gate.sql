-- Disposable Batch 4 persona/RLS acceptance fixture.
-- Run only on a Supabase preview branch after the canonical migrations.
begin;

-- The preview harness supplies these accepted persona UUIDs through psql vars:
-- :organization_id, :adult_rider_id, :minor_rider_id, :guardian_id,
-- :unrelated_guardian_id, :academy_admin_id.

do $$
begin
  -- Runtime assertions are intentionally named so failures are actionable.
  if not exists (
    select 1 from pg_trigger where tgname = 'lessons_require_compliance'
  ) then raise exception 'lesson booking bypassed compliance readiness'; end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'memberships_require_compliance'
  ) then raise exception 'membership renewal bypassed compliance readiness'; end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'compliance_signature_immutable'
  ) then raise exception 'signature receipt was mutable'; end if;
end;
$$;

-- Preview execution must additionally impersonate each JWT persona and prove:
-- 1. adult rider did not become lesson ready (failure if three current documents do not make them ready);
-- 2. minor rider signed without a verified legal guardian (must be rejected);
-- 3. unrelated guardian read restricted medical data (must return zero rows / 42501);
-- 4. expired waiver satisfied lesson readiness (must remain false);
-- 5. pending medical review satisfied renewal readiness (must remain false);
-- 6. lesson booking bypassed compliance readiness (must raise 23514);
-- 7. membership renewal bypassed compliance readiness (must raise 23514);
-- 8. signature receipt was mutable (update/delete must raise 42501).

rollback;
