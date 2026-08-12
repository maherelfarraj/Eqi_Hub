begin;

create table public.receivable_collection_cases (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete restrict,
  invoice_id uuid not null unique references public.invoices(id) on delete restrict,
  assigned_to uuid references public.platform_access(user_id) on delete set null,
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  status text not null default 'open' check (status in ('open','promised','escalated','resolved','cancelled')),
  next_action_on date,
  promise_due_on date,
  promise_amount_minor bigint check (promise_amount_minor is null or promise_amount_minor>0),
  last_contact_at timestamptz,
  note text,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint receivable_case_note_length check (note is null or char_length(note) between 2 and 500),
  constraint receivable_case_promise_pair check ((promise_due_on is null)=(promise_amount_minor is null))
);

create table public.receivable_collection_events (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete restrict,
  case_id uuid not null references public.receivable_collection_cases(id) on delete restrict,
  channel text not null check (channel in ('phone','email','sms','whatsapp','in_person','internal')),
  outcome text not null check (outcome in ('contacted','no_answer','promised','disputed','payment_received','broken_promise','note')),
  note text not null check (char_length(note) between 2 and 1000),
  promise_due_on date,
  promise_amount_minor bigint check (promise_amount_minor is null or promise_amount_minor>0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint receivable_event_promise_pair check ((promise_due_on is null)=(promise_amount_minor is null)),
  constraint receivable_event_promise_outcome check (outcome='promised' or promise_due_on is null)
);

create index receivable_collection_cases_queue_idx on public.receivable_collection_cases(academy_id,status,next_action_on,priority);
create index receivable_collection_cases_assignee_idx on public.receivable_collection_cases(assigned_to) where assigned_to is not null;
create index receivable_collection_events_case_created_idx on public.receivable_collection_events(case_id,created_at desc);
create index receivable_collection_events_created_by_idx on public.receivable_collection_events(created_by);

alter table public.receivable_collection_cases enable row level security;
alter table public.receivable_collection_events enable row level security;
revoke all on public.receivable_collection_cases,public.receivable_collection_events from public,anon,authenticated;
grant select,insert,update on public.receivable_collection_cases to authenticated;
grant select,insert on public.receivable_collection_events to authenticated;
grant select,insert,update,delete on public.receivable_collection_cases,public.receivable_collection_events to service_role;

create policy receivable_collection_cases_read_administrators on public.receivable_collection_cases for select to authenticated
using ((select private.is_platform_administrator()));
create policy receivable_collection_cases_insert_administrators on public.receivable_collection_cases for insert to authenticated
with check ((select private.is_platform_administrator()) and created_by=(select auth.uid()) and updated_by=(select auth.uid()));
create policy receivable_collection_cases_update_administrators on public.receivable_collection_cases for update to authenticated
using ((select private.is_platform_administrator()))
with check ((select private.is_platform_administrator()) and updated_by=(select auth.uid()));
create policy receivable_collection_events_read_administrators on public.receivable_collection_events for select to authenticated
using ((select private.is_platform_administrator()));
create policy receivable_collection_events_insert_administrators on public.receivable_collection_events for insert to authenticated
with check ((select private.is_platform_administrator()) and created_by=(select auth.uid()));

create function public.open_receivable_collection_case(target_invoice_id uuid,target_priority text default 'normal',target_assigned_to uuid default null,target_next_action_on date default null,target_note text default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare actor uuid:=(select auth.uid()); scoped public.invoices%rowtype; case_id uuid; normalized_note text:=nullif(btrim(target_note),'');
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  if target_priority not in ('low','normal','high','critical') or (normalized_note is not null and char_length(normalized_note) not between 2 and 500) then raise exception 'invalid collection case' using errcode='22023'; end if;
  select * into scoped from public.invoices where id=target_invoice_id for update;
  if not found or scoped.status not in ('issued','overdue') then raise exception 'open invoice required' using errcode='23514'; end if;
  if target_assigned_to is not null and not exists(select 1 from public.platform_access where user_id=target_assigned_to and status='active') then raise exception 'active platform assignee required' using errcode='23514'; end if;
  insert into public.receivable_collection_cases(academy_id,invoice_id,assigned_to,priority,next_action_on,note,created_by,updated_by)
  values(scoped.academy_id,scoped.id,target_assigned_to,target_priority,coalesce(target_next_action_on,current_date),normalized_note,actor,actor)
  on conflict(invoice_id) do update set assigned_to=excluded.assigned_to,priority=excluded.priority,status='open',next_action_on=excluded.next_action_on,promise_due_on=null,promise_amount_minor=null,note=excluded.note,updated_by=actor,updated_at=now()
  returning id into case_id;
  perform public.write_audit_event(scoped.academy_id,'receivable.collection_case_opened','receivable_collection_case',case_id,jsonb_build_object('invoice_id',scoped.id,'priority',target_priority,'assigned_to',target_assigned_to));
  return case_id;
end; $$;

create function public.record_receivable_collection_event(target_case_id uuid,target_channel text,target_outcome text,target_note text,target_promise_due_on date default null,target_promise_amount_minor bigint default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare actor uuid:=(select auth.uid()); scoped public.receivable_collection_cases%rowtype; invoice_amount bigint; event_id uuid; normalized_note text:=btrim(target_note);
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  if target_channel not in ('phone','email','sms','whatsapp','in_person','internal') or target_outcome not in ('contacted','no_answer','promised','disputed','payment_received','broken_promise','note') or char_length(normalized_note) not between 2 and 1000 then raise exception 'invalid collection event' using errcode='22023'; end if;
  select * into scoped from public.receivable_collection_cases where id=target_case_id for update;
  if not found or scoped.status in ('resolved','cancelled') then raise exception 'active collection case required' using errcode='23514'; end if;
  select amount_minor into invoice_amount from public.invoices where id=scoped.invoice_id;
  if target_outcome='promised' and (target_promise_due_on is null or target_promise_due_on<current_date or target_promise_amount_minor is null or target_promise_amount_minor<=0 or target_promise_amount_minor>invoice_amount) then raise exception 'valid future payment promise required' using errcode='22023'; end if;
  if target_outcome<>'promised' and (target_promise_due_on is not null or target_promise_amount_minor is not null) then raise exception 'promise details require promised outcome' using errcode='22023'; end if;
  insert into public.receivable_collection_events(academy_id,case_id,channel,outcome,note,promise_due_on,promise_amount_minor,created_by)
  values(scoped.academy_id,scoped.id,target_channel,target_outcome,normalized_note,target_promise_due_on,target_promise_amount_minor,actor) returning id into event_id;
  update public.receivable_collection_cases set
    status=case when target_outcome='promised' then 'promised' when target_outcome in ('disputed','broken_promise') then 'escalated' else status end,
    promise_due_on=case when target_outcome='promised' then target_promise_due_on when target_outcome='broken_promise' then null else promise_due_on end,
    promise_amount_minor=case when target_outcome='promised' then target_promise_amount_minor when target_outcome='broken_promise' then null else promise_amount_minor end,
    last_contact_at=case when target_channel<>'internal' then now() else last_contact_at end,
    next_action_on=case when target_outcome='promised' then target_promise_due_on when target_outcome in ('no_answer','broken_promise') then current_date+1 else next_action_on end,
    updated_by=actor,updated_at=now() where id=scoped.id;
  perform public.write_audit_event(scoped.academy_id,'receivable.collection_event_recorded','receivable_collection_case',scoped.id,jsonb_build_object('event_id',event_id,'channel',target_channel,'outcome',target_outcome,'promise_due_on',target_promise_due_on,'promise_amount_minor',target_promise_amount_minor));
  return event_id;
end; $$;

create function public.update_receivable_collection_case(target_case_id uuid,target_status text,target_priority text,target_assigned_to uuid default null,target_next_action_on date default null,target_note text default null)
returns void language plpgsql security invoker set search_path='' as $$
declare actor uuid:=(select auth.uid()); scoped public.receivable_collection_cases%rowtype; invoice_status public.invoice_status; normalized_note text:=nullif(btrim(target_note),'');
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  if target_status not in ('open','promised','escalated','resolved','cancelled') or target_priority not in ('low','normal','high','critical') or (normalized_note is not null and char_length(normalized_note) not between 2 and 500) then raise exception 'invalid collection case update' using errcode='22023'; end if;
  if target_assigned_to is not null and not exists(select 1 from public.platform_access where user_id=target_assigned_to and status='active') then raise exception 'active platform assignee required' using errcode='23514'; end if;
  select * into scoped from public.receivable_collection_cases where id=target_case_id for update;
  if not found then raise exception 'collection case not found'; end if;
  select status into invoice_status from public.invoices where id=scoped.invoice_id;
  if target_status='resolved' and invoice_status in ('issued','overdue') then raise exception 'settle or void invoice before resolving case' using errcode='23514'; end if;
  if target_status='promised' and scoped.promise_due_on is null then raise exception 'record a payment promise before setting promised status' using errcode='23514'; end if;
  update public.receivable_collection_cases set status=target_status,priority=target_priority,assigned_to=target_assigned_to,next_action_on=target_next_action_on,note=normalized_note,updated_by=actor,updated_at=now() where id=scoped.id;
  perform public.write_audit_event(scoped.academy_id,'receivable.collection_case_updated','receivable_collection_case',scoped.id,jsonb_build_object('status',target_status,'priority',target_priority,'assigned_to',target_assigned_to,'next_action_on',target_next_action_on));
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
  ), scheduled_receivables as (
    select invoice.amount_minor,greatest(coalesce(collection_case.promise_due_on,invoice.due_at::date),target_start_on) receipt_on
    from public.invoices invoice left join public.receivable_collection_cases collection_case on collection_case.invoice_id=invoice.id and collection_case.status='promised' and collection_case.promise_due_on is not null
    where invoice.academy_id=target_academy_id and invoice.currency=normalized_currency and invoice.status in ('issued','overdue')
  ), receivables as (
    select week.week_index,coalesce(sum(receivable.amount_minor),0)::bigint amount
    from weeks week left join scheduled_receivables receivable on receivable.receipt_on between week.week_start and week.week_end group by week.week_index
  ), supplier_runs as (
    select week.week_index,coalesce(sum(item.amount_minor),0)::bigint amount from weeks week left join public.supplier_payment_runs run on run.academy_id=target_academy_id and run.currency=normalized_currency and run.status='approved' and run.scheduled_on between week.week_start and week.week_end left join public.supplier_payment_run_items item on item.payment_run_id=run.id group by week.week_index
  ), payroll_due as (
    select week.week_index,coalesce(sum(item.amount_minor),0)::bigint amount from weeks week left join public.payroll_periods period on period.academy_id=target_academy_id and period.currency=normalized_currency and period.status='approved' and period.ends_on+coalesce((select settings.payroll_due_days_after_period from public.payment_reminder_settings settings where settings.academy_id=target_academy_id),7) between week.week_start and week.week_end left join public.payroll_items item on item.payroll_period_id=period.id group by week.week_index
  ), recurring_due as (
    select week.week_index,coalesce(sum(case when occurrence.n is not null then cost.amount_minor else 0 end),0)::bigint amount from weeks week left join public.treasury_recurring_costs cost on cost.academy_id=target_academy_id and cost.currency=normalized_currency and cost.active left join generate_series(0,13) occurrence(n) on cost.next_due_on+(cost.recurrence_days*occurrence.n) between week.week_start and week.week_end and (cost.ends_on is null or cost.next_due_on+(cost.recurrence_days*occurrence.n)<=cost.ends_on) group by week.week_index
  ), flows as (
    select week.week_index,week.week_start,week.week_end,receivables.amount expected_receipts_minor,supplier_runs.amount supplier_payments_minor,payroll_due.amount payroll_minor,recurring_due.amount recurring_costs_minor,receivables.amount-supplier_runs.amount-payroll_due.amount-recurring_due.amount net_minor from weeks week join receivables using(week_index) join supplier_runs using(week_index) join payroll_due using(week_index) join recurring_due using(week_index)
  ), balances as (
    select flows.*,opening_minor+sum(net_minor) over(order by week_index rows between unbounded preceding and current row) closing_balance_minor from flows
  )
  select jsonb_build_object('start_on',target_start_on,'currency',normalized_currency,'opening_balance_minor',opening_minor,'expected_receipts_minor',coalesce(sum(expected_receipts_minor),0),'supplier_payments_minor',coalesce(sum(supplier_payments_minor),0),'payroll_minor',coalesce(sum(payroll_minor),0),'recurring_costs_minor',coalesce(sum(recurring_costs_minor),0),'projected_closing_balance_minor',coalesce((array_agg(closing_balance_minor order by week_index desc))[1],opening_minor),'minimum_balance_minor',coalesce(min(closing_balance_minor),opening_minor),'weeks',jsonb_agg(jsonb_build_object('week_index',week_index,'week_start',week_start,'week_end',week_end,'expected_receipts_minor',expected_receipts_minor,'supplier_payments_minor',supplier_payments_minor,'payroll_minor',payroll_minor,'recurring_costs_minor',recurring_costs_minor,'net_minor',net_minor,'closing_balance_minor',closing_balance_minor) order by week_index)) into result from balances;
  return result;
end; $$;

revoke all on function public.open_receivable_collection_case(uuid,text,uuid,date,text),public.record_receivable_collection_event(uuid,text,text,text,date,bigint),public.update_receivable_collection_case(uuid,text,text,uuid,date,text) from public,anon,authenticated;
grant execute on function public.open_receivable_collection_case(uuid,text,uuid,date,text),public.record_receivable_collection_event(uuid,text,text,text,date,bigint),public.update_receivable_collection_case(uuid,text,text,uuid,date,text) to authenticated;

commit;
