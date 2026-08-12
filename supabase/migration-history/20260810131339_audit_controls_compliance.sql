begin;

create table public.audit_control_definitions (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete restrict,
  control_code text not null,
  title text not null,
  objective text not null,
  procedure text not null,
  control_type text not null,
  frequency text not null,
  owner_user_id uuid not null references auth.users(id),
  status text not null default 'active',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  constraint audit_control_code_length check (char_length(control_code) between 2 and 30),
  constraint audit_control_title_length check (char_length(title) between 5 and 180),
  constraint audit_control_objective_length check (char_length(objective) between 10 and 2000),
  constraint audit_control_procedure_length check (char_length(procedure) between 10 and 4000),
  constraint audit_control_type_allowed check (control_type in ('preventive','detective')),
  constraint audit_control_frequency_allowed check (frequency in ('monthly','quarterly','annual','event_driven')),
  constraint audit_control_status_allowed check (status in ('active','retired')),
  unique (academy_id, control_code)
);

create table public.audit_control_tests (
  id uuid primary key default gen_random_uuid(),
  control_id uuid not null references public.audit_control_definitions(id) on delete restrict,
  period_starts_on date not null,
  period_ends_on date not null,
  due_on date not null,
  status text not null default 'planned',
  tester_user_id uuid references auth.users(id),
  test_steps text,
  evidence_summary text,
  evidence_references jsonb not null default '[]'::jsonb,
  result_summary text,
  completed_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  constraint audit_test_period_valid check (period_ends_on >= period_starts_on and due_on >= period_ends_on),
  constraint audit_test_status_allowed check (status in ('planned','in_progress','effective','deficient')),
  constraint audit_test_completion_state check ((status in ('planned','in_progress') and completed_at is null) or (status in ('effective','deficient') and completed_at is not null)),
  constraint audit_test_evidence_array check (jsonb_typeof(evidence_references) = 'array'),
  unique (control_id, period_starts_on, period_ends_on)
);

create table public.audit_findings (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete restrict,
  control_id uuid not null references public.audit_control_definitions(id) on delete restrict,
  test_id uuid references public.audit_control_tests(id) on delete restrict,
  severity text not null,
  title text not null,
  details text not null,
  root_cause text,
  recommendation text not null,
  management_response text,
  owner_user_id uuid not null references auth.users(id),
  target_date date not null,
  status text not null default 'open',
  resolution_summary text,
  closed_by uuid references auth.users(id),
  closed_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  constraint audit_finding_severity_allowed check (severity in ('low','medium','high','critical')),
  constraint audit_finding_status_allowed check (status in ('open','in_progress','ready_for_review','closed')),
  constraint audit_finding_title_length check (char_length(title) between 5 and 180),
  constraint audit_finding_details_length check (char_length(details) between 10 and 4000),
  constraint audit_finding_recommendation_length check (char_length(recommendation) between 10 and 4000),
  constraint audit_finding_close_state check ((status <> 'closed' and closed_by is null and closed_at is null) or (status = 'closed' and closed_by is not null and closed_at is not null and char_length(resolution_summary) between 10 and 4000))
);

create index audit_controls_academy_status_idx on public.audit_control_definitions (academy_id, status, control_code);
create index audit_controls_owner_idx on public.audit_control_definitions (owner_user_id) where status = 'active';
create index audit_tests_control_due_idx on public.audit_control_tests (control_id, due_on desc);
create index audit_tests_tester_idx on public.audit_control_tests (tester_user_id) where tester_user_id is not null;
create index audit_findings_academy_status_idx on public.audit_findings (academy_id, status, target_date);
create index audit_findings_owner_idx on public.audit_findings (owner_user_id, status);
create index audit_findings_control_idx on public.audit_findings (control_id, created_at desc);
create index audit_findings_test_idx on public.audit_findings (test_id) where test_id is not null;

alter table public.audit_control_definitions enable row level security;
alter table public.audit_control_tests enable row level security;
alter table public.audit_findings enable row level security;

revoke all on public.audit_control_definitions, public.audit_control_tests, public.audit_findings from public, anon, authenticated;
grant select, insert, update on public.audit_control_definitions, public.audit_control_tests, public.audit_findings to authenticated;
grant select, insert, update, delete on public.audit_control_definitions, public.audit_control_tests, public.audit_findings to service_role;

create policy audit_controls_read_administrators on public.audit_control_definitions for select to authenticated using ((select private.is_platform_administrator()));
create policy audit_controls_insert_administrators on public.audit_control_definitions for insert to authenticated with check ((select private.is_platform_administrator()) and created_by = (select auth.uid()) and updated_by = (select auth.uid()));
create policy audit_controls_update_administrators on public.audit_control_definitions for update to authenticated using ((select private.is_platform_administrator())) with check ((select private.is_platform_administrator()) and updated_by = (select auth.uid()));
create policy audit_tests_read_administrators on public.audit_control_tests for select to authenticated using ((select private.is_platform_administrator()));
create policy audit_tests_insert_administrators on public.audit_control_tests for insert to authenticated with check ((select private.is_platform_administrator()) and created_by = (select auth.uid()) and updated_by = (select auth.uid()));
create policy audit_tests_update_administrators on public.audit_control_tests for update to authenticated using ((select private.is_platform_administrator())) with check ((select private.is_platform_administrator()) and updated_by = (select auth.uid()));
create policy audit_findings_read_administrators on public.audit_findings for select to authenticated using ((select private.is_platform_administrator()));
create policy audit_findings_insert_administrators on public.audit_findings for insert to authenticated with check ((select private.is_platform_administrator()) and created_by = (select auth.uid()) and updated_by = (select auth.uid()));
create policy audit_findings_update_administrators on public.audit_findings for update to authenticated using ((select private.is_platform_administrator())) with check ((select private.is_platform_administrator()) and updated_by = (select auth.uid()));

create function private.protect_completed_audit_test() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.status in ('effective','deficient') then raise exception 'completed audit control test is immutable' using errcode = '23514'; end if;
  new.updated_at := now(); return new;
end; $$;
create trigger protect_completed_audit_test before update or delete on public.audit_control_tests for each row execute function private.protect_completed_audit_test();

create function private.protect_closed_audit_finding() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.status = 'closed' then raise exception 'closed audit finding is immutable' using errcode = '23514'; end if;
  new.updated_at := now(); return new;
end; $$;
create trigger protect_closed_audit_finding before update or delete on public.audit_findings for each row execute function private.protect_closed_audit_finding();

create function public.create_audit_control(target_academy_id uuid, target_control_code text, target_title text, target_objective text, target_procedure text, target_control_type text, target_frequency text, target_owner_user_id uuid) returns uuid language plpgsql security invoker set search_path = '' as $$
declare actor uuid := (select auth.uid()); control_id uuid;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode = '42501'; end if;
  if not exists (select 1 from public.academies where id = target_academy_id and archived_at is null) then raise exception 'active academy required' using errcode = '23514'; end if;
  if not exists (select 1 from public.platform_access where user_id = target_owner_user_id and status = 'active') then raise exception 'active platform owner required' using errcode = '23514'; end if;
  insert into public.audit_control_definitions(academy_id,control_code,title,objective,procedure,control_type,frequency,owner_user_id,created_by,updated_by)
  values(target_academy_id,upper(btrim(target_control_code)),btrim(target_title),btrim(target_objective),btrim(target_procedure),target_control_type,target_frequency,target_owner_user_id,actor,actor) returning id into control_id;
  perform public.write_audit_event(target_academy_id,'audit_control.created','audit_control',control_id,jsonb_build_object('control_code',upper(btrim(target_control_code)),'frequency',target_frequency)); return control_id;
end; $$;

create function public.update_audit_control(target_control_id uuid, target_title text, target_objective text, target_procedure text, target_control_type text, target_frequency text, target_owner_user_id uuid, target_status text) returns boolean language plpgsql security invoker set search_path = '' as $$
declare actor uuid := (select auth.uid()); scoped public.audit_control_definitions%rowtype;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode = '42501'; end if;
  select * into scoped from public.audit_control_definitions where id = target_control_id for update; if scoped.id is null then raise exception 'audit control not found' using errcode = 'P0002'; end if;
  if target_status = 'retired' and exists(select 1 from public.audit_control_tests where control_id=scoped.id and status in('planned','in_progress')) then raise exception 'complete open control tests before retirement' using errcode='23514'; end if;
  update public.audit_control_definitions set title=btrim(target_title),objective=btrim(target_objective),procedure=btrim(target_procedure),control_type=target_control_type,frequency=target_frequency,owner_user_id=target_owner_user_id,status=target_status,updated_by=actor,updated_at=now() where id=scoped.id;
  perform public.write_audit_event(scoped.academy_id,'audit_control.updated','audit_control',scoped.id,jsonb_build_object('status',target_status,'frequency',target_frequency)); return true;
end; $$;

create function public.schedule_audit_control_test(target_control_id uuid, target_period_starts_on date, target_period_ends_on date, target_due_on date, target_tester_user_id uuid) returns uuid language plpgsql security invoker set search_path = '' as $$
declare actor uuid := (select auth.uid()); scoped public.audit_control_definitions%rowtype; test_id uuid;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode = '42501'; end if;
  select * into scoped from public.audit_control_definitions where id=target_control_id and status='active'; if scoped.id is null then raise exception 'active audit control required' using errcode='23514'; end if;
  insert into public.audit_control_tests(control_id,period_starts_on,period_ends_on,due_on,tester_user_id,created_by,updated_by) values(scoped.id,target_period_starts_on,target_period_ends_on,target_due_on,target_tester_user_id,actor,actor) returning id into test_id;
  perform public.write_audit_event(scoped.academy_id,'audit_control.test_scheduled','audit_control_test',test_id,jsonb_build_object('control_id',scoped.id,'due_on',target_due_on)); return test_id;
end; $$;

create function public.complete_audit_control_test(target_test_id uuid, target_result text, target_test_steps text, target_evidence_summary text, target_evidence_references jsonb, target_result_summary text) returns boolean language plpgsql security invoker set search_path = '' as $$
declare actor uuid := (select auth.uid()); scoped public.audit_control_tests%rowtype; academy uuid;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode = '42501'; end if;
  if target_result not in ('effective','deficient') or char_length(btrim(target_test_steps)) not between 10 and 4000 or char_length(btrim(target_evidence_summary)) not between 10 and 4000 or char_length(btrim(target_result_summary)) not between 10 and 4000 or jsonb_typeof(target_evidence_references) <> 'array' then raise exception 'complete control-test evidence required' using errcode='22023'; end if;
  select * into scoped from public.audit_control_tests where id=target_test_id and status in('planned','in_progress') for update; if scoped.id is null then raise exception 'open audit control test required' using errcode='23514'; end if;
  update public.audit_control_tests set status=target_result,tester_user_id=coalesce(tester_user_id,actor),test_steps=btrim(target_test_steps),evidence_summary=btrim(target_evidence_summary),evidence_references=target_evidence_references,result_summary=btrim(target_result_summary),completed_at=now(),updated_by=actor,updated_at=now() where id=scoped.id;
  select academy_id into academy from public.audit_control_definitions where id=scoped.control_id;
  perform public.write_audit_event(academy,'audit_control.test_completed','audit_control_test',scoped.id,jsonb_build_object('control_id',scoped.control_id,'result',target_result)); return true;
end; $$;

create function public.open_audit_finding(target_control_id uuid, target_test_id uuid, target_severity text, target_title text, target_details text, target_recommendation text, target_owner_user_id uuid, target_date date) returns uuid language plpgsql security invoker set search_path = '' as $$
declare actor uuid := (select auth.uid()); scoped public.audit_control_definitions%rowtype; finding_id uuid;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  select * into scoped from public.audit_control_definitions where id=target_control_id; if scoped.id is null then raise exception 'audit control not found' using errcode='P0002'; end if;
  if target_test_id is not null and not exists(select 1 from public.audit_control_tests where id=target_test_id and control_id=scoped.id and status='deficient') then raise exception 'deficient control test required' using errcode='23514'; end if;
  insert into public.audit_findings(academy_id,control_id,test_id,severity,title,details,recommendation,owner_user_id,target_date,created_by,updated_by) values(scoped.academy_id,scoped.id,target_test_id,target_severity,btrim(target_title),btrim(target_details),btrim(target_recommendation),target_owner_user_id,target_date,actor,actor) returning id into finding_id;
  perform public.write_audit_event(scoped.academy_id,'audit_finding.opened','audit_finding',finding_id,jsonb_build_object('control_id',scoped.id,'severity',target_severity,'target_date',target_date)); return finding_id;
end; $$;

create function public.update_audit_finding(target_finding_id uuid, target_status text, target_root_cause text, target_management_response text, target_owner_user_id uuid, target_date date) returns boolean language plpgsql security invoker set search_path = '' as $$
declare actor uuid := (select auth.uid()); scoped public.audit_findings%rowtype;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  if target_status not in ('open','in_progress','ready_for_review') then raise exception 'open finding status required' using errcode='22023'; end if;
  select * into scoped from public.audit_findings where id=target_finding_id and status<>'closed' for update; if scoped.id is null then raise exception 'open audit finding required' using errcode='23514'; end if;
  update public.audit_findings set status=target_status,root_cause=nullif(btrim(target_root_cause),''),management_response=nullif(btrim(target_management_response),''),owner_user_id=target_owner_user_id,target_date=target_date,updated_by=actor,updated_at=now() where id=scoped.id;
  perform public.write_audit_event(scoped.academy_id,'audit_finding.updated','audit_finding',scoped.id,jsonb_build_object('status',target_status,'target_date',target_date)); return true;
end; $$;

create function public.close_audit_finding(target_finding_id uuid, target_resolution_summary text) returns boolean language plpgsql security invoker set search_path = '' as $$
declare actor uuid := (select auth.uid()); scoped public.audit_findings%rowtype;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  if char_length(btrim(target_resolution_summary)) not between 10 and 4000 then raise exception 'complete resolution evidence required' using errcode='22023'; end if;
  select * into scoped from public.audit_findings where id=target_finding_id and status='ready_for_review' for update; if scoped.id is null then raise exception 'finding must be ready for review before closure' using errcode='23514'; end if;
  update public.audit_findings set status='closed',resolution_summary=btrim(target_resolution_summary),closed_by=actor,closed_at=now(),updated_by=actor,updated_at=now() where id=scoped.id;
  perform public.write_audit_event(scoped.academy_id,'audit_finding.closed','audit_finding',scoped.id,jsonb_build_object('control_id',scoped.control_id)); return true;
end; $$;

create function public.record_audit_controls_export(target_academy_id uuid) returns boolean language plpgsql security invoker set search_path = '' as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  if not exists(select 1 from public.academies where id=target_academy_id) then raise exception 'academy not found' using errcode='P0002'; end if;
  perform public.write_audit_event(target_academy_id,'audit_controls.exported','audit_controls',target_academy_id,'{}'::jsonb); return true;
end; $$;

revoke all on function private.protect_completed_audit_test(), private.protect_closed_audit_finding() from public, anon, authenticated;
revoke all on function public.create_audit_control(uuid,text,text,text,text,text,text,uuid), public.update_audit_control(uuid,text,text,text,text,text,uuid,text), public.schedule_audit_control_test(uuid,date,date,date,uuid), public.complete_audit_control_test(uuid,text,text,text,jsonb,text), public.open_audit_finding(uuid,uuid,text,text,text,text,uuid,date), public.update_audit_finding(uuid,text,text,text,uuid,date), public.close_audit_finding(uuid,text), public.record_audit_controls_export(uuid) from public, anon, authenticated;
grant execute on function public.create_audit_control(uuid,text,text,text,text,text,text,uuid), public.update_audit_control(uuid,text,text,text,text,text,uuid,text), public.schedule_audit_control_test(uuid,date,date,date,uuid), public.complete_audit_control_test(uuid,text,text,text,jsonb,text), public.open_audit_finding(uuid,uuid,text,text,text,text,uuid,date), public.update_audit_finding(uuid,text,text,text,uuid,date), public.close_audit_finding(uuid,text), public.record_audit_controls_export(uuid) to authenticated;

commit;
