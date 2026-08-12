begin;

create type public.treasury_funding_plan_status as enum ('draft','approved','closed');
create type public.treasury_funding_action_type as enum ('collections','payment_reschedule','cost_reduction','short_term_funding','owner_injection');
create type public.treasury_funding_action_status as enum ('open','in_progress','completed','cancelled');

create table public.treasury_funding_plans (
  id uuid primary key default gen_random_uuid(),academy_id uuid not null references public.academies(id) on delete restrict,scenario_id uuid references public.treasury_forecast_scenarios(id) on delete restrict,start_on date not null,currency text not null check(currency~'^[A-Z]{3}$'),reserve_floor_minor bigint not null check(reserve_floor_minor>=0),peak_shortfall_minor bigint not null check(peak_shortfall_minor>0),first_gap_on date not null,gap_weeks integer not null check(gap_weeks between 1 and 13),status public.treasury_funding_plan_status not null default 'draft',approved_by uuid references auth.users(id),approved_at timestamptz,closed_by uuid references auth.users(id),closed_at timestamptz,created_by uuid not null references auth.users(id),updated_by uuid not null references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),constraint treasury_funding_plan_state check((status='draft' and approved_by is null and approved_at is null and closed_by is null and closed_at is null) or (status='approved' and approved_by is not null and approved_at is not null and closed_by is null and closed_at is null) or (status='closed' and approved_by is not null and approved_at is not null and closed_by is not null and closed_at is not null))
);
create table public.treasury_funding_actions (
  id uuid primary key default gen_random_uuid(),plan_id uuid not null references public.treasury_funding_plans(id) on delete restrict,academy_id uuid not null references public.academies(id) on delete restrict,action_type public.treasury_funding_action_type not null,title text not null,target_amount_minor bigint not null check(target_amount_minor>0),due_on date not null,assigned_to uuid references auth.users(id),status public.treasury_funding_action_status not null default 'open',note text,resolved_at timestamptz,created_by uuid not null references auth.users(id),updated_by uuid not null references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),constraint treasury_funding_action_title_length check(char_length(title) between 2 and 160),constraint treasury_funding_action_note_length check(note is null or char_length(note) between 2 and 500),constraint treasury_funding_action_resolution check((status in ('open','in_progress') and resolved_at is null) or (status in ('completed','cancelled') and resolved_at is not null))
);
create index treasury_funding_plans_lookup_idx on public.treasury_funding_plans(academy_id,status,first_gap_on);
create index treasury_funding_plans_scenario_idx on public.treasury_funding_plans(scenario_id);
create index treasury_funding_actions_plan_idx on public.treasury_funding_actions(plan_id,status,due_on);
create index treasury_funding_actions_assigned_idx on public.treasury_funding_actions(assigned_to,status,due_on);
create index treasury_funding_actions_created_by_idx on public.treasury_funding_actions(created_by);

alter table public.treasury_funding_plans enable row level security;alter table public.treasury_funding_actions enable row level security;
revoke all on public.treasury_funding_plans,public.treasury_funding_actions from public,anon,authenticated;
grant select,insert,update on public.treasury_funding_plans,public.treasury_funding_actions to authenticated;
grant select,insert,update,delete on public.treasury_funding_plans,public.treasury_funding_actions to service_role;
grant usage on type public.treasury_funding_plan_status,public.treasury_funding_action_type,public.treasury_funding_action_status to authenticated;
create policy treasury_funding_plans_read_administrators on public.treasury_funding_plans for select to authenticated using((select private.is_platform_administrator()));
create policy treasury_funding_plans_insert_administrators on public.treasury_funding_plans for insert to authenticated with check((select private.is_platform_administrator()) and created_by=(select auth.uid()) and updated_by=(select auth.uid()));
create policy treasury_funding_plans_update_administrators on public.treasury_funding_plans for update to authenticated using((select private.is_platform_administrator())) with check((select private.is_platform_administrator()) and updated_by=(select auth.uid()));
create policy treasury_funding_actions_read_administrators on public.treasury_funding_actions for select to authenticated using((select private.is_platform_administrator()));
create policy treasury_funding_actions_insert_administrators on public.treasury_funding_actions for insert to authenticated with check((select private.is_platform_administrator()) and created_by=(select auth.uid()) and updated_by=(select auth.uid()));
create policy treasury_funding_actions_update_administrators on public.treasury_funding_actions for update to authenticated using((select private.is_platform_administrator())) with check((select private.is_platform_administrator()) and updated_by=(select auth.uid()));

create or replace function public.generate_treasury_funding_plan(target_academy_id uuid,target_start_on date,target_currency text,target_scenario_id uuid default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare actor uuid:=(select auth.uid()); forecast jsonb; reserve bigint; peak bigint; first_gap date; gaps integer; plan_id uuid;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  forecast:=public.get_treasury_scenario_forecast(target_academy_id,target_start_on,target_currency,target_scenario_id);reserve:=(forecast->>'reserve_floor_minor')::bigint;
  select max(reserve-(week->>'closing_balance_minor')::bigint),min((week->>'week_start')::date),count(*) into peak,first_gap,gaps from jsonb_array_elements(forecast->'weeks') as item(week) where (week->>'closing_balance_minor')::bigint<reserve;
  if coalesce(gaps,0)=0 or coalesce(peak,0)<=0 then raise exception 'forecast does not contain a reserve funding gap' using errcode='22023'; end if;
  insert into public.treasury_funding_plans(academy_id,scenario_id,start_on,currency,reserve_floor_minor,peak_shortfall_minor,first_gap_on,gap_weeks,created_by,updated_by) values(target_academy_id,target_scenario_id,target_start_on,upper(btrim(target_currency)),reserve,peak,first_gap,gaps,actor,actor) returning id into plan_id;
  insert into public.treasury_funding_actions(plan_id,academy_id,action_type,title,target_amount_minor,due_on,assigned_to,created_by,updated_by) values(plan_id,target_academy_id,'short_term_funding','Close peak forecast liquidity gap',peak,first_gap,actor,actor,actor);
  perform public.write_audit_event(target_academy_id,'treasury.funding_plan_generated','treasury_funding_plan',plan_id,jsonb_build_object('peak_shortfall_minor',peak,'first_gap_on',first_gap,'gap_weeks',gaps,'scenario_id',target_scenario_id));return plan_id;
end; $$;

create or replace function public.add_treasury_funding_action(target_plan_id uuid,target_action_type public.treasury_funding_action_type,target_title text,target_amount_minor bigint,target_due_on date,target_assigned_to uuid default null,target_note text default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare actor uuid:=(select auth.uid()); scoped public.treasury_funding_plans%rowtype; action_id uuid; normalized_note text:=nullif(btrim(target_note),'');
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;select * into scoped from public.treasury_funding_plans where id=target_plan_id for update;if not found or scoped.status='closed' then raise exception 'open funding plan required' using errcode='23514'; end if;
  if char_length(btrim(target_title)) not between 2 and 160 or target_amount_minor<=0 or target_due_on is null or (normalized_note is not null and char_length(normalized_note) not between 2 and 500) then raise exception 'invalid funding action' using errcode='22023'; end if;
  if target_assigned_to is not null and not exists(select 1 from public.platform_access where user_id=target_assigned_to and status='active') then raise exception 'active platform assignee required' using errcode='22023'; end if;
  insert into public.treasury_funding_actions(plan_id,academy_id,action_type,title,target_amount_minor,due_on,assigned_to,note,created_by,updated_by) values(scoped.id,scoped.academy_id,target_action_type,btrim(target_title),target_amount_minor,target_due_on,target_assigned_to,normalized_note,actor,actor) returning id into action_id;
  perform public.write_audit_event(scoped.academy_id,'treasury.funding_action_added','treasury_funding_action',action_id,jsonb_build_object('plan_id',scoped.id,'action_type',target_action_type,'target_amount_minor',target_amount_minor,'due_on',target_due_on,'assigned_to',target_assigned_to));return action_id;
end; $$;

create or replace function public.update_treasury_funding_action(target_action_id uuid,target_status public.treasury_funding_action_status,target_assigned_to uuid default null,target_note text default null)
returns void language plpgsql security invoker set search_path='' as $$
declare actor uuid:=(select auth.uid()); scoped public.treasury_funding_actions%rowtype; plan_status public.treasury_funding_plan_status; normalized_note text:=nullif(btrim(target_note),'');
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;select * into scoped from public.treasury_funding_actions where id=target_action_id for update;if not found then raise exception 'funding action not found'; end if;select status into plan_status from public.treasury_funding_plans where id=scoped.plan_id;if plan_status='closed' then raise exception 'open funding action required' using errcode='23514'; end if;
  if (scoped.status='open' and target_status not in ('open','in_progress','completed','cancelled')) or (scoped.status='in_progress' and target_status not in ('in_progress','completed','cancelled')) or scoped.status in ('completed','cancelled') then raise exception 'invalid funding action transition' using errcode='23514'; end if;
  if target_assigned_to is not null and not exists(select 1 from public.platform_access where user_id=target_assigned_to and status='active') then raise exception 'active platform assignee required' using errcode='22023'; end if;
  if normalized_note is not null and char_length(normalized_note) not between 2 and 500 then raise exception 'invalid funding action note' using errcode='22023'; end if;
  update public.treasury_funding_actions set status=target_status,assigned_to=target_assigned_to,note=normalized_note,updated_by=actor,updated_at=now(),resolved_at=case when target_status in ('completed','cancelled') then now() else null end where id=scoped.id;
  perform public.write_audit_event(scoped.academy_id,'treasury.funding_action_'||target_status::text,'treasury_funding_action',scoped.id,jsonb_build_object('plan_id',scoped.plan_id,'assigned_to',target_assigned_to));
end; $$;

create or replace function public.transition_treasury_funding_plan(target_plan_id uuid,target_status public.treasury_funding_plan_status)
returns void language plpgsql security invoker set search_path='' as $$
declare actor uuid:=(select auth.uid()); scoped public.treasury_funding_plans%rowtype;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;select * into scoped from public.treasury_funding_plans where id=target_plan_id for update;if not found then raise exception 'funding plan not found'; end if;
  if (scoped.status='draft' and target_status<>'approved') or (scoped.status='approved' and target_status<>'closed') or scoped.status='closed' then raise exception 'invalid funding plan transition' using errcode='23514'; end if;
  if target_status='approved' and not exists(select 1 from public.treasury_funding_actions where plan_id=scoped.id and status not in ('cancelled')) then raise exception 'funding plan requires an action' using errcode='23514'; end if;
  if target_status='closed' and exists(select 1 from public.treasury_funding_actions where plan_id=scoped.id and status in ('open','in_progress')) then raise exception 'resolve all funding actions before closing plan' using errcode='23514'; end if;
  update public.treasury_funding_plans set status=target_status,approved_by=case when target_status='approved' then actor else approved_by end,approved_at=case when target_status='approved' then now() else approved_at end,closed_by=case when target_status='closed' then actor else null end,closed_at=case when target_status='closed' then now() else null end,updated_by=actor,updated_at=now() where id=scoped.id;
  perform public.write_audit_event(scoped.academy_id,'treasury.funding_plan_'||target_status::text,'treasury_funding_plan',scoped.id,jsonb_build_object('peak_shortfall_minor',scoped.peak_shortfall_minor));
end; $$;

revoke all on function public.generate_treasury_funding_plan(uuid,date,text,uuid),public.add_treasury_funding_action(uuid,public.treasury_funding_action_type,text,bigint,date,uuid,text),public.update_treasury_funding_action(uuid,public.treasury_funding_action_status,uuid,text),public.transition_treasury_funding_plan(uuid,public.treasury_funding_plan_status) from public,anon,authenticated;
grant execute on function public.generate_treasury_funding_plan(uuid,date,text,uuid),public.add_treasury_funding_action(uuid,public.treasury_funding_action_type,text,bigint,date,uuid,text),public.update_treasury_funding_action(uuid,public.treasury_funding_action_status,uuid,text),public.transition_treasury_funding_plan(uuid,public.treasury_funding_plan_status) to authenticated;
commit;
