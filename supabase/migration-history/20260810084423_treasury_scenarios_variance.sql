begin;

create table public.treasury_forecast_scenarios (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete restrict,
  name text not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  receipts_percent numeric(5,2) not null default 100 check (receipts_percent between 0 and 200),
  supplier_percent numeric(5,2) not null default 100 check (supplier_percent between 0 and 200),
  payroll_percent numeric(5,2) not null default 100 check (payroll_percent between 0 and 200),
  recurring_percent numeric(5,2) not null default 100 check (recurring_percent between 0 and 200),
  reserve_floor_minor bigint not null default 0 check (reserve_floor_minor >= 0),
  active boolean not null default true,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treasury_forecast_scenario_name_length check (char_length(name) between 2 and 100)
);

create unique index treasury_forecast_scenarios_name_idx on public.treasury_forecast_scenarios(academy_id,currency,lower(name));
create index treasury_forecast_scenarios_active_idx on public.treasury_forecast_scenarios(academy_id,currency,active);
create index treasury_forecast_scenarios_created_by_idx on public.treasury_forecast_scenarios(created_by);

create table public.treasury_forecast_snapshots (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete restrict,
  scenario_id uuid references public.treasury_forecast_scenarios(id) on delete restrict,
  start_on date not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  forecast jsonb not null check (jsonb_typeof(forecast)='object'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index treasury_forecast_snapshots_lookup_idx on public.treasury_forecast_snapshots(academy_id,currency,start_on desc,created_at desc);
create index treasury_forecast_snapshots_scenario_idx on public.treasury_forecast_snapshots(scenario_id);
create index treasury_forecast_snapshots_created_by_idx on public.treasury_forecast_snapshots(created_by);

alter table public.treasury_forecast_scenarios enable row level security;
alter table public.treasury_forecast_snapshots enable row level security;
revoke all on public.treasury_forecast_scenarios,public.treasury_forecast_snapshots from public,anon,authenticated;
grant select,insert,update on public.treasury_forecast_scenarios to authenticated;
grant select,insert on public.treasury_forecast_snapshots to authenticated;
grant select,insert,update,delete on public.treasury_forecast_scenarios,public.treasury_forecast_snapshots to service_role;

create policy treasury_forecast_scenarios_read_administrators on public.treasury_forecast_scenarios for select to authenticated using ((select private.is_platform_administrator()));
create policy treasury_forecast_scenarios_insert_administrators on public.treasury_forecast_scenarios for insert to authenticated with check ((select private.is_platform_administrator()) and created_by=(select auth.uid()) and updated_by=(select auth.uid()));
create policy treasury_forecast_scenarios_update_administrators on public.treasury_forecast_scenarios for update to authenticated using ((select private.is_platform_administrator())) with check ((select private.is_platform_administrator()) and updated_by=(select auth.uid()));
create policy treasury_forecast_snapshots_read_administrators on public.treasury_forecast_snapshots for select to authenticated using ((select private.is_platform_administrator()));
create policy treasury_forecast_snapshots_insert_administrators on public.treasury_forecast_snapshots for insert to authenticated with check ((select private.is_platform_administrator()) and created_by=(select auth.uid()));

create or replace function public.save_treasury_forecast_scenario(target_academy_id uuid,target_name text,target_currency text,target_receipts_percent numeric,target_supplier_percent numeric,target_payroll_percent numeric,target_recurring_percent numeric,target_reserve_floor_minor bigint)
returns uuid language plpgsql security invoker set search_path='' as $$
declare actor uuid:=(select auth.uid()); normalized_name text:=btrim(target_name); normalized_currency text:=upper(btrim(target_currency)); scenario_id uuid;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  if char_length(normalized_name) not between 2 and 100 or normalized_currency!~'^[A-Z]{3}$' or target_receipts_percent not between 0 and 200 or target_supplier_percent not between 0 and 200 or target_payroll_percent not between 0 and 200 or target_recurring_percent not between 0 and 200 or target_reserve_floor_minor<0 then raise exception 'invalid treasury scenario' using errcode='22023'; end if;
  insert into public.treasury_forecast_scenarios(academy_id,name,currency,receipts_percent,supplier_percent,payroll_percent,recurring_percent,reserve_floor_minor,created_by,updated_by)
  values(target_academy_id,normalized_name,normalized_currency,target_receipts_percent,target_supplier_percent,target_payroll_percent,target_recurring_percent,target_reserve_floor_minor,actor,actor)
  on conflict(academy_id,currency,(lower(name))) do update set receipts_percent=excluded.receipts_percent,supplier_percent=excluded.supplier_percent,payroll_percent=excluded.payroll_percent,recurring_percent=excluded.recurring_percent,reserve_floor_minor=excluded.reserve_floor_minor,active=true,updated_by=actor,updated_at=now()
  returning id into scenario_id;
  perform public.write_audit_event(target_academy_id,'treasury.scenario_saved','treasury_forecast_scenario',scenario_id,jsonb_build_object('name',normalized_name,'currency',normalized_currency,'reserve_floor_minor',target_reserve_floor_minor));
  return scenario_id;
end; $$;

create or replace function public.set_treasury_forecast_scenario_active(target_scenario_id uuid,target_active boolean)
returns void language plpgsql security invoker set search_path='' as $$
declare actor uuid:=(select auth.uid()); scoped public.treasury_forecast_scenarios%rowtype;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  select * into scoped from public.treasury_forecast_scenarios where id=target_scenario_id for update;
  if not found then raise exception 'treasury scenario not found'; end if;
  update public.treasury_forecast_scenarios set active=target_active,updated_by=actor,updated_at=now() where id=scoped.id;
  perform public.write_audit_event(scoped.academy_id,'treasury.scenario_'||case when target_active then 'activated' else 'paused' end,'treasury_forecast_scenario',scoped.id,jsonb_build_object('active',target_active));
end; $$;

create or replace function public.get_treasury_scenario_forecast(target_academy_id uuid,target_start_on date,target_currency text,target_scenario_id uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare actor uuid:=(select auth.uid()); base jsonb; result jsonb; opening_minor bigint; r_pct numeric:=100; s_pct numeric:=100; p_pct numeric:=100; c_pct numeric:=100; reserve_minor bigint:=0; scenario_name text:='Base case';
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  base:=public.get_treasury_cash_forecast(target_academy_id,target_start_on,target_currency);
  opening_minor:=(base->>'opening_balance_minor')::bigint;
  if target_scenario_id is not null then
    select receipts_percent,supplier_percent,payroll_percent,recurring_percent,reserve_floor_minor,name into r_pct,s_pct,p_pct,c_pct,reserve_minor,scenario_name from public.treasury_forecast_scenarios where id=target_scenario_id and academy_id=target_academy_id and currency=upper(btrim(target_currency)) and active;
    if not found then raise exception 'active treasury scenario not found' using errcode='22023'; end if;
  end if;
  with source as (
    select value,(value->>'week_index')::integer week_index,(value->>'week_start')::date week_start,(value->>'week_end')::date week_end,
      round((value->>'expected_receipts_minor')::numeric*r_pct/100)::bigint receipts,
      round((value->>'supplier_payments_minor')::numeric*s_pct/100)::bigint suppliers,
      round((value->>'payroll_minor')::numeric*p_pct/100)::bigint payroll,
      round((value->>'recurring_costs_minor')::numeric*c_pct/100)::bigint recurring
    from jsonb_array_elements(base->'weeks')
  ), flows as (
    select *,receipts-suppliers-payroll-recurring net from source
  ), balances as (
    select *,opening_minor+sum(net) over(order by week_index rows between unbounded preceding and current row) closing from flows
  )
  select jsonb_build_object('start_on',target_start_on,'currency',upper(btrim(target_currency)),'scenario_id',target_scenario_id,'scenario_name',scenario_name,'reserve_floor_minor',reserve_minor,'opening_balance_minor',opening_minor,
    'expected_receipts_minor',coalesce(sum(receipts),0),'supplier_payments_minor',coalesce(sum(suppliers),0),'payroll_minor',coalesce(sum(payroll),0),'recurring_costs_minor',coalesce(sum(recurring),0),
    'projected_closing_balance_minor',coalesce((array_agg(closing order by week_index desc))[1],opening_minor),'minimum_balance_minor',coalesce(min(closing),opening_minor),
    'weeks',jsonb_agg(jsonb_build_object('week_index',week_index,'week_start',week_start,'week_end',week_end,'expected_receipts_minor',receipts,'supplier_payments_minor',suppliers,'payroll_minor',payroll,'recurring_costs_minor',recurring,'net_minor',net,'closing_balance_minor',closing,'below_reserve',closing<reserve_minor) order by week_index)) into result from balances;
  return result;
end; $$;

create or replace function public.capture_treasury_forecast_snapshot(target_academy_id uuid,target_start_on date,target_currency text,target_scenario_id uuid default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare actor uuid:=(select auth.uid()); snapshot_id uuid; captured jsonb;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  captured:=public.get_treasury_scenario_forecast(target_academy_id,target_start_on,target_currency,target_scenario_id);
  insert into public.treasury_forecast_snapshots(academy_id,scenario_id,start_on,currency,forecast,created_by) values(target_academy_id,target_scenario_id,target_start_on,upper(btrim(target_currency)),captured,actor) returning id into snapshot_id;
  perform public.write_audit_event(target_academy_id,'treasury.forecast_snapshot_captured','treasury_forecast_snapshot',snapshot_id,jsonb_build_object('start_on',target_start_on,'currency',upper(btrim(target_currency)),'scenario_id',target_scenario_id));
  return snapshot_id;
end; $$;

revoke all on function public.save_treasury_forecast_scenario(uuid,text,text,numeric,numeric,numeric,numeric,bigint),public.set_treasury_forecast_scenario_active(uuid,boolean),public.get_treasury_scenario_forecast(uuid,date,text,uuid),public.capture_treasury_forecast_snapshot(uuid,date,text,uuid) from public,anon,authenticated;
grant execute on function public.save_treasury_forecast_scenario(uuid,text,text,numeric,numeric,numeric,numeric,bigint),public.set_treasury_forecast_scenario_active(uuid,boolean),public.get_treasury_scenario_forecast(uuid,date,text,uuid),public.capture_treasury_forecast_snapshot(uuid,date,text,uuid) to authenticated;

commit;
