-- Guarded Batch 4 rollback. Never discard medical declarations or signatures.
begin;

do $$
begin
  if exists (select 1 from public.compliance_signature_receipts limit 1)
    or exists (select 1 from public.rider_compliance_submissions limit 1)
    or exists (select 1 from public.rider_safety_profiles limit 1)
  then
    raise exception 'Batch 4 rollback refused: compliance evidence exists';
  end if;
end;
$$;

drop trigger if exists memberships_require_compliance on public.memberships;
drop trigger if exists lessons_require_compliance on public.lessons;
drop trigger if exists compliance_audit_immutable on public.compliance_audit_events;
drop trigger if exists compliance_signature_immutable on public.compliance_signature_receipts;
drop trigger if exists organizations_seed_compliance_templates on public.organizations;

drop function if exists private.seed_compliance_templates_after_organization_insert();
drop function if exists private.seed_default_compliance_templates(uuid);
drop function if exists private.enforce_membership_compliance();
drop function if exists private.enforce_lesson_compliance();
drop function if exists public.get_compliance_admin_summary(uuid);
drop function if exists public.get_rider_compliance_portal(uuid, uuid);
drop function if exists public.review_medical_declaration(uuid, text, text);
drop function if exists public.sign_compliance_document(uuid, uuid, uuid, jsonb, text, text);
drop function if exists public.set_rider_safety_profile(uuid, uuid, date);
drop function if exists private.get_compliance_admin_summary_impl(uuid);
drop function if exists private.get_rider_compliance_portal_impl(uuid, uuid);
drop function if exists private.review_medical_declaration_impl(uuid, text, text);
drop function if exists private.sign_compliance_document_impl(uuid, uuid, uuid, jsonb, text, text);
drop function if exists private.set_rider_safety_profile_impl(uuid, uuid, date);
drop function if exists private.reject_compliance_mutation();

drop table if exists public.compliance_audit_events;
drop table if exists public.compliance_signature_receipts;
drop table if exists public.rider_compliance_submissions;
drop table if exists public.compliance_document_templates;
drop table if exists public.rider_safety_profiles;

drop function if exists private.rider_compliance_ready(uuid, uuid, text, timestamptz);
drop function if exists private.rider_is_minor(uuid, uuid, date);
drop function if exists private.can_read_rider_compliance(uuid, uuid);
drop function if exists private.can_manage_compliance(uuid);

commit;
