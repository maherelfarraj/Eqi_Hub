-- Phase 1 Stage 5 acceptance for active coach reads. Disposable fixture data
-- and all impersonation state are rolled back at the end of the transaction.
begin;

set local statement_timeout = '30s';
set local lock_timeout = '5s';

insert into auth.users (id, email, raw_user_meta_data)
values
  ('11000000-0000-4000-8000-000000000001', 'stage5-coach@example.invalid', '{"full_name":"Stage 5 Coach"}'::jsonb),
  ('11000000-0000-4000-8000-000000000002', 'stage5-active-rider@example.invalid', '{"full_name":"Stage 5 Active Rider"}'::jsonb),
  ('11000000-0000-4000-8000-000000000003', 'stage5-inactive-rider@example.invalid', '{"full_name":"Stage 5 Inactive Rider"}'::jsonb);

update public.profiles
set role = 'trainer'
where id = '11000000-0000-4000-8000-000000000001';

insert into public.organizations (id, name, slug, organization_type)
values (
  '21000000-0000-4000-8000-000000000001',
  'Stage 5 Coach RLS Academy',
  'stage-5-coach-rls-academy',
  'academy'
);

insert into public.organization_memberships (id, organization_id, user_id, status)
values
  ('31000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'active'),
  ('31000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000002', 'active'),
  ('31000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000003', 'active');

insert into public.organization_member_roles (membership_id, role)
values
  ('31000000-0000-4000-8000-000000000001', 'coach'),
  ('31000000-0000-4000-8000-000000000002', 'rider'),
  ('31000000-0000-4000-8000-000000000003', 'rider');

insert into public.coach_rider_assignments (
  organization_id,
  coach_id,
  rider_id,
  active
)
values
  ('21000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000002', true),
  ('21000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000003', false);

insert into public.video_analyses (
  id,
  organization_id,
  rider_id,
  title,
  discipline,
  status
)
values
  ('51000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000002', 'Stage 5 Active Assignment', 'Flatwork', 'analyzed'),
  ('51000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000003', 'Stage 5 Inactive Assignment', 'Flatwork', 'analyzed');

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '11000000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

do $coach$
declare
  v_updated integer;
begin
  if (select count(*) from public.video_analyses) <> 1 then
    raise exception 'coach must read exactly the active assigned rider analysis';
  end if;
  if not exists (
    select 1
    from public.video_analyses
    where id = '51000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'coach cannot read the active assigned rider analysis';
  end if;
  if exists (
    select 1
    from public.video_analyses
    where id = '51000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'coach can read an inactive rider assignment';
  end if;
  update public.video_analyses
  set title = 'Unauthorized coach update'
  where id = '51000000-0000-4000-8000-000000000001';
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'coach assignment widened video-analysis write access';
  end if;
end
$coach$;

reset role;

update public.organization_memberships
set status = 'suspended'
where id = '31000000-0000-4000-8000-000000000001';

set local role authenticated;
do $suspended_coach$
begin
  if exists (select 1 from public.video_analyses) then
    raise exception 'suspended coach retained assigned-rider analysis access';
  end if;
end
$suspended_coach$;

reset role;
rollback;
