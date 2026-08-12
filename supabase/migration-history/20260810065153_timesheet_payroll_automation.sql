begin;

create table public.staff_hourly_compensation_rates (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  staff_user_id uuid not null references auth.users(id) on delete restrict,
  amount_minor integer not null,
  currency text not null,
  effective_from date not null,
  effective_to date,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint staff_hourly_rates_amount_positive check (amount_minor > 0),
  constraint staff_hourly_rates_currency check (currency ~ '^[A-Z]{3}$'),
  constraint staff_hourly_rates_date_order check (effective_to is null or effective_to >= effective_from),
  unique (academy_id, staff_user_id, effective_from)
);

create index staff_hourly_rates_lookup_idx on public.staff_hourly_compensation_rates (academy_id, staff_user_id, effective_from desc);
create index staff_hourly_rates_created_by_idx on public.staff_hourly_compensation_rates (created_by);

alter table public.staff_hourly_compensation_rates enable row level security;
revoke all on public.staff_hourly_compensation_rates from public, anon, authenticated;
grant select, insert, update on public.staff_hourly_compensation_rates to authenticated;
grant select, insert, update, delete on public.staff_hourly_compensation_rates to service_role;

create policy staff_hourly_rates_read_administrators on public.staff_hourly_compensation_rates
for select to authenticated using ((select private.is_platform_administrator()));
create policy staff_hourly_rates_insert_administrators on public.staff_hourly_compensation_rates
for insert to authenticated with check ((select private.is_platform_administrator()) and created_by=(select auth.uid()));
create policy staff_hourly_rates_update_administrators on public.staff_hourly_compensation_rates
for update to authenticated using ((select private.is_platform_administrator())) with check ((select private.is_platform_administrator()));

alter table public.payroll_items add column staff_time_entry_id uuid references public.staff_time_entries(id) on delete restrict;
alter table public.payroll_items drop constraint payroll_items_item_type_check;
alter table public.payroll_items drop constraint payroll_items_check;
alter table public.payroll_items add constraint payroll_items_item_type_check check (item_type in ('lesson','timesheet','adjustment'));
alter table public.payroll_items add constraint payroll_items_source_check check (
  (item_type='lesson' and lesson_session_id is not null and staff_time_entry_id is null)
  or (item_type='timesheet' and lesson_session_id is null and staff_time_entry_id is not null)
  or (item_type='adjustment' and lesson_session_id is null and staff_time_entry_id is null)
);
alter table public.payroll_items add constraint payroll_items_staff_time_entry_unique unique (staff_time_entry_id);
create index payroll_items_staff_time_entry_idx on public.payroll_items (staff_time_entry_id) where staff_time_entry_id is not null;

grant insert on public.payroll_periods, public.payroll_items to authenticated;
create policy payroll_periods_insert_platform_administrators on public.payroll_periods
for insert to authenticated with check ((select private.is_platform_administrator()) and created_by=(select auth.uid()));
create policy payroll_items_insert_platform_administrators on public.payroll_items
for insert to authenticated with check ((select private.is_platform_administrator()) and created_by=(select auth.uid()));

create or replace function public.set_staff_hourly_compensation_rate(target_academy_id uuid,target_staff_user_id uuid,target_amount_minor integer,target_currency text,target_effective_from date)
returns uuid language plpgsql security invoker set search_path='' as $$
declare actor uuid := (select auth.uid()); rate_id uuid;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  if target_amount_minor<=0 or upper(target_currency)!~'^[A-Z]{3}$' or not exists(select 1 from public.academy_memberships m where m.academy_id=target_academy_id and m.user_id=target_staff_user_id and m.status='active' and m.role in ('academy_admin','coach')) then raise exception 'active staff membership and valid rate required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_academy_id::text||target_staff_user_id::text,0));
  update public.staff_hourly_compensation_rates set effective_to=target_effective_from-1 where academy_id=target_academy_id and staff_user_id=target_staff_user_id and effective_to is null and effective_from<target_effective_from;
  insert into public.staff_hourly_compensation_rates(academy_id,staff_user_id,amount_minor,currency,effective_from,created_by)
  values(target_academy_id,target_staff_user_id,target_amount_minor,upper(target_currency),target_effective_from,actor)
  on conflict(academy_id,staff_user_id,effective_from) do update set amount_minor=excluded.amount_minor,currency=excluded.currency,created_by=actor returning id into rate_id;
  perform public.write_audit_event(target_academy_id,'staff_hourly_rate.set','staff_hourly_compensation_rate',rate_id,jsonb_build_object('staff_user_id',target_staff_user_id,'amount_minor',target_amount_minor,'currency',upper(target_currency)));
  return rate_id;
end; $$;

create or replace function public.generate_payroll_with_timesheets(target_academy_id uuid,target_starts_on date,target_ends_on date,target_currency text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare actor uuid := (select auth.uid()); period_id uuid; academy_tz text; lesson_count integer; timesheet_count integer;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  if target_ends_on<target_starts_on or target_ends_on-target_starts_on>93 or upper(target_currency)!~'^[A-Z]{3}$' then raise exception 'invalid payroll period' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_academy_id::text||target_starts_on::text||target_ends_on::text||upper(target_currency),0));
  select timezone into academy_tz from public.academies where id=target_academy_id;
  if academy_tz is null then raise exception 'academy not found' using errcode='P0002'; end if;
  insert into public.payroll_periods(academy_id,starts_on,ends_on,currency,created_by) values(target_academy_id,target_starts_on,target_ends_on,upper(target_currency),actor) returning id into period_id;

  insert into public.payroll_items(payroll_period_id,academy_id,coach_user_id,lesson_session_id,item_type,description,amount_minor,currency,created_by)
  select period_id,l.academy_id,l.coach_user_id,l.id,'lesson','Completed lesson · '||l.title,r.amount_minor,r.currency,actor
  from public.lesson_sessions l join lateral (
    select amount_minor,currency from public.coach_compensation_rates r where r.academy_id=l.academy_id and r.coach_user_id=l.coach_user_id and r.effective_from<=(l.starts_at at time zone academy_tz)::date and (r.effective_to is null or r.effective_to>=(l.starts_at at time zone academy_tz)::date) and r.currency=upper(target_currency) order by r.effective_from desc limit 1
  ) r on true
  where l.academy_id=target_academy_id and l.coach_user_id is not null and l.status='completed' and (l.starts_at at time zone academy_tz)::date between target_starts_on and target_ends_on;
  get diagnostics lesson_count=row_count;

  insert into public.payroll_items(payroll_period_id,academy_id,coach_user_id,staff_time_entry_id,item_type,description,amount_minor,currency,created_by)
  select period_id,e.academy_id,e.staff_user_id,e.id,'timesheet','Approved timesheet · '||s.role_label||' · '||pay.payable_minutes||' min',round(r.amount_minor*pay.payable_minutes/60.0)::integer,r.currency,actor
  from public.staff_time_entries e
  join public.staff_shifts s on s.id=e.shift_id
  cross join lateral (select greatest(0,floor(extract(epoch from (e.clock_out_at-e.clock_in_at))/60)::integer-e.break_minutes) as payable_minutes) pay
  join lateral (
    select amount_minor,currency from public.staff_hourly_compensation_rates r where r.academy_id=e.academy_id and r.staff_user_id=e.staff_user_id and r.effective_from<=(e.clock_in_at at time zone academy_tz)::date and (r.effective_to is null or r.effective_to>=(e.clock_in_at at time zone academy_tz)::date) and r.currency=upper(target_currency) order by r.effective_from desc limit 1
  ) r on true
  where e.academy_id=target_academy_id and e.status='approved' and e.clock_out_at is not null and pay.payable_minutes>0 and (e.clock_in_at at time zone academy_tz)::date between target_starts_on and target_ends_on and not exists(select 1 from public.payroll_items prior where prior.staff_time_entry_id=e.id);
  get diagnostics timesheet_count=row_count;

  perform public.write_audit_event(target_academy_id,'payroll_period.generated','payroll_period',period_id,jsonb_build_object('starts_on',target_starts_on,'ends_on',target_ends_on,'lesson_items',lesson_count,'timesheet_items',timesheet_count));
  return period_id;
end; $$;

create or replace function public.add_payroll_adjustment(target_period_id uuid,target_coach_user_id uuid,target_description text,target_amount_minor integer)
returns uuid language plpgsql security invoker set search_path='' as $$
declare actor uuid := (select auth.uid()); scoped public.payroll_periods%rowtype; item_id uuid;
begin
  select * into scoped from public.payroll_periods where id=target_period_id for update;
  if not found or scoped.status<>'draft' or actor is null or not private.is_platform_administrator() then raise exception 'draft payroll and platform administrator access required' using errcode='42501'; end if;
  if target_amount_minor=0 or char_length(btrim(target_description)) not between 2 and 240 or not exists(select 1 from public.academy_memberships m where m.academy_id=scoped.academy_id and m.user_id=target_coach_user_id and m.status='active' and m.role in ('academy_admin','coach')) then raise exception 'active staff member and valid adjustment required' using errcode='22023'; end if;
  insert into public.payroll_items(payroll_period_id,academy_id,coach_user_id,item_type,description,amount_minor,currency,created_by) values(scoped.id,scoped.academy_id,target_coach_user_id,'adjustment',btrim(target_description),target_amount_minor,scoped.currency,actor) returning id into item_id;
  perform public.write_audit_event(scoped.academy_id,'payroll_adjustment.added','payroll_item',item_id,jsonb_build_object('payroll_period_id',scoped.id,'amount_minor',target_amount_minor));
  return item_id;
end; $$;

revoke all on function public.set_staff_hourly_compensation_rate(uuid,uuid,integer,text,date),public.generate_payroll_with_timesheets(uuid,date,date,text),public.add_payroll_adjustment(uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.set_staff_hourly_compensation_rate(uuid,uuid,integer,text,date),public.generate_payroll_with_timesheets(uuid,date,date,text),public.add_payroll_adjustment(uuid,uuid,text,integer) to authenticated;

commit;
