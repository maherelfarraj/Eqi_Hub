begin;
create type public.cash_session_status as enum ('open','closed');
create table public.cash_receipts (
 id uuid primary key default gen_random_uuid(), academy_id uuid not null references public.academies(id) on delete cascade,
 invoice_id uuid not null unique references public.invoices(id) on delete restrict, rider_user_id uuid not null references auth.users(id) on delete restrict,
 amount_minor integer not null check (amount_minor > 0), currency text not null check (currency ~ '^[A-Z]{3}$'),
 received_at timestamptz not null default now(), received_by uuid not null references auth.users(id) on delete restrict,
 reference text check (reference is null or char_length(reference) <= 120)
);
create table public.cash_expenses (
 id uuid primary key default gen_random_uuid(), academy_id uuid not null references public.academies(id) on delete cascade,
 category text not null check (char_length(btrim(category)) between 2 and 80), description text not null check (char_length(btrim(description)) between 2 and 500),
 amount_minor integer not null check (amount_minor > 0), currency text not null check (currency ~ '^[A-Z]{3}$'),
 incurred_at timestamptz not null default now(), recorded_by uuid not null references auth.users(id) on delete restrict, created_at timestamptz not null default now()
);
create table public.cash_sessions (
 id uuid primary key default gen_random_uuid(), academy_id uuid not null references public.academies(id) on delete cascade,
 business_date date not null, currency text not null check (currency ~ '^[A-Z]{3}$'), status public.cash_session_status not null default 'open',
 opening_float_minor integer not null check (opening_float_minor >= 0), expected_close_minor integer,
 counted_close_minor integer check (counted_close_minor is null or counted_close_minor >= 0), variance_minor integer,
 opened_by uuid not null references auth.users(id) on delete restrict, opened_at timestamptz not null default now(),
 closed_by uuid references auth.users(id) on delete restrict, closed_at timestamptz, notes text check (notes is null or char_length(notes) <= 500),
 unique (academy_id, business_date, currency),
 check ((status='closed') = (closed_at is not null and closed_by is not null and counted_close_minor is not null and variance_minor is not null))
);
create index cash_receipts_academy_received_idx on public.cash_receipts (academy_id, received_at desc);
create index cash_receipts_rider_idx on public.cash_receipts (rider_user_id, received_at desc);
create index cash_receipts_received_by_idx on public.cash_receipts (received_by);
create index cash_expenses_academy_incurred_idx on public.cash_expenses (academy_id, incurred_at desc);
create index cash_expenses_recorded_by_idx on public.cash_expenses (recorded_by);
create index cash_sessions_academy_date_idx on public.cash_sessions (academy_id, business_date desc);
create unique index cash_sessions_one_open_idx on public.cash_sessions (academy_id, currency) where status='open';
create index cash_sessions_opened_by_idx on public.cash_sessions (opened_by);
create index cash_sessions_closed_by_idx on public.cash_sessions (closed_by) where closed_by is not null;

create function public.record_cash_payment(target_invoice_id uuid, target_reference text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid := (select auth.uid()); scoped public.invoices%rowtype; receipt_id uuid;
begin
 select * into scoped from public.invoices where id=target_invoice_id for update;
 if not found or actor is null or not private.has_academy_role(scoped.academy_id,array['academy_admin']::public.app_role[]) then raise exception 'Academy Admin access required' using errcode='42501'; end if;
 if scoped.status<>'issued' then raise exception 'Invoice is not payable' using errcode='23514'; end if;
 insert into public.cash_receipts(academy_id,invoice_id,rider_user_id,amount_minor,currency,received_by,reference)
 values(scoped.academy_id,scoped.id,scoped.rider_user_id,scoped.amount_minor,scoped.currency,actor,nullif(btrim(target_reference),'')) returning id into receipt_id;
 update public.invoices set status='paid',settled_at=now(),updated_at=now() where id=scoped.id;
 insert into public.billing_ledger_entries(academy_id,rider_user_id,invoice_id,entry_type,amount_minor,currency,note,created_by)
 values(scoped.academy_id,scoped.rider_user_id,scoped.id,'payment',scoped.amount_minor,scoped.currency,'Cash payment for '||scoped.invoice_number,actor);
 perform public.write_audit_event(scoped.academy_id,'cash_payment.recorded','cash_receipt',receipt_id,jsonb_build_object('invoice_id',scoped.id,'amount_minor',scoped.amount_minor)); return receipt_id;
end; $$;
create function public.record_cash_expense(target_academy_id uuid,target_category text,target_description text,target_amount_minor integer,target_currency text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid := (select auth.uid()); expense_id uuid;
begin
 if actor is null or not private.has_academy_role(target_academy_id,array['academy_admin']::public.app_role[]) then raise exception 'Academy Admin access required' using errcode='42501'; end if;
 if char_length(btrim(target_category)) not between 2 and 80 or char_length(btrim(target_description)) not between 2 and 500 or target_amount_minor<=0 or upper(target_currency)!~'^[A-Z]{3}$' then raise exception 'Invalid expense' using errcode='22023'; end if;
 insert into public.cash_expenses(academy_id,category,description,amount_minor,currency,recorded_by) values(target_academy_id,btrim(target_category),btrim(target_description),target_amount_minor,upper(target_currency),actor) returning id into expense_id;
 perform public.write_audit_event(target_academy_id,'cash_expense.recorded','cash_expense',expense_id,jsonb_build_object('amount_minor',target_amount_minor,'currency',upper(target_currency))); return expense_id;
end; $$;
create function public.open_cash_session(target_academy_id uuid,target_business_date date,target_currency text,target_opening_minor integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid := (select auth.uid()); session_id uuid;
begin
 if actor is null or not private.has_academy_role(target_academy_id,array['academy_admin']::public.app_role[]) then raise exception 'Academy Admin access required' using errcode='42501'; end if;
 insert into public.cash_sessions(academy_id,business_date,currency,opening_float_minor,opened_by) values(target_academy_id,target_business_date,upper(target_currency),target_opening_minor,actor) returning id into session_id;
 perform public.write_audit_event(target_academy_id,'cash_session.opened','cash_session',session_id,jsonb_build_object('business_date',target_business_date)); return session_id;
end; $$;
create function public.close_cash_session(target_session_id uuid,target_counted_minor integer,target_notes text)
returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid := (select auth.uid()); scoped public.cash_sessions%rowtype; expected integer; variance integer; academy_tz text;
begin
 select * into scoped from public.cash_sessions where id=target_session_id for update;
 if not found or scoped.status<>'open' or actor is null or not private.has_academy_role(scoped.academy_id,array['academy_admin']::public.app_role[]) then raise exception 'Open cash session and Academy Admin access required' using errcode='42501'; end if;
 select timezone into academy_tz from public.academies where id=scoped.academy_id;
 select scoped.opening_float_minor + coalesce((select sum(amount_minor) from public.cash_receipts where academy_id=scoped.academy_id and currency=scoped.currency and received_at>=(scoped.business_date::timestamp at time zone academy_tz) and received_at<((scoped.business_date+1)::timestamp at time zone academy_tz)),0) - coalesce((select sum(amount_minor) from public.cash_expenses where academy_id=scoped.academy_id and currency=scoped.currency and incurred_at>=(scoped.business_date::timestamp at time zone academy_tz) and incurred_at<((scoped.business_date+1)::timestamp at time zone academy_tz)),0) into expected;
 variance:=target_counted_minor-expected;
 update public.cash_sessions set status='closed',expected_close_minor=expected,counted_close_minor=target_counted_minor,variance_minor=variance,closed_by=actor,closed_at=now(),notes=nullif(btrim(target_notes),'') where id=scoped.id;
 perform public.write_audit_event(scoped.academy_id,'cash_session.closed','cash_session',scoped.id,jsonb_build_object('expected_minor',expected,'counted_minor',target_counted_minor,'variance_minor',variance)); return variance;
end; $$;
alter table public.cash_receipts enable row level security; alter table public.cash_expenses enable row level security; alter table public.cash_sessions enable row level security;
create policy cash_receipts_admins on public.cash_receipts for select to authenticated using(private.has_academy_role(academy_id,array['academy_admin']::public.app_role[]));
create policy cash_expenses_admins on public.cash_expenses for select to authenticated using(private.has_academy_role(academy_id,array['academy_admin']::public.app_role[]));
create policy cash_sessions_admins on public.cash_sessions for select to authenticated using(private.has_academy_role(academy_id,array['academy_admin']::public.app_role[]));
revoke all on public.cash_receipts,public.cash_expenses,public.cash_sessions from anon,authenticated; grant select on public.cash_receipts,public.cash_expenses,public.cash_sessions to authenticated; grant usage on type public.cash_session_status to authenticated;
revoke all on function public.record_cash_payment(uuid,text),public.record_cash_expense(uuid,text,text,integer,text),public.open_cash_session(uuid,date,text,integer),public.close_cash_session(uuid,integer,text) from public,anon;
grant execute on function public.record_cash_payment(uuid,text),public.record_cash_expense(uuid,text,text,integer,text),public.open_cash_session(uuid,date,text,integer),public.close_cash_session(uuid,integer,text) to authenticated;
commit;
