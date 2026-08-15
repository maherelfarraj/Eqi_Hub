-- Batch 3 disposable acceptance: verified multi-minor guardian view,
-- permission-scoped decisions, adulthood review, audit, and isolation.
begin;

set local statement_timeout = '30s';
set local lock_timeout = '5s';

insert into auth.users (id, email, raw_user_meta_data)
values
  ('14000000-0000-4000-8000-000000000001', 'batch3-admin@example.invalid', '{"full_name":"Batch 3 Admin"}'::jsonb),
  ('14000000-0000-4000-8000-000000000002', 'batch3-guardian@example.invalid', '{"full_name":"Batch 3 Guardian"}'::jsonb),
  ('14000000-0000-4000-8000-000000000003', 'batch3-supporter@example.invalid', '{"full_name":"Batch 3 Supporter"}'::jsonb),
  ('14000000-0000-4000-8000-000000000004', 'batch3-review@example.invalid', '{"full_name":"Batch 3 Review Guardian"}'::jsonb),
  ('14000000-0000-4000-8000-000000000005', 'batch3-rider-one@example.invalid', '{"full_name":"Batch 3 Rider One"}'::jsonb),
  ('14000000-0000-4000-8000-000000000006', 'batch3-rider-two@example.invalid', '{"full_name":"Batch 3 Rider Two"}'::jsonb),
  ('14000000-0000-4000-8000-000000000007', 'batch3-rider-three@example.invalid', '{"full_name":"Batch 3 Rider Three"}'::jsonb),
  ('14000000-0000-4000-8000-000000000008', 'batch3-other@example.invalid', '{"full_name":"Batch 3 Other"}'::jsonb);

insert into public.organizations (id, name, slug, organization_type)
values ('24000000-0000-4000-8000-000000000001', 'Batch 3 Guardian Academy', 'batch-3-guardian-academy', 'academy');

insert into public.organization_memberships (id, organization_id, user_id, status)
values
  ('34000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000001', 'active'),
  ('34000000-0000-4000-8000-000000000002', '24000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000002', 'active'),
  ('34000000-0000-4000-8000-000000000003', '24000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000003', 'active'),
  ('34000000-0000-4000-8000-000000000004', '24000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000004', 'active'),
  ('34000000-0000-4000-8000-000000000005', '24000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000005', 'active'),
  ('34000000-0000-4000-8000-000000000006', '24000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000006', 'active'),
  ('34000000-0000-4000-8000-000000000007', '24000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000007', 'active'),
  ('34000000-0000-4000-8000-000000000008', '24000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000008', 'active');

insert into public.organization_member_roles (membership_id, role)
values
  ('34000000-0000-4000-8000-000000000001', 'academy_admin'),
  ('34000000-0000-4000-8000-000000000002', 'guardian'),
  ('34000000-0000-4000-8000-000000000003', 'guardian'),
  ('34000000-0000-4000-8000-000000000004', 'guardian'),
  ('34000000-0000-4000-8000-000000000005', 'rider'),
  ('34000000-0000-4000-8000-000000000006', 'rider'),
  ('34000000-0000-4000-8000-000000000007', 'rider'),
  ('34000000-0000-4000-8000-000000000008', 'rider');

insert into public.guardian_riders (
  organization_id, guardian_id, rider_id, active, relationship_type,
  legal_authority, verification_status, verified_at, can_view_financials,
  can_approve_purchases, can_approve_video_ai, adulthood_review_on, created_by
)
values
  ('24000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000005', true, 'parent', true, 'verified', now(), true, true, false, current_date + 365, '14000000-0000-4000-8000-000000000001'),
  ('24000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000006', true, 'parent', true, 'verified', now(), false, true, false, current_date + 365, '14000000-0000-4000-8000-000000000001'),
  ('24000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000003', '14000000-0000-4000-8000-000000000005', true, 'supporter', false, 'verified', now(), false, false, false, null, '14000000-0000-4000-8000-000000000001'),
  ('24000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000004', '14000000-0000-4000-8000-000000000006', true, 'legal_guardian', true, 'verified', now(), true, true, false, current_date, '14000000-0000-4000-8000-000000000001');

insert into public.lessons (
  id, organization_id, rider_id, trainer_id, date_time, lesson_type, status
)
values
  ('64000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000005', '14000000-0000-4000-8000-000000000001', now() - interval '1 day', 'Flatwork', 'completed'),
  ('64000000-0000-4000-8000-000000000002', '24000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000006', '14000000-0000-4000-8000-000000000001', now() + interval '2 days', 'Dressage', 'confirmed');

insert into public.invoices (
  id, organization_id, user_id, number, description, status, total_cents
)
values
  ('74000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000005', 'B3-001', 'Guardian-visible invoice summary', 'open', 12500),
  ('74000000-0000-4000-8000-000000000002', '24000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000006', 'B3-002', 'Financially private minor invoice', 'open', 9000);

select set_config('request.jwt.claims', json_build_object('sub', '14000000-0000-4000-8000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

do $admin$
declare
  report_id uuid;
begin
  report_id := public.save_lesson_development_report(
    '64000000-0000-4000-8000-000000000001', array['Calm preparation'],
    'The rider prepared safely and maintained a steady rhythm.',
    array['Safety checks'], array['Independent balance'], 'Horse remained relaxed.',
    'The pair communicated clearly.', 'Practise balanced transitions.', now() + interval '7 days',
    'Prepare transitions earlier.', 4::smallint, 4::smallint, 3::smallint,
    jsonb_build_array(jsonb_build_object(
      'competency_id', 'c1000000-0000-4000-8000-000000000001',
      'stage', 'demonstrated', 'evidence_note', 'Completed readiness checks.'
    )), 'Batch 3 private safeguarding note'
  );
  perform public.approve_lesson_development_report(report_id);
end
$admin$;

reset role;
select set_config('request.jwt.claims', json_build_object('sub', '14000000-0000-4000-8000-000000000005', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into public.guardian_approval_requests (
  organization_id, guardian_id, rider_id, request_key, approval_type,
  subject_type, summary, details, requested_by, expires_at
)
values (
  '24000000-0000-4000-8000-000000000001',
  '14000000-0000-4000-8000-000000000002',
  '14000000-0000-4000-8000-000000000005',
  'batch3:purchase:001', 'purchase', 'training_add_on',
  'Approve one supervised training add-on', '{"amountCents":12500}'::jsonb,
  '14000000-0000-4000-8000-000000000005', now() + interval '7 days'
);

do $rider_permission_denial$
begin
  begin
    insert into public.guardian_approval_requests (
      organization_id, guardian_id, rider_id, request_key, approval_type,
      subject_type, summary, requested_by
    ) values (
      '24000000-0000-4000-8000-000000000001',
      '14000000-0000-4000-8000-000000000002',
      '14000000-0000-4000-8000-000000000005',
      'batch3:video:denied', 'video_ai_consent', 'video_upload',
      'This permission was not granted', '14000000-0000-4000-8000-000000000005'
    );
    raise exception 'guardian approved a permission they were not granted';
  exception when sqlstate '42501' then null; end;
end
$rider_permission_denial$;

reset role;
select set_config('request.jwt.claims', json_build_object('sub', '14000000-0000-4000-8000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;

do $guardian$
declare
  portal_one jsonb;
  portal_two jsonb;
  request_id uuid;
begin
  portal_one := public.get_guardian_portal(
    '24000000-0000-4000-8000-000000000001',
    '14000000-0000-4000-8000-000000000005'
  );
  portal_two := public.get_guardian_portal(
    '24000000-0000-4000-8000-000000000001',
    '14000000-0000-4000-8000-000000000006'
  );

  if portal_one #>> '{rider,id}' <> '14000000-0000-4000-8000-000000000005'
    or portal_two #>> '{rider,id}' <> '14000000-0000-4000-8000-000000000006'
  then raise exception 'verified guardian cannot open linked rider portal'; end if;
  if jsonb_array_length(portal_one->'invoices') <> 1
    or jsonb_array_length(portal_two->'invoices') <> 0
  then raise exception 'financial view permission did not scope invoices'; end if;
  if portal_one ? 'privateNotes'
    or portal_one::text like '%Batch 3 private safeguarding note%'
  then raise exception 'guardian portal exposed private coach notes'; end if;
  if exists (select 1 from public.lesson_development_private_notes) then
    raise exception 'guardian directly read private coach notes';
  end if;

  select id into request_id
  from public.guardian_approval_requests
  where request_key = 'batch3:purchase:001';
  perform public.respond_guardian_approval(request_id, 'approved', 'Approved for supervised use.');

  if not exists (
    select 1 from public.guardian_access_events
    where approval_request_id = request_id and event_type = 'approval_approved'
  ) then raise exception 'guardian approval decision was not audited'; end if;

  begin
    perform public.get_guardian_portal(
      '24000000-0000-4000-8000-000000000001',
      '14000000-0000-4000-8000-000000000007'
    );
    raise exception 'guardian can read an unrelated minor';
  exception when sqlstate '42501' then null; end;

  begin
    update public.guardian_access_events set metadata = '{"tampered":true}'::jsonb;
    raise exception 'guardian audit event was mutable';
  exception when sqlstate '42501' then null; end;
end
$guardian$;

reset role;
select set_config('request.jwt.claims', json_build_object('sub', '14000000-0000-4000-8000-000000000003', 'role', 'authenticated')::text, true);
set local role authenticated;

do $supporter$
declare
  portal jsonb;
  request_id uuid;
begin
  portal := public.get_guardian_portal(
    '24000000-0000-4000-8000-000000000001',
    '14000000-0000-4000-8000-000000000005'
  );
  if portal #>> '{relationship,relationshipType}' <> 'supporter' then
    raise exception 'supporter cannot open their view-only portal';
  end if;

  select id into request_id
  from public.guardian_approval_requests
  where request_key = 'batch3:purchase:001';
  begin
    perform public.respond_guardian_approval(request_id, 'approved', null);
    raise exception 'supporter approved a legal decision';
  exception when sqlstate '42501' then null; end;
end
$supporter$;

reset role;
select set_config('request.jwt.claims', json_build_object('sub', '14000000-0000-4000-8000-000000000004', 'role', 'authenticated')::text, true);
set local role authenticated;

do $review_due$
begin
  begin
    perform public.get_guardian_portal(
      '24000000-0000-4000-8000-000000000001',
      '14000000-0000-4000-8000-000000000006'
    );
    raise exception 'adulthood-review-due guardian retained rider access';
  exception when sqlstate '42501' then null; end;
end
$review_due$;

reset role;
select set_config('request.jwt.claims', json_build_object('sub', '14000000-0000-4000-8000-000000000008', 'role', 'authenticated')::text, true);
set local role authenticated;

do $unrelated$
begin
  if exists (select 1 from public.guardian_riders) then
    raise exception 'unrelated user can read guardian relationships';
  end if;
  if exists (select 1 from public.guardian_approval_requests) then
    raise exception 'unrelated user can read guardian approvals';
  end if;
  if exists (select 1 from public.guardian_access_events) then
    raise exception 'unrelated user can read guardian audit history';
  end if;
end
$unrelated$;

reset role;
rollback;
