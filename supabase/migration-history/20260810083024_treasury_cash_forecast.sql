begin;

create table public.treasury_opening_balances (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete restrict,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  as_of_date date not null,
  amount_minor bigint not null,
  note text,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treasury_opening_balance_note_length check (note is null or char_length(note) between 2 and 500),
  unique (academy_id,currency,as_of_date)
);

create table public.treasury_recurring_costs (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete restrict,
  title text not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  next_due_on date not null,
  recurrence_days integer not null,
  ends_on date,
  active boolean not null default true,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treasury_recurring_cost_title_length check (char_length(title) between 2 and 160),
  constraint treasury_recurring_cost_days_range check (recurrence_days between 7 and 365),
  constraint treasury_recurring_cost_end_order check (ends_on is null or ends_on>=next_due_on)
);

create index treasury_opening_balances_lookup_idx on public.treasury_opening_balances(academy_id,currency,as_of_date desc);
create index treasury_opening_balances_created_by_idx on public.treasury_opening_balances(created_by);
create index treasury_recurring_costs_due_idx on public.treasury_recurring_costs(academy_id,currency,active,next_due_on);
create index treasury_recurring_costs_created_by_idx on public.treasury_recurring_costs(created_by);

alter table public.treasury_opening_balances enable row level security;
alter table public.treasury_recurring_costs enable row level security;
revoke all on public.treasury_opening_balances,public.treasury_recurring_costs from public,anon,authenticated;
grant select,insert,update on public.treasury_opening_balances,public.treasury_recurring_costs to authenticated;
grant select,insert,update,delete on public.treasury_opening_balances,public.treasury_recurring_costs to service_role;

create policy treasury_opening_balances_read_administrators
on public.treasury_opening_balances for select to authenticated
using ((select private.is_platform_administrator()));
create policy treasury_opening_balances_insert_administrators
on public.treasury_opening_balances for insert to authenticated
with check ((select private.is_platform_administrator()) and created_by=(select auth.uid()) and updated_by=(select auth.uid()));
create policy treasury_opening_balances_update_administrators
on public.treasury_opening_balances for update to authenticated
using ((select private.is_platform_administrator()))
with check ((select private.is_platform_administrator()) and updated_by=(select auth.uid()));

create policy treasury_recurring_costs_read_administrators
on public.treasury_recurring_costs for select to authenticated
using ((select private.is_platform_administrator()));
create policy treasury_recurring_costs_insert_administrators
on public.treasury_recurring_costs for insert to authenticated
with check ((select private.is_platform_administrator()) and created_by=(select auth.uid()) and updated_by=(select auth.uid()));
create policy treasury_recurring_costs_update_administrators
on public.treasury_recurring_costs for update to authenticated
using ((select private.is_platform_administrator()))
with check ((select private.is_platform_administrator()) and updated_by=(select auth.uid()));

create or replace function public.set_treasury_opening_balance(target_academy_id uuid,target_currency text,target_as_of_date date,target_amount_minor bigint,target_note text default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare actor uuid:=(select auth.uid()); normalized_currency text:=upper(btrim(target_currency)); normalized_note text:=nullif(btrim(target_note),''); balance_id uuid;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  if normalized_currency!~'^[A-Z]{3}$' or target_as_of_date is null or (normalized_note is not null and char_length(normalized_note) not between 2 and 500) then raise exception 'invalid treasury opening balance' using errcode='22023'; end if;
  if not exists(select 1 from public.academies where id=target_academy_id and archived_at is null) then raise exception 'academy not found'; end if;
  insert into public.treasury_opening_balances(academy_id,currency,as_of_date,amount_minor,note,created_by,updated_by)
  values(target_academy_id,normalized_currency,target_as_of_date,target_amount_minor,normalized_note,actor,actor)
  on conflict(academy_id,currency,as_of_date) do update set amount_minor=excluded.amount_minor,note=excluded.note,updated_by=actor,updated_at=now()
  returning id into balance_id;
  perform public.write_audit_event(target_academy_id,'treasury.opening_balance_set','treasury_opening_balance',balance_id,jsonb_build_object('as_of_date',target_as_of_date,'amount_minor',target_amount_minor,'currency',normalized_currency));
  return balance_id;
end; $$;

create or replace function public.save_treasury_recurring_cost(target_academy_id uuid,target_title text,target_amount_minor bigint,target_currency text,target_next_due_on date,target_recurrence_days integer,target_ends_on date default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare actor uuid:=(select auth.uid()); normalized_title text:=btrim(target_title); normalized_currency text:=upper(btrim(target_currency)); cost_id uuid;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  if char_length(normalized_title) not between 2 and 160 or target_amount_minor<=0 or normalized_currency!~'^[A-Z]{3}$' or target_next_due_on is null or target_recurrence_days not between 7 and 365 or (target_ends_on is not null and target_ends_on<target_next_due_on) then raise exception 'invalid recurring treasury cost' using errcode='22023'; end if;
  insert into public.treasury_recurring_costs(academy_id,title,amount_minor,currency,next_due_on,recurrence_days,ends_on,created_by,updated_by)
  values(target_academy_id,normalized_title,target_amount_minor,normalized_currency,target_next_due_on,target_recurrence_days,target_ends_on,actor,actor) returning id into cost_id;
  perform public.write_audit_event(target_academy_id,'treasury.recurring_cost_saved','treasury_recurring_cost',cost_id,jsonb_build_object('amount_minor',target_amount_minor,'currency',normalized_currency,'recurrence_days',target_recurrence_days));
  return cost_id;
end; $$;

create or replace function public.set_treasury_recurring_cost_active(target_cost_id uuid,target_active boolean)
returns void language plpgsql security invoker set search_path='' as $$
declare actor uuid:=(select auth.uid()); scoped public.treasury_recurring_costs%rowtype;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  select * into scoped from public.treasury_recurring_costs where id=target_cost_id for update;
  if not found then raise exception 'recurring treasury cost not found'; end if;
  update public.treasury_recurring_costs set active=target_active,updated_by=actor,updated_at=now() where id=scoped.id;
  perform public.write_audit_event(scoped.academy_id,'treasury.recurring_cost_'||case when target_active then 'activated' else 'paused' end,'treasury_recurring_cost',scoped.id,jsonb_build_object('active',target_active));
end; $$;

create or replace function public.get_treasury_cash_forecast(target_academy_id uuid,target_start_on date,target_currency text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare actor uuid:=(select auth.uid()); normalized_currency text:=upper(btrim(target_currency)); result jsonb; opening_minor bigint;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  if target_start_on is null or normalized_currency!~'^[A-Z]{3}$' then raise exception 'invalid treasury forecast range' using errcode='22023'; end if;
  select coalesce((select balance.amount_minor from public.treasury_opening_balances balance where balance.academy_id=target_academy_id and balance.currency=normalized_currency and balance.as_of_date<=target_start_on order by balance.as_of_date desc limit 1),0) into opening_minor;
  with weeks as (
    select n as week_index,target_start_on+(n*7) as week_start,target_start_on+(n*7)+6 as week_end from generate_series(0,12) n
  ), receivables as (
    select week.week_index,coalesce(sum(invoice.amount_minor),0)::bigint amount
    from weeks week left join public.invoices invoice on invoice.academy_id=target_academy_id and invoice.currency=normalized_currency and invoice.status in ('issued','overdue') and greatest(invoice.due_at::date,target_start_on) between week.week_start and week.week_end group by week.week_index
  ), supplier_runs as (
    select week.week_index,coalesce(sum(item.amount_minor),0)::bigint amount
    from weeks week left join public.supplier_payment_runs run on run.academy_id=target_academy_id and run.currency=normalized_currency and run.status='approved' and run.scheduled_on between week.week_start and week.week_end
    left join public.supplier_payment_run_items item on item.payment_run_id=run.id group by week.week_index
  ), payroll_due as (
    select week.week_index,coalesce(sum(item.amount_minor),0)::bigint amount
    from weeks week left join public.payroll_periods period on period.academy_id=target_academy_id and period.currency=normalized_currency and period.status='approved'
      and period.ends_on+coalesce((select settings.payroll_due_days_after_period from public.payment_reminder_settings settings where settings.academy_id=target_academy_id),7) between week.week_start and week.week_end
    left join public.payroll_items item on item.payroll_period_id=period.id group by week.week_index
  ), recurring_due as (
    select week.week_index,coalesce(sum(case when occurrence.n is not null then cost.amount_minor else 0 end),0)::bigint amount
    from weeks week left join public.treasury_recurring_costs cost on cost.academy_id=target_academy_id and cost.currency=normalized_currency and cost.active
    left join generate_series(0,13) occurrence(n) on cost.next_due_on+(cost.recurrence_days*occurrence.n) between week.week_start and week.week_end and (cost.ends_on is null or cost.next_due_on+(cost.recurrence_days*occurrence.n)<=cost.ends_on)
    group by week.week_index
  ), flows as (
    select week.week_index,week.week_start,week.week_end,receivables.amount expected_receipts_minor,supplier_runs.amount supplier_payments_minor,payroll_due.amount payroll_minor,recurring_due.amount recurring_costs_minor,
      receivables.amount-supplier_runs.amount-payroll_due.amount-recurring_due.amount net_minor
    from weeks week join receivables using(week_index) join supplier_runs using(week_index) join payroll_due using(week_index) join recurring_due using(week_index)
  ), balances as (
    select flows.*,opening_minor+sum(net_minor) over(order by week_index rows between unbounded preceding and current row) closing_balance_minor from flows
  )
  select jsonb_build_object(
    'start_on',target_start_on,'currency',normalized_currency,'opening_balance_minor',opening_minor,
    'expected_receipts_minor',coalesce(sum(expected_receipts_minor),0),'supplier_payments_minor',coalesce(sum(supplier_payments_minor),0),'payroll_minor',coalesce(sum(payroll_minor),0),'recurring_costs_minor',coalesce(sum(recurring_costs_minor),0),
    'projected_closing_balance_minor',coalesce((array_agg(closing_balance_minor order by week_index desc))[1],opening_minor),'minimum_balance_minor',coalesce(min(closing_balance_minor),opening_minor),
    'weeks',jsonb_agg(jsonb_build_object('week_index',week_index,'week_start',week_start,'week_end',week_end,'expected_receipts_minor',expected_receipts_minor,'supplier_payments_minor',supplier_payments_minor,'payroll_minor',payroll_minor,'recurring_costs_minor',recurring_costs_minor,'net_minor',net_minor,'closing_balance_minor',closing_balance_minor) order by week_index)
  ) into result from balances;
  return result;
end; $$;

revoke all on function public.set_treasury_opening_balance(uuid,text,date,bigint,text),public.save_treasury_recurring_cost(uuid,text,bigint,text,date,integer,date),public.set_treasury_recurring_cost_active(uuid,boolean),public.get_treasury_cash_forecast(uuid,date,text) from public,anon,authenticated;
grant execute on function public.set_treasury_opening_balance(uuid,text,date,bigint,text),public.save_treasury_recurring_cost(uuid,text,bigint,text,date,integer,date),public.set_treasury_recurring_cost_active(uuid,boolean),public.get_treasury_cash_forecast(uuid,date,text) to authenticated;

commit;
