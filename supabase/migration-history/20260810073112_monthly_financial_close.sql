begin;

create type public.academy_budget_status as enum ('draft','approved');
create type public.financial_close_status as enum ('open','closed');

create table public.academy_monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  month_start date not null,
  currency text not null default 'JOD',
  revenue_budget_minor bigint not null default 0,
  operating_expense_budget_minor bigint not null default 0,
  payroll_budget_minor bigint not null default 0,
  supplier_budget_minor bigint not null default 0,
  status public.academy_budget_status not null default 'draft',
  note text,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_budget_month_first_day check (extract(day from month_start)=1),
  constraint academy_budget_currency check (currency ~ '^[A-Z]{3}$'),
  constraint academy_budget_nonnegative check (
    revenue_budget_minor>=0 and operating_expense_budget_minor>=0 and payroll_budget_minor>=0 and supplier_budget_minor>=0
  ),
  constraint academy_budget_note_length check (note is null or char_length(btrim(note)) between 2 and 500),
  constraint academy_budget_unique_period unique (academy_id,month_start,currency)
);

create table public.financial_close_periods (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  budget_id uuid not null references public.academy_monthly_budgets(id) on delete restrict,
  month_start date not null,
  currency text not null,
  status public.financial_close_status not null default 'closed',
  actuals jsonb not null,
  closed_by uuid references auth.users(id) on delete restrict,
  closed_at timestamptz,
  reopened_by uuid references auth.users(id) on delete restrict,
  reopened_at timestamptz,
  reopen_reason text,
  created_at timestamptz not null default now(),
  constraint financial_close_month_first_day check (extract(day from month_start)=1),
  constraint financial_close_currency check (currency ~ '^[A-Z]{3}$'),
  constraint financial_close_actuals_object check (jsonb_typeof(actuals)='object'),
  constraint financial_close_reason_length check (reopen_reason is null or char_length(btrim(reopen_reason)) between 2 and 240),
  constraint financial_close_state_consistency check (
    (status='closed' and closed_by is not null and closed_at is not null and reopened_by is null and reopened_at is null and reopen_reason is null)
    or (status='open' and closed_by is not null and closed_at is not null and reopened_by is not null and reopened_at is not null and reopen_reason is not null)
  ),
  constraint financial_close_unique_period unique (academy_id,month_start,currency)
);

create index academy_budgets_academy_month_idx on public.academy_monthly_budgets (academy_id,month_start desc);
create index academy_budgets_created_by_idx on public.academy_monthly_budgets (created_by);
create index academy_budgets_updated_by_idx on public.academy_monthly_budgets (updated_by);
create index financial_close_academy_month_idx on public.financial_close_periods (academy_id,month_start desc);
create index financial_close_budget_idx on public.financial_close_periods (budget_id);
create index financial_close_closed_by_idx on public.financial_close_periods (closed_by) where closed_by is not null;
create index financial_close_reopened_by_idx on public.financial_close_periods (reopened_by) where reopened_by is not null;

alter table public.academy_monthly_budgets enable row level security;
alter table public.financial_close_periods enable row level security;
revoke all on public.academy_monthly_budgets,public.financial_close_periods from public,anon,authenticated;
grant select,insert,update on public.academy_monthly_budgets,public.financial_close_periods to authenticated;
grant select,insert,update,delete on public.academy_monthly_budgets,public.financial_close_periods to service_role;
grant usage on type public.academy_budget_status,public.financial_close_status to authenticated;

create policy academy_budgets_read_platform on public.academy_monthly_budgets
for select to authenticated using ((select private.is_platform_user()));
create policy academy_budgets_insert_administrators on public.academy_monthly_budgets
for insert to authenticated with check ((select private.is_platform_administrator()) and created_by=(select auth.uid()) and updated_by=(select auth.uid()));
create policy academy_budgets_update_administrators on public.academy_monthly_budgets
for update to authenticated using ((select private.is_platform_administrator())) with check ((select private.is_platform_administrator()) and updated_by=(select auth.uid()));

create policy financial_close_read_platform on public.financial_close_periods
for select to authenticated using ((select private.is_platform_user()));
create policy financial_close_insert_administrators on public.financial_close_periods
for insert to authenticated with check ((select private.is_platform_administrator()));
create policy financial_close_update_administrators on public.financial_close_periods
for update to authenticated using ((select private.is_platform_administrator())) with check ((select private.is_platform_administrator()));

create function public.save_academy_monthly_budget(
  target_academy_id uuid,target_month_start date,target_currency text,target_revenue_budget_minor bigint,
  target_operating_expense_budget_minor bigint,target_payroll_budget_minor bigint,target_supplier_budget_minor bigint,target_note text
)
returns uuid language plpgsql security invoker set search_path='' as $$
declare actor uuid := (select auth.uid()); budget_id uuid; normalized_month date := date_trunc('month',target_month_start)::date;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  if upper(target_currency)!~'^[A-Z]{3}$' or least(target_revenue_budget_minor,target_operating_expense_budget_minor,target_payroll_budget_minor,target_supplier_budget_minor)<0 or (nullif(btrim(coalesce(target_note,'')),'') is not null and char_length(btrim(target_note)) not between 2 and 500) then raise exception 'invalid budget' using errcode='22023'; end if;
  if exists(select 1 from public.financial_close_periods c where c.academy_id=target_academy_id and c.month_start=normalized_month and c.currency=upper(target_currency) and c.status='closed') then raise exception 'closed period budget cannot change' using errcode='23514'; end if;
  insert into public.academy_monthly_budgets(academy_id,month_start,currency,revenue_budget_minor,operating_expense_budget_minor,payroll_budget_minor,supplier_budget_minor,note,created_by,updated_by)
  values(target_academy_id,normalized_month,upper(target_currency),target_revenue_budget_minor,target_operating_expense_budget_minor,target_payroll_budget_minor,target_supplier_budget_minor,nullif(btrim(coalesce(target_note,'')),''),actor,actor)
  on conflict(academy_id,month_start,currency) do update set revenue_budget_minor=excluded.revenue_budget_minor,operating_expense_budget_minor=excluded.operating_expense_budget_minor,payroll_budget_minor=excluded.payroll_budget_minor,supplier_budget_minor=excluded.supplier_budget_minor,note=excluded.note,status='draft',updated_by=actor,updated_at=now()
  returning id into budget_id;
  perform public.write_audit_event(target_academy_id,'academy_budget.saved','academy_monthly_budget',budget_id,jsonb_build_object('month_start',normalized_month,'currency',upper(target_currency)));
  return budget_id;
end; $$;

create function public.set_academy_budget_status(target_budget_id uuid,target_status public.academy_budget_status)
returns boolean language plpgsql security invoker set search_path='' as $$
declare actor uuid := (select auth.uid()); scoped public.academy_monthly_budgets%rowtype;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  select * into scoped from public.academy_monthly_budgets where id=target_budget_id for update;
  if not found then raise exception 'budget not found' using errcode='P0002'; end if;
  if exists(select 1 from public.financial_close_periods c where c.budget_id=scoped.id and c.status='closed') then raise exception 'closed period budget cannot change' using errcode='23514'; end if;
  update public.academy_monthly_budgets set status=target_status,updated_by=actor,updated_at=now() where id=scoped.id;
  perform public.write_audit_event(scoped.academy_id,'academy_budget.'||target_status::text,'academy_monthly_budget',scoped.id,jsonb_build_object('month_start',scoped.month_start,'currency',scoped.currency));
  return true;
end; $$;

create function public.get_financial_period_actuals(target_budget_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare actor uuid := (select auth.uid()); budget public.academy_monthly_budgets%rowtype; academy_tz text; start_at timestamptz; end_at timestamptz;
  revenue_actual bigint; operating_actual bigint; payroll_actual bigint; supplier_actual bigint;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  select * into budget from public.academy_monthly_budgets where id=target_budget_id;
  if not found then raise exception 'budget not found' using errcode='P0002'; end if;
  select timezone into academy_tz from public.academies where id=budget.academy_id;
  start_at:=budget.month_start::timestamp at time zone academy_tz;end_at:=(budget.month_start+interval '1 month')::timestamp at time zone academy_tz;
  select coalesce(sum(amount_minor),0) into revenue_actual from public.cash_receipts where academy_id=budget.academy_id and currency=budget.currency and received_at>=start_at and received_at<end_at;
  select coalesce(sum(amount_minor),0) into operating_actual from public.cash_expenses where academy_id=budget.academy_id and currency=budget.currency and incurred_at>=start_at and incurred_at<end_at;
  select coalesce(sum(item.amount_minor),0) into payroll_actual from public.payroll_periods period join public.payroll_items item on item.payroll_period_id=period.id where period.academy_id=budget.academy_id and period.currency=budget.currency and period.status='paid' and period.paid_at>=start_at and period.paid_at<end_at;
  select coalesce(sum(financial.amount_minor),0) into supplier_actual from public.supplier_invoices invoice join public.supplier_invoice_financials financial on financial.invoice_id=invoice.id where invoice.academy_id=budget.academy_id and financial.currency=budget.currency and invoice.status='paid' and invoice.paid_at>=start_at and invoice.paid_at<end_at;
  return jsonb_build_object('revenue_minor',revenue_actual,'operating_expense_minor',operating_actual,'payroll_minor',payroll_actual,'supplier_minor',supplier_actual,'net_cash_minor',revenue_actual-operating_actual-payroll_actual-supplier_actual);
end; $$;

create function public.close_financial_period(target_budget_id uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare actor uuid := (select auth.uid()); budget public.academy_monthly_budgets%rowtype; close_id uuid; period_end date; snapshot jsonb;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  select * into budget from public.academy_monthly_budgets where id=target_budget_id for update;
  if not found or budget.status<>'approved' then raise exception 'approved budget required' using errcode='23514'; end if;
  period_end := (budget.month_start+interval '1 month')::date;
  if exists(select 1 from public.bank_statement_lines line where line.academy_id=budget.academy_id and line.currency=budget.currency and line.transaction_date>=budget.month_start and line.transaction_date<period_end and line.status='unmatched') then raise exception 'unmatched bank transactions must be resolved' using errcode='23514'; end if;
  if exists(select 1 from public.financial_close_periods c where c.academy_id=budget.academy_id and c.month_start=budget.month_start and c.currency=budget.currency and c.status='closed') then raise exception 'period already closed' using errcode='23505'; end if;
  snapshot:=public.get_financial_period_actuals(budget.id)||jsonb_build_object('captured_at',now());
  insert into public.financial_close_periods(academy_id,budget_id,month_start,currency,status,actuals,closed_by,closed_at,reopened_by,reopened_at,reopen_reason)
  values(budget.academy_id,budget.id,budget.month_start,budget.currency,'closed',snapshot,actor,now(),null,null,null)
  on conflict(academy_id,month_start,currency) do update set budget_id=excluded.budget_id,status='closed',actuals=excluded.actuals,closed_by=actor,closed_at=now(),reopened_by=null,reopened_at=null,reopen_reason=null
  returning id into close_id;
  perform public.write_audit_event(budget.academy_id,'financial_period.closed','financial_close_period',close_id,jsonb_build_object('month_start',budget.month_start,'currency',budget.currency,'actuals',snapshot));
  return close_id;
end; $$;

create function public.reopen_financial_period(target_close_id uuid,target_reason text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare actor uuid := (select auth.uid()); scoped public.financial_close_periods%rowtype;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  if char_length(btrim(target_reason)) not between 2 and 240 then raise exception 'reopen reason required' using errcode='22023'; end if;
  select * into scoped from public.financial_close_periods where id=target_close_id for update;
  if not found or scoped.status<>'closed' then raise exception 'closed period required' using errcode='23514'; end if;
  update public.financial_close_periods set status='open',reopened_by=actor,reopened_at=now(),reopen_reason=btrim(target_reason) where id=scoped.id;
  perform public.write_audit_event(scoped.academy_id,'financial_period.reopened','financial_close_period',scoped.id,jsonb_build_object('month_start',scoped.month_start,'currency',scoped.currency,'reason',btrim(target_reason)));
  return true;
end; $$;

revoke all on function public.save_academy_monthly_budget(uuid,date,text,bigint,bigint,bigint,bigint,text),public.set_academy_budget_status(uuid,public.academy_budget_status),public.get_financial_period_actuals(uuid),public.close_financial_period(uuid),public.reopen_financial_period(uuid,text) from public,anon,authenticated;
grant execute on function public.save_academy_monthly_budget(uuid,date,text,bigint,bigint,bigint,bigint,text),public.set_academy_budget_status(uuid,public.academy_budget_status),public.get_financial_period_actuals(uuid),public.close_financial_period(uuid),public.reopen_financial_period(uuid,text) to authenticated;

commit;
