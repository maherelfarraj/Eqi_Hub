-- Disposable Batch 4 persona/RLS acceptance. All fixtures roll back.
begin;

set local statement_timeout = '30s';
set local lock_timeout = '5s';

insert into auth.users (id, email, raw_user_meta_data)
values
  ('15000000-0000-4000-8000-000000000001', 'batch4-admin@example.invalid', '{"full_name":"Batch 4 Admin"}'::jsonb),
  ('15000000-0000-4000-8000-000000000002', 'batch4-adult@example.invalid', '{"full_name":"Batch 4 Adult"}'::jsonb),
  ('15000000-0000-4000-8000-000000000003', 'batch4-minor@example.invalid', '{"full_name":"Batch 4 Minor"}'::jsonb),
  ('15000000-0000-4000-8000-000000000004', 'batch4-guardian@example.invalid', '{"full_name":"Batch 4 Guardian"}'::jsonb),
  ('15000000-0000-4000-8000-000000000005', 'batch4-unrelated@example.invalid', '{"full_name":"Batch 4 Unrelated"}'::jsonb);

insert into public.organizations (id, name, slug, organization_type)
values ('25000000-0000-4000-8000-000000000001', 'Batch 4 Safety Academy', 'batch-4-safety-academy', 'academy');

do $templates$
begin
  if (select count(*) from public.compliance_document_templates
      where organization_id = '25000000-0000-4000-8000-000000000001' and active) <> 3 then
    raise exception 'future organization did not receive three compliance templates';
  end if;
end
$templates$;

insert into public.organization_memberships (id, organization_id, user_id, status)
values
  ('35000000-0000-4000-8000-000000000001', '25000000-0000-4000-8000-000000000001', '15000000-0000-4000-8000-000000000001', 'active'),
  ('35000000-0000-4000-8000-000000000002', '25000000-0000-4000-8000-000000000001', '15000000-0000-4000-8000-000000000002', 'active'),
  ('35000000-0000-4000-8000-000000000003', '25000000-0000-4000-8000-000000000001', '15000000-0000-4000-8000-000000000003', 'active'),
  ('35000000-0000-4000-8000-000000000004', '25000000-0000-4000-8000-000000000001', '15000000-0000-4000-8000-000000000004', 'active'),
  ('35000000-0000-4000-8000-000000000005', '25000000-0000-4000-8000-000000000001', '15000000-0000-4000-8000-000000000005', 'active');

insert into public.organization_member_roles (membership_id, role)
values
  ('35000000-0000-4000-8000-000000000001', 'academy_admin'),
  ('35000000-0000-4000-8000-000000000002', 'rider'),
  ('35000000-0000-4000-8000-000000000003', 'rider'),
  ('35000000-0000-4000-8000-000000000004', 'guardian'),
  ('35000000-0000-4000-8000-000000000005', 'guardian');

insert into public.guardian_riders (
  organization_id, guardian_id, rider_id, active, relationship_type,
  legal_authority, verification_status, verified_at, adulthood_review_on, created_by
) values (
  '25000000-0000-4000-8000-000000000001', '15000000-0000-4000-8000-000000000004',
  '15000000-0000-4000-8000-000000000003', true, 'parent', true, 'verified', now(),
  current_date + 365, '15000000-0000-4000-8000-000000000001'
);

select set_config('request.jwt.claims', json_build_object('sub', '15000000-0000-4000-8000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.set_rider_safety_profile('25000000-0000-4000-8000-000000000001', '15000000-0000-4000-8000-000000000002', (current_date - interval '25 years')::date);
select public.set_rider_safety_profile('25000000-0000-4000-8000-000000000001', '15000000-0000-4000-8000-000000000003', (current_date - interval '12 years')::date);

reset role;
select set_config('request.jwt.claims', json_build_object('sub', '15000000-0000-4000-8000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;
do $adult$
declare template record; portal jsonb;
begin
  for template in select id, document_type, consent_hash from public.compliance_document_templates
    where organization_id = '25000000-0000-4000-8000-000000000001' and active
  loop
    perform public.sign_compliance_document(
      '25000000-0000-4000-8000-000000000001', '15000000-0000-4000-8000-000000000002',
      template.id, jsonb_build_object('medical_attention_required', false),
      'Batch 4 Adult', template.consent_hash
    );
  end loop;
  portal := public.get_rider_compliance_portal('25000000-0000-4000-8000-000000000001', '15000000-0000-4000-8000-000000000002');
  if not (portal ->> 'lesson_ready')::boolean then raise exception 'adult rider did not become lesson ready'; end if;
end
$adult$;

reset role;
select set_config('request.jwt.claims', json_build_object('sub', '15000000-0000-4000-8000-000000000003', 'role', 'authenticated')::text, true);
set local role authenticated;
do $minor_self_signature$
declare template record;
begin
  select id, consent_hash into template from public.compliance_document_templates
  where organization_id = '25000000-0000-4000-8000-000000000001' order by document_type limit 1;
  begin
    perform public.sign_compliance_document(
      '25000000-0000-4000-8000-000000000001', '15000000-0000-4000-8000-000000000003',
      template.id, '{}'::jsonb, 'Batch 4 Minor', template.consent_hash
    );
    raise exception 'minor rider signed without a verified legal guardian';
  exception when insufficient_privilege then null;
  end;
end
$minor_self_signature$;

reset role;
select set_config('request.jwt.claims', json_build_object('sub', '15000000-0000-4000-8000-000000000004', 'role', 'authenticated')::text, true);
set local role authenticated;
do $guardian$
declare template record;
begin
  for template in select id, document_type, consent_hash from public.compliance_document_templates
    where organization_id = '25000000-0000-4000-8000-000000000001' and active
  loop
    perform public.sign_compliance_document(
      '25000000-0000-4000-8000-000000000001', '15000000-0000-4000-8000-000000000003',
      template.id, jsonb_build_object('medical_attention_required', template.document_type = 'medical_safety'),
      'Batch 4 Guardian', template.consent_hash
    );
  end loop;
  if (public.get_rider_compliance_portal('25000000-0000-4000-8000-000000000001', '15000000-0000-4000-8000-000000000003') ->> 'lesson_ready')::boolean then
    raise exception 'pending medical review satisfied renewal readiness';
  end if;
end
$guardian$;

reset role;
select set_config('request.jwt.claims', json_build_object('sub', '15000000-0000-4000-8000-000000000005', 'role', 'authenticated')::text, true);
set local role authenticated;
do $unrelated$
begin
  if exists (select 1 from public.rider_compliance_submissions where rider_id = '15000000-0000-4000-8000-000000000003') then
    raise exception 'unrelated guardian read restricted medical data';
  end if;
end
$unrelated$;

reset role;
select set_config('request.jwt.claims', json_build_object('sub', '15000000-0000-4000-8000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;
do $admin_review$
declare submission uuid;
begin
  select id into strict submission from public.rider_compliance_submissions
  where rider_id = '15000000-0000-4000-8000-000000000003' and document_type = 'medical_safety' and status = 'signed';
  perform public.review_medical_declaration(submission, 'approved', null);
  if not (public.get_rider_compliance_portal('25000000-0000-4000-8000-000000000001', '15000000-0000-4000-8000-000000000003') ->> 'renewal_ready')::boolean then
    raise exception 'guardian signatures did not make minor ready after approval';
  end if;
end
$admin_review$;

reset role;
update public.rider_compliance_submissions
set valid_from = now() - interval '2 years', valid_until = now() - interval '1 day'
where rider_id = '15000000-0000-4000-8000-000000000002' and document_type = 'liability_waiver' and status = 'signed';

do $expiry_and_gates$
declare portal jsonb;
begin
  portal := private.get_rider_compliance_portal_impl('25000000-0000-4000-8000-000000000001', '15000000-0000-4000-8000-000000000002');
  if (portal ->> 'lesson_ready')::boolean then raise exception 'expired waiver satisfied lesson readiness'; end if;
  if not exists (select 1 from jsonb_array_elements(portal -> 'documents') document
    where document ->> 'document_type' = 'liability_waiver' and document ->> 'status' = 'expired') then
    raise exception 'expired waiver was not rendered as expired';
  end if;
  begin
    insert into public.lessons (organization_id, rider_id, date_time, lesson_type, status)
    values ('25000000-0000-4000-8000-000000000001', '15000000-0000-4000-8000-000000000002', now() + interval '1 day', 'Flatwork', 'confirmed');
    raise exception 'lesson booking bypassed compliance readiness';
  exception when check_violation then null;
  end;
end
$expiry_and_gates$;

insert into public.membership_plans (id, organization_id, name, price_cents, currency, "interval")
values ('45000000-0000-4000-8000-000000000001', '25000000-0000-4000-8000-000000000001', 'Batch 4 Plan', 10000, 'USD', 'month');

do $membership_and_immutability$
begin
  begin
    insert into public.memberships (organization_id, user_id, plan_id, status, renews_at)
    values ('25000000-0000-4000-8000-000000000001', '15000000-0000-4000-8000-000000000002', '45000000-0000-4000-8000-000000000001', 'active', now() + interval '1 month');
    raise exception 'membership renewal bypassed compliance readiness';
  exception when check_violation then null;
  end;
  begin
    update public.compliance_signature_receipts set typed_name = 'Mutated'
    where rider_id = '15000000-0000-4000-8000-000000000002';
    raise exception 'signature receipt was mutable';
  exception when insufficient_privilege then null;
  end;
end
$membership_and_immutability$;

rollback;
