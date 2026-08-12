begin;

create type public.financial_budget_plan_status as enum ('draft','approved','superseded');

create table public.financial_budget_plans(
 id uuid primary key default gen_random_uuid(),
 academy_id uuid not null references public.academies(id) on delete restrict,
 fiscal_year integer not null check(fiscal_year between 2020 and 2100),
 version integer not null check(version>0),
 name text not null check(char_length(btrim(name)) between 2 and 120),
 currency text not null check(currency~'^[A-Z]{3}$'),
 status public.financial_budget_plan_status not null default 'draft',
 variance_threshold_bps integer not null default 1000 check(variance_threshold_bps between 100 and 10000),
 note text check(note is null or char_length(btrim(note)) between 2 and 500),
 created_by uuid not null references auth.users(id) on delete restrict,
 approved_by uuid references auth.users(id) on delete restrict,
 approved_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint financial_budget_plan_version_unique unique(academy_id,fiscal_year,currency,version),
 constraint financial_budget_plan_approval_state check((status='draft' and approved_by is null and approved_at is null) or (status in('approved','superseded') and approved_by is not null and approved_at is not null))
);
create unique index financial_budget_one_approved_idx on public.financial_budget_plans(academy_id,fiscal_year,currency) where status='approved';
create index financial_budget_plans_academy_year_idx on public.financial_budget_plans(academy_id,fiscal_year desc,version desc);
create index financial_budget_plans_created_by_idx on public.financial_budget_plans(created_by);
create index financial_budget_plans_approved_by_idx on public.financial_budget_plans(approved_by) where approved_by is not null;

create table public.financial_budget_lines(
 id uuid primary key default gen_random_uuid(),
 plan_id uuid not null references public.financial_budget_plans(id) on delete restrict,
 academy_id uuid not null references public.academies(id) on delete restrict,
 account_id uuid not null references public.gl_accounts(id) on delete restrict,
 month_start date not null check(extract(day from month_start)=1),
 budget_minor bigint not null check(budget_minor>=0),
 forecast_minor bigint not null check(forecast_minor>=0),
 rationale text check(rationale is null or char_length(btrim(rationale)) between 2 and 240),
 created_by uuid not null references auth.users(id) on delete restrict,
 updated_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint financial_budget_line_unique unique(plan_id,account_id,month_start)
);
create index financial_budget_lines_plan_month_idx on public.financial_budget_lines(plan_id,month_start,account_id);
create index financial_budget_lines_academy_idx on public.financial_budget_lines(academy_id);
create index financial_budget_lines_account_idx on public.financial_budget_lines(account_id);
create index financial_budget_lines_created_by_idx on public.financial_budget_lines(created_by);
create index financial_budget_lines_updated_by_idx on public.financial_budget_lines(updated_by);

alter table public.financial_budget_plans enable row level security;
alter table public.financial_budget_lines enable row level security;
revoke all on public.financial_budget_plans,public.financial_budget_lines from public,anon,authenticated;
grant select,insert,update on public.financial_budget_plans,public.financial_budget_lines to authenticated;
grant select,insert,update,delete on public.financial_budget_plans,public.financial_budget_lines to service_role;
grant usage on type public.financial_budget_plan_status to authenticated;

create policy financial_budget_plans_read_administrators on public.financial_budget_plans for select to authenticated using((select private.is_platform_administrator()));
create policy financial_budget_plans_insert_administrators on public.financial_budget_plans for insert to authenticated with check((select private.is_platform_administrator()) and created_by=(select auth.uid()));
create policy financial_budget_plans_update_administrators on public.financial_budget_plans for update to authenticated using((select private.is_platform_administrator())) with check((select private.is_platform_administrator()));
create policy financial_budget_lines_read_administrators on public.financial_budget_lines for select to authenticated using((select private.is_platform_administrator()));
create policy financial_budget_lines_insert_administrators on public.financial_budget_lines for insert to authenticated with check((select private.is_platform_administrator()) and created_by=(select auth.uid()) and updated_by=(select auth.uid()));
create policy financial_budget_lines_update_administrators on public.financial_budget_lines for update to authenticated using((select private.is_platform_administrator())) with check((select private.is_platform_administrator()) and updated_by=(select auth.uid()));

create function private.validate_financial_budget_plan_update() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status='approved' and new.status='superseded' and row(old.academy_id,old.fiscal_year,old.version,old.name,old.currency,old.variance_threshold_bps,old.note,old.created_by,old.approved_by,old.approved_at) is distinct from row(new.academy_id,new.fiscal_year,new.version,new.name,new.currency,new.variance_threshold_bps,new.note,new.created_by,new.approved_by,new.approved_at) then raise exception 'approved budget plan is immutable' using errcode='23514';end if;
 if old.status<>'draft' and not(old.status='approved' and new.status='superseded') then raise exception 'approved budget plan is immutable' using errcode='23514';end if;
 if old.status='draft' and new.status not in('draft','approved') then raise exception 'invalid budget status transition' using errcode='23514';end if;
 new.updated_at:=now();return new;
end;$$;
create trigger validate_financial_budget_plan_update before update on public.financial_budget_plans for each row execute function private.validate_financial_budget_plan_update();

create function private.validate_financial_budget_line_write() returns trigger language plpgsql set search_path='' as $$
declare scoped_plan public.financial_budget_plans%rowtype;scoped_account public.gl_accounts%rowtype;
begin
 select * into scoped_plan from public.financial_budget_plans where id=new.plan_id;
 select * into scoped_account from public.gl_accounts where id=new.account_id;
 if scoped_plan.id is null or scoped_plan.status<>'draft' then raise exception 'draft budget plan required' using errcode='23514';end if;
 if scoped_plan.academy_id<>new.academy_id or scoped_account.academy_id<>new.academy_id or scoped_account.category not in('revenue','expense') then raise exception 'budget account scope is invalid' using errcode='23514';end if;
 if extract(year from new.month_start)::integer<>scoped_plan.fiscal_year then raise exception 'budget month must match fiscal year' using errcode='23514';end if;
 new.updated_at:=now();return new;
end;$$;
create trigger validate_financial_budget_line_write before insert or update on public.financial_budget_lines for each row execute function private.validate_financial_budget_line_write();

create function public.create_financial_budget_plan(target_academy_id uuid,target_fiscal_year integer,target_currency text,target_name text,target_variance_threshold_bps integer,target_note text,target_clone_plan_id uuid default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare actor uuid:=(select auth.uid());new_plan_id uuid;next_version integer;source_plan public.financial_budget_plans%rowtype;normalized_currency text:=upper(btrim(target_currency));
begin
 if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501';end if;
 if target_fiscal_year not between 2020 and 2100 or normalized_currency!~'^[A-Z]{3}$' or char_length(btrim(target_name)) not between 2 and 120 or target_variance_threshold_bps not between 100 and 10000 or (nullif(btrim(coalesce(target_note,'')),'') is not null and char_length(btrim(target_note)) not between 2 and 500) then raise exception 'invalid budget plan' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(target_academy_id::text||target_fiscal_year::text||normalized_currency,0));
 select coalesce(max(version),0)+1 into next_version from public.financial_budget_plans where academy_id=target_academy_id and fiscal_year=target_fiscal_year and currency=normalized_currency;
 if target_clone_plan_id is not null then
  select * into source_plan from public.financial_budget_plans where id=target_clone_plan_id;
  if not found or source_plan.academy_id<>target_academy_id or source_plan.fiscal_year<>target_fiscal_year or source_plan.currency<>normalized_currency then raise exception 'clone plan scope is invalid' using errcode='23514';end if;
 end if;
 insert into public.financial_budget_plans(academy_id,fiscal_year,version,name,currency,variance_threshold_bps,note,created_by)
 values(target_academy_id,target_fiscal_year,next_version,btrim(target_name),normalized_currency,target_variance_threshold_bps,nullif(btrim(coalesce(target_note,'')),''),actor) returning id into new_plan_id;
 if target_clone_plan_id is not null then
  insert into public.financial_budget_lines(plan_id,academy_id,account_id,month_start,budget_minor,forecast_minor,rationale,created_by,updated_by)
  select new_plan_id,target_academy_id,account_id,month_start,budget_minor,forecast_minor,rationale,actor,actor from public.financial_budget_lines where plan_id=target_clone_plan_id;
 end if;
 perform public.write_audit_event(target_academy_id,'financial_budget.plan_created','financial_budget_plan',new_plan_id,jsonb_build_object('fiscal_year',target_fiscal_year,'version',next_version,'currency',normalized_currency,'cloned_from',target_clone_plan_id));
 return new_plan_id;
end;$$;

create function public.save_financial_budget_line(target_plan_id uuid,target_account_id uuid,target_month_start date,target_budget_minor bigint,target_forecast_minor bigint,target_rationale text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare actor uuid:=(select auth.uid());scoped_plan public.financial_budget_plans%rowtype;line_id uuid;normalized_month date:=date_trunc('month',target_month_start)::date;
begin
 if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501';end if;
 select * into scoped_plan from public.financial_budget_plans where id=target_plan_id for update;
 if not found or scoped_plan.status<>'draft' then raise exception 'draft budget plan required' using errcode='23514';end if;
 if target_budget_minor<0 or target_forecast_minor<0 or (nullif(btrim(coalesce(target_rationale,'')),'') is not null and char_length(btrim(target_rationale)) not between 2 and 240) then raise exception 'invalid budget line' using errcode='22023';end if;
 insert into public.financial_budget_lines(plan_id,academy_id,account_id,month_start,budget_minor,forecast_minor,rationale,created_by,updated_by)
 values(scoped_plan.id,scoped_plan.academy_id,target_account_id,normalized_month,target_budget_minor,target_forecast_minor,nullif(btrim(coalesce(target_rationale,'')),''),actor,actor)
 on conflict(plan_id,account_id,month_start) do update set budget_minor=excluded.budget_minor,forecast_minor=excluded.forecast_minor,rationale=excluded.rationale,updated_by=actor,updated_at=now()
 returning id into line_id;
 perform public.write_audit_event(scoped_plan.academy_id,'financial_budget.line_saved','financial_budget_line',line_id,jsonb_build_object('plan_id',scoped_plan.id,'account_id',target_account_id,'month_start',normalized_month,'budget_minor',target_budget_minor,'forecast_minor',target_forecast_minor));
 return line_id;
end;$$;

create function public.set_financial_budget_plan_status(target_plan_id uuid,target_status public.financial_budget_plan_status)
returns boolean language plpgsql security invoker set search_path='' as $$
declare actor uuid:=(select auth.uid());scoped_plan public.financial_budget_plans%rowtype;
begin
 if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501';end if;
 select * into scoped_plan from public.financial_budget_plans where id=target_plan_id for update;
 if not found or scoped_plan.status<>'draft' or target_status not in('draft','approved') then raise exception 'draft budget plan required' using errcode='23514';end if;
 if target_status='approved' and not exists(select 1 from public.financial_budget_lines where plan_id=scoped_plan.id) then raise exception 'budget plan requires at least one line' using errcode='23514';end if;
 if target_status='approved' then
  update public.financial_budget_plans set status='superseded' where academy_id=scoped_plan.academy_id and fiscal_year=scoped_plan.fiscal_year and currency=scoped_plan.currency and status='approved' and id<>scoped_plan.id;
  update public.financial_budget_plans set status='approved',approved_by=actor,approved_at=now() where id=scoped_plan.id;
  perform public.write_audit_event(scoped_plan.academy_id,'financial_budget.plan_approved','financial_budget_plan',scoped_plan.id,jsonb_build_object('fiscal_year',scoped_plan.fiscal_year,'version',scoped_plan.version,'currency',scoped_plan.currency));
 end if;
 return true;
end;$$;

create function public.get_financial_budget_variance(target_plan_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare actor uuid:=(select auth.uid());scoped_plan public.financial_budget_plans%rowtype;result jsonb;
begin
 if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501';end if;
 select * into scoped_plan from public.financial_budget_plans where id=target_plan_id;
 if not found then raise exception 'budget plan not found' using errcode='P0002';end if;
 with actuals as(
  select line.account_id,date_trunc('month',entry.entry_date)::date month_start,
   coalesce(sum(case when account.normal_balance='debit' then line.debit_minor-line.credit_minor else line.credit_minor-line.debit_minor end),0)::bigint actual_minor
  from public.gl_journal_entries entry join public.gl_journal_lines line on line.journal_entry_id=entry.id join public.gl_accounts account on account.id=line.account_id
  where entry.academy_id=scoped_plan.academy_id and entry.currency=scoped_plan.currency and entry.status in('posted','reversed') and entry.entry_date between make_date(scoped_plan.fiscal_year,1,1) and make_date(scoped_plan.fiscal_year,12,31) and account.category in('revenue','expense')
  group by line.account_id,date_trunc('month',entry.entry_date)
 ),rows as(
  select budget.id,budget.month_start,account.id account_id,account.code,account.name,account.category,budget.budget_minor,budget.forecast_minor,coalesce(actual.actual_minor,0)::bigint actual_minor,budget.rationale,
   case when account.category='revenue' then coalesce(actual.actual_minor,0)-budget.budget_minor else budget.budget_minor-coalesce(actual.actual_minor,0) end variance_minor
  from public.financial_budget_lines budget join public.gl_accounts account on account.id=budget.account_id left join actuals actual on actual.account_id=budget.account_id and actual.month_start=budget.month_start where budget.plan_id=scoped_plan.id
 ),months as(
  select month_start,
   coalesce(sum(budget_minor)filter(where category='revenue'),0)::bigint revenue_budget_minor,coalesce(sum(actual_minor)filter(where category='revenue'),0)::bigint revenue_actual_minor,coalesce(sum(forecast_minor)filter(where category='revenue'),0)::bigint revenue_forecast_minor,
   coalesce(sum(budget_minor)filter(where category='expense'),0)::bigint expense_budget_minor,coalesce(sum(actual_minor)filter(where category='expense'),0)::bigint expense_actual_minor,coalesce(sum(forecast_minor)filter(where category='expense'),0)::bigint expense_forecast_minor,
   coalesce(sum(variance_minor),0)::bigint net_variance_minor,
   count(*)filter(where budget_minor>0 and variance_minor<0 and abs(variance_minor)*10000/budget_minor>=scoped_plan.variance_threshold_bps)::integer alert_count
  from rows group by month_start
 )
 select jsonb_build_object(
  'plan',jsonb_build_object('id',scoped_plan.id,'fiscal_year',scoped_plan.fiscal_year,'version',scoped_plan.version,'name',scoped_plan.name,'currency',scoped_plan.currency,'status',scoped_plan.status,'variance_threshold_bps',scoped_plan.variance_threshold_bps),
  'totals',jsonb_build_object('budget_minor',coalesce((select sum(budget_minor) from rows),0),'forecast_minor',coalesce((select sum(forecast_minor) from rows),0),'actual_minor',coalesce((select sum(actual_minor) from rows),0),'revenue_budget_minor',coalesce((select sum(budget_minor) from rows where category='revenue'),0),'expense_budget_minor',coalesce((select sum(budget_minor) from rows where category='expense'),0),'revenue_forecast_minor',coalesce((select sum(forecast_minor) from rows where category='revenue'),0),'expense_forecast_minor',coalesce((select sum(forecast_minor) from rows where category='expense'),0),'alert_count',coalesce((select sum(alert_count) from months),0)),
  'months',coalesce((select jsonb_agg(jsonb_build_object('month_start',month_start,'revenue_budget_minor',revenue_budget_minor,'revenue_actual_minor',revenue_actual_minor,'revenue_forecast_minor',revenue_forecast_minor,'expense_budget_minor',expense_budget_minor,'expense_actual_minor',expense_actual_minor,'expense_forecast_minor',expense_forecast_minor,'net_variance_minor',net_variance_minor,'alert_count',alert_count) order by month_start) from months),'[]'::jsonb),
  'lines',coalesce((select jsonb_agg(jsonb_build_object('id',id,'month_start',month_start,'account_id',account_id,'code',code,'name',name,'category',category,'budget_minor',budget_minor,'forecast_minor',forecast_minor,'actual_minor',actual_minor,'variance_minor',variance_minor,'rationale',rationale) order by month_start,code) from rows),'[]'::jsonb)
 ) into result;
 return result;
end;$$;

revoke all on function public.create_financial_budget_plan(uuid,integer,text,text,integer,text,uuid),public.save_financial_budget_line(uuid,uuid,date,bigint,bigint,text),public.set_financial_budget_plan_status(uuid,public.financial_budget_plan_status),public.get_financial_budget_variance(uuid) from public,anon,authenticated;
grant execute on function public.create_financial_budget_plan(uuid,integer,text,text,integer,text,uuid),public.save_financial_budget_line(uuid,uuid,date,bigint,bigint,text),public.set_financial_budget_plan_status(uuid,public.financial_budget_plan_status),public.get_financial_budget_variance(uuid) to authenticated;

commit;
