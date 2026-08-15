-- Batch 2 disposable acceptance: append-only scoring, title unlocks,
-- coach-approved badges, reflection uplift, and persona-scoped reads.
begin;

set local statement_timeout = '30s';
set local lock_timeout = '5s';

insert into auth.users (id, email, raw_user_meta_data)
values
  ('13000000-0000-4000-8000-000000000001', 'batch2-coach@example.invalid', '{"full_name":"Batch 2 Coach"}'::jsonb),
  ('13000000-0000-4000-8000-000000000002', 'batch2-rider@example.invalid', '{"full_name":"Batch 2 Rider"}'::jsonb),
  ('13000000-0000-4000-8000-000000000003', 'batch2-guardian@example.invalid', '{"full_name":"Batch 2 Guardian"}'::jsonb),
  ('13000000-0000-4000-8000-000000000004', 'batch2-other@example.invalid', '{"full_name":"Batch 2 Other"}'::jsonb);

insert into public.organizations (id, name, slug, organization_type)
values ('23000000-0000-4000-8000-000000000001', 'Batch 2 RiderSync Academy', 'batch-2-ridersync-academy', 'academy');

insert into public.organization_memberships (id, organization_id, user_id, status)
values
  ('33000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000001', 'active'),
  ('33000000-0000-4000-8000-000000000002', '23000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000002', 'active'),
  ('33000000-0000-4000-8000-000000000003', '23000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000003', 'active');
insert into public.organization_member_roles (membership_id, role)
values
  ('33000000-0000-4000-8000-000000000001', 'coach'),
  ('33000000-0000-4000-8000-000000000002', 'rider'),
  ('33000000-0000-4000-8000-000000000003', 'guardian');
insert into public.coach_rider_assignments (organization_id, coach_id, rider_id, active)
values ('23000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000002', true);
insert into public.guardian_riders (organization_id, guardian_id, rider_id, active)
values ('23000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000003', '13000000-0000-4000-8000-000000000002', true);
insert into public.lessons (id, organization_id, rider_id, trainer_id, date_time, lesson_type, status)
values ('63000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000002', '13000000-0000-4000-8000-000000000001', now(), 'Flatwork', 'confirmed');

select set_config('request.jwt.claims', json_build_object('sub', '13000000-0000-4000-8000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

do $coach$
declare
  v_report_id uuid;
begin
  v_report_id := public.save_lesson_development_report(
    '63000000-0000-4000-8000-000000000001', array['Safe, balanced preparation'],
    'The rider prepared safely and maintained a calm, balanced position.',
    array['Safety checks'], array['Repeatable rhythm'], 'Horse remained relaxed.',
    'The pair communicated calmly.', 'Practise balanced transitions.', now() + interval '7 days',
    'Prepare each transition early.', 4::smallint, 4::smallint, 3::smallint,
    jsonb_build_array(jsonb_build_object(
      'competency_id', 'c1000000-0000-4000-8000-000000000001',
      'stage', 'demonstrated', 'evidence_note', 'Completed all readiness checks.'
    )), null
  );
  perform public.approve_lesson_development_report(v_report_id);

  if (select overall_score from public.rider_sync_score_snapshots where rider_id = '13000000-0000-4000-8000-000000000002' order by calculated_at desc limit 1) <> 21 then
    raise exception 'weighted score after approval was not 21';
  end if;
  if (select count(*) from public.rider_journey_title_unlocks where rider_id = '13000000-0000-4000-8000-000000000002') <> 2 then
    raise exception 'approval did not unlock the expected self-baseline titles';
  end if;

  perform public.award_rider_badge(
    '23000000-0000-4000-8000-000000000001',
    '13000000-0000-4000-8000-000000000002',
    'horse_first', 'Protected the horse through every readiness check.', v_report_id
  );
end
$coach$;

reset role;
select set_config('request.jwt.claims', json_build_object('sub', '13000000-0000-4000-8000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;

do $rider$
declare
  v_before integer;
  v_after integer;
  v_badge_id uuid;
  v_dashboard jsonb;
begin
  select overall_score into v_before from public.rider_sync_score_snapshots order by calculated_at desc, id desc limit 1;
  insert into public.lesson_development_reflections (report_id, organization_id, rider_id, reflection, visible_to_guardian)
  select id, organization_id, rider_id, 'I will prepare earlier and keep the horse relaxed.', true
  from public.lesson_development_reports where rider_id = '13000000-0000-4000-8000-000000000002';
  select overall_score into v_after from public.rider_sync_score_snapshots order by calculated_at desc, id desc limit 1;
  if v_before <> 21 or v_after <> 26 then raise exception 'reflection did not lift RiderSync from 21 to 26'; end if;

  v_dashboard := public.get_rider_sync_dashboard(
    '23000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000002'
  );
  if (v_dashboard #>> '{snapshot,overallScore}')::integer <> 26 then raise exception 'dashboard returned the wrong score'; end if;
  if jsonb_array_length(v_dashboard->'badges') <> 1 then raise exception 'rider cannot see approved badge'; end if;
  if v_dashboard ? 'privateNotes' then raise exception 'dashboard exposed private notes'; end if;

  begin
    v_badge_id := public.award_rider_badge(
      '23000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000002',
      'coachs_choice', 'Self-awarded badge must fail.', null
    );
    raise exception 'rider self-awarded badge %', v_badge_id;
  exception when sqlstate '42501' then null; end;
end
$rider$;

reset role;
select set_config('request.jwt.claims', json_build_object('sub', '13000000-0000-4000-8000-000000000003', 'role', 'authenticated')::text, true);
set local role authenticated;
do $guardian$
begin
  if (select count(*) from public.rider_sync_score_snapshots) <> 2 then raise exception 'guardian cannot read linked score history'; end if;
  if (select count(*) from public.rider_badge_awards where status = 'approved') <> 1 then raise exception 'guardian cannot read linked approved badge'; end if;
end
$guardian$;

reset role;
select set_config('request.jwt.claims', json_build_object('sub', '13000000-0000-4000-8000-000000000004', 'role', 'authenticated')::text, true);
set local role authenticated;
do $unrelated$
begin
  if exists (select 1 from public.rider_sync_score_snapshots) then raise exception 'unrelated user can read RiderSync scores'; end if;
  if exists (select 1 from public.rider_badge_awards) then raise exception 'unrelated user can read RiderSync badges'; end if;
end
$unrelated$;

reset role;
rollback;
