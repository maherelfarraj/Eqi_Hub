-- Batch 1 disposable acceptance: coach draft/approval, rider reflection,
-- guardian read-only visibility, private-note isolation, and competency update.
begin;

set local statement_timeout = '30s';
set local lock_timeout = '5s';

insert into auth.users (id, email, raw_user_meta_data)
values
  ('12000000-0000-4000-8000-000000000001', 'batch1-coach@example.invalid', '{"full_name":"Batch 1 Coach"}'::jsonb),
  ('12000000-0000-4000-8000-000000000002', 'batch1-rider@example.invalid', '{"full_name":"Batch 1 Rider"}'::jsonb),
  ('12000000-0000-4000-8000-000000000003', 'batch1-guardian@example.invalid', '{"full_name":"Batch 1 Guardian"}'::jsonb),
  ('12000000-0000-4000-8000-000000000004', 'batch1-other@example.invalid', '{"full_name":"Batch 1 Other"}'::jsonb);

insert into public.organizations (id, name, slug, organization_type)
values (
  '22000000-0000-4000-8000-000000000001',
  'Batch 1 Rider Development Academy',
  'batch-1-rider-development-academy',
  'academy'
);

insert into public.organization_memberships (id, organization_id, user_id, status)
values
  ('32000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000001', 'active'),
  ('32000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000002', 'active'),
  ('32000000-0000-4000-8000-000000000003', '22000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000003', 'active');

insert into public.organization_member_roles (membership_id, role)
values
  ('32000000-0000-4000-8000-000000000001', 'coach'),
  ('32000000-0000-4000-8000-000000000002', 'rider'),
  ('32000000-0000-4000-8000-000000000003', 'guardian');

insert into public.coach_rider_assignments (
  organization_id,
  coach_id,
  rider_id,
  active
) values (
  '22000000-0000-4000-8000-000000000001',
  '12000000-0000-4000-8000-000000000001',
  '12000000-0000-4000-8000-000000000002',
  true
);

insert into public.guardian_riders (
  organization_id,
  guardian_id,
  rider_id,
  active
) values (
  '22000000-0000-4000-8000-000000000001',
  '12000000-0000-4000-8000-000000000003',
  '12000000-0000-4000-8000-000000000002',
  true
);

insert into public.lessons (
  id,
  organization_id,
  rider_id,
  trainer_id,
  date_time,
  lesson_type,
  status
) values (
  '62000000-0000-4000-8000-000000000001',
  '22000000-0000-4000-8000-000000000001',
  '12000000-0000-4000-8000-000000000002',
  '12000000-0000-4000-8000-000000000001',
  now(),
  'Flatwork',
  'confirmed'
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '12000000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

do $coach$
declare
  v_report_id uuid;
begin
  v_report_id := public.save_lesson_development_report(
    '62000000-0000-4000-8000-000000000001',
    array['Improve rhythm and transitions'],
    'The rider maintained a calm rhythm and improved transition preparation.',
    array['Consistent tempo', 'Quiet hands'],
    array['Earlier preparation'],
    'Horse remained relaxed and responsive.',
    'The pair recovered balance promptly after transitions.',
    'Practise five walk-trot transitions in each direction.',
    now() + interval '7 days',
    'Prepare transitions before asking.',
    4::smallint,
    4::smallint,
    3::smallint,
    jsonb_build_array(
      jsonb_build_object(
        'competency_id', 'c1000000-0000-4000-8000-000000000004',
        'stage', 'practising',
        'evidence_note', 'Maintained rhythm through repeated transitions.'
      )
    ),
    'Private coach planning note.'
  );

  if (select count(*) from public.lesson_development_reports where id = v_report_id and status = 'draft') <> 1 then
    raise exception 'coach could not create a draft report';
  end if;
  if exists (select 1 from public.rider_competency_progress) then
    raise exception 'draft evidence changed official competency progress';
  end if;
  if (select status from public.lessons where id = '62000000-0000-4000-8000-000000000001') <> 'completed' then
    raise exception 'lesson closeout did not mark the confirmed lesson completed';
  end if;

  perform public.approve_lesson_development_report(v_report_id);

  if (select count(*) from public.rider_competency_progress where rider_id = '12000000-0000-4000-8000-000000000002' and stage = 'practising') <> 1 then
    raise exception 'approved evidence did not advance competency progress';
  end if;

  begin
    update public.rider_competency_evidence
    set stage = 'achieved'
    where report_id = v_report_id;
    raise exception 'approved competency evidence remained mutable';
  exception
    when sqlstate '55000' then null;
  end;
end
$coach$;

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '12000000-0000-4000-8000-000000000003',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

do $guardian$
declare
  updated_count integer;
begin
  if (select count(*) from public.lesson_development_reports) <> 1 then
    raise exception 'guardian cannot read the linked rider approved report';
  end if;
  if (select count(*) from public.rider_competency_progress) <> 1 then
    raise exception 'guardian cannot read approved linked-rider progress';
  end if;
  if exists (select 1 from public.lesson_development_private_notes) then
    raise exception 'guardian can read a private coach note';
  end if;

  update public.lesson_development_reports
  set summary = 'Unauthorized guardian update';
  get diagnostics updated_count = row_count;
  if updated_count <> 0 then
    raise exception 'guardian changed a coach-approved report';
  end if;
end
$guardian$;

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '12000000-0000-4000-8000-000000000002',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

insert into public.lesson_development_reflections (
  report_id,
  organization_id,
  rider_id,
  reflection,
  question,
  visible_to_guardian
)
select
  id,
  organization_id,
  rider_id,
  'I felt the transitions become more balanced.',
  'Can we practise canter transitions next?',
  true
from public.lesson_development_reports;

do $rider$
begin
  if (select count(*) from public.lesson_development_reflections) <> 1 then
    raise exception 'rider could not save an approved-report reflection';
  end if;
  if exists (select 1 from public.lesson_development_private_notes) then
    raise exception 'rider can read a private coach note';
  end if;
end
$rider$;

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '12000000-0000-4000-8000-000000000004',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

do $unrelated$
begin
  if exists (select 1 from public.lesson_development_reports) then
    raise exception 'unrelated user can read a lesson report';
  end if;
  if exists (select 1 from public.rider_competency_progress) then
    raise exception 'unrelated user can read rider competency progress';
  end if;
end
$unrelated$;

reset role;
rollback;
