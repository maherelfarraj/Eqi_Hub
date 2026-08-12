begin;

create type public.bank_transaction_direction as enum ('credit','debit');
create type public.bank_reconciliation_status as enum ('unmatched','matched','ignored');

create table public.bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  account_label text not null,
  transaction_date date not null,
  description text not null,
  direction public.bank_transaction_direction not null,
  amount_minor bigint not null,
  currency text not null default 'JOD',
  bank_reference text,
  status public.bank_reconciliation_status not null default 'unmatched',
  match_type text,
  match_id uuid,
  matched_by uuid references auth.users(id) on delete restrict,
  matched_at timestamptz,
  ignored_by uuid references auth.users(id) on delete restrict,
  ignored_at timestamptz,
  ignore_reason text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint bank_lines_account_length check (char_length(btrim(account_label)) between 2 and 120),
  constraint bank_lines_description_length check (char_length(btrim(description)) between 2 and 500),
  constraint bank_lines_amount_positive check (amount_minor > 0),
  constraint bank_lines_currency check (currency ~ '^[A-Z]{3}$'),
  constraint bank_lines_reference_length check (bank_reference is null or char_length(btrim(bank_reference)) between 2 and 160),
  constraint bank_lines_match_type check (match_type is null or match_type in ('cash_receipt','supplier_invoice','payroll_period')),
  constraint bank_lines_ignore_reason_length check (ignore_reason is null or char_length(btrim(ignore_reason)) between 2 and 240),
  constraint bank_lines_state_consistency check (
    (status='unmatched' and match_type is null and match_id is null and matched_by is null and matched_at is null and ignored_by is null and ignored_at is null and ignore_reason is null)
    or (status='matched' and match_type is not null and match_id is not null and matched_by is not null and matched_at is not null and ignored_by is null and ignored_at is null and ignore_reason is null)
    or (status='ignored' and match_type is null and match_id is null and matched_by is null and matched_at is null and ignored_by is not null and ignored_at is not null and ignore_reason is not null)
  )
);

create index bank_lines_academy_status_date_idx on public.bank_statement_lines (academy_id,status,transaction_date desc);
create index bank_lines_created_by_idx on public.bank_statement_lines (created_by);
create index bank_lines_matched_by_idx on public.bank_statement_lines (matched_by) where matched_by is not null;
create index bank_lines_ignored_by_idx on public.bank_statement_lines (ignored_by) where ignored_by is not null;
create unique index bank_lines_unique_reference_idx on public.bank_statement_lines (academy_id,account_label,bank_reference) where bank_reference is not null;
create unique index bank_lines_unique_match_idx on public.bank_statement_lines (academy_id,match_type,match_id) where match_id is not null;

alter table public.bank_statement_lines enable row level security;
revoke all on public.bank_statement_lines from public,anon,authenticated;
grant select,insert,update on public.bank_statement_lines to authenticated;
grant select,insert,update,delete on public.bank_statement_lines to service_role;
grant usage on type public.bank_transaction_direction,public.bank_reconciliation_status to authenticated;

create policy bank_lines_read_administrators on public.bank_statement_lines
for select to authenticated using ((select private.is_platform_administrator()));
create policy bank_lines_insert_administrators on public.bank_statement_lines
for insert to authenticated with check ((select private.is_platform_administrator()) and created_by=(select auth.uid()));
create policy bank_lines_update_administrators on public.bank_statement_lines
for update to authenticated using ((select private.is_platform_administrator())) with check ((select private.is_platform_administrator()));

create function public.record_bank_statement_line(
  target_academy_id uuid,target_account_label text,target_transaction_date date,target_description text,
  target_direction public.bank_transaction_direction,target_amount_minor bigint,target_currency text,target_bank_reference text
)
returns uuid language plpgsql security invoker set search_path='' as $$
declare actor uuid := (select auth.uid()); line_id uuid;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  if char_length(btrim(target_account_label)) not between 2 and 120 or char_length(btrim(target_description)) not between 2 and 500 or target_amount_minor<=0 or upper(target_currency)!~'^[A-Z]{3}$' or (nullif(btrim(coalesce(target_bank_reference,'')),'') is not null and char_length(btrim(target_bank_reference)) not between 2 and 160) then raise exception 'invalid bank statement line' using errcode='22023'; end if;
  insert into public.bank_statement_lines(academy_id,account_label,transaction_date,description,direction,amount_minor,currency,bank_reference,created_by)
  values(target_academy_id,btrim(target_account_label),target_transaction_date,btrim(target_description),target_direction,target_amount_minor,upper(target_currency),nullif(btrim(coalesce(target_bank_reference,'')),''),actor)
  returning id into line_id;
  perform public.write_audit_event(target_academy_id,'bank_statement_line.recorded','bank_statement_line',line_id,jsonb_build_object('direction',target_direction,'amount_minor',target_amount_minor,'currency',upper(target_currency)));
  return line_id;
end; $$;

create function public.match_bank_statement_line(target_line_id uuid,target_match_type text,target_match_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare actor uuid := (select auth.uid()); scoped public.bank_statement_lines%rowtype; valid_match boolean := false;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  select * into scoped from public.bank_statement_lines where id=target_line_id for update;
  if not found or scoped.status<>'unmatched' then raise exception 'unmatched bank line required' using errcode='23514'; end if;
  if target_match_type='cash_receipt' then
    select exists(select 1 from public.cash_receipts r where r.id=target_match_id and r.academy_id=scoped.academy_id and scoped.direction='credit' and r.amount_minor=scoped.amount_minor and r.currency=scoped.currency) into valid_match;
  elsif target_match_type='supplier_invoice' then
    select exists(select 1 from public.supplier_invoices i join public.supplier_invoice_financials f on f.invoice_id=i.id where i.id=target_match_id and i.academy_id=scoped.academy_id and i.status='paid' and scoped.direction='debit' and f.amount_minor=scoped.amount_minor and f.currency=scoped.currency) into valid_match;
  elsif target_match_type='payroll_period' then
    select exists(select 1 from public.payroll_periods p where p.id=target_match_id and p.academy_id=scoped.academy_id and p.status='paid' and scoped.direction='debit' and p.currency=scoped.currency and (select coalesce(sum(item.amount_minor),0) from public.payroll_items item where item.payroll_period_id=p.id)=scoped.amount_minor) into valid_match;
  end if;
  if not valid_match then raise exception 'bank line and ledger source must match academy direction amount currency and paid status' using errcode='22023'; end if;
  update public.bank_statement_lines set status='matched',match_type=target_match_type,match_id=target_match_id,matched_by=actor,matched_at=now() where id=scoped.id;
  perform public.write_audit_event(scoped.academy_id,'bank_statement_line.matched','bank_statement_line',scoped.id,jsonb_build_object('match_type',target_match_type,'match_id',target_match_id));
  return true;
end; $$;

create function public.ignore_bank_statement_line(target_line_id uuid,target_reason text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare actor uuid := (select auth.uid()); scoped public.bank_statement_lines%rowtype;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  if char_length(btrim(target_reason)) not between 2 and 240 then raise exception 'ignore reason required' using errcode='22023'; end if;
  select * into scoped from public.bank_statement_lines where id=target_line_id for update;
  if not found or scoped.status<>'unmatched' then raise exception 'unmatched bank line required' using errcode='23514'; end if;
  update public.bank_statement_lines set status='ignored',ignored_by=actor,ignored_at=now(),ignore_reason=btrim(target_reason) where id=scoped.id;
  perform public.write_audit_event(scoped.academy_id,'bank_statement_line.ignored','bank_statement_line',scoped.id,jsonb_build_object('reason',btrim(target_reason)));
  return true;
end; $$;

revoke all on function public.record_bank_statement_line(uuid,text,date,text,public.bank_transaction_direction,bigint,text,text),public.match_bank_statement_line(uuid,text,uuid),public.ignore_bank_statement_line(uuid,text) from public,anon,authenticated;
grant execute on function public.record_bank_statement_line(uuid,text,date,text,public.bank_transaction_direction,bigint,text,text),public.match_bank_statement_line(uuid,text,uuid),public.ignore_bank_statement_line(uuid,text) to authenticated;

commit;
