begin;

create type public.supplier_payment_run_status as enum ('draft','submitted','approved','paid','cancelled');

create table public.supplier_payment_runs (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete restrict,
  run_number text not null,
  scheduled_on date not null,
  currency text not null default 'JOD',
  status public.supplier_payment_run_status not null default 'draft',
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  paid_by uuid references auth.users(id),
  paid_at timestamptz,
  bank_reference text,
  cancelled_by uuid references auth.users(id),
  cancelled_at timestamptz,
  cancellation_reason text,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_payment_runs_number_length check (char_length(run_number) between 3 and 80),
  constraint supplier_payment_runs_currency check (currency ~ '^[A-Z]{3}$'),
  constraint supplier_payment_runs_bank_reference check (bank_reference is null or char_length(bank_reference) between 2 and 160),
  constraint supplier_payment_runs_cancel_reason check (cancellation_reason is null or char_length(cancellation_reason) between 2 and 240),
  constraint supplier_payment_runs_state_consistency check (
    ((status in ('approved','paid')) = (approved_by is not null and approved_at is not null))
    and ((status='paid') = (paid_by is not null and paid_at is not null and bank_reference is not null))
    and ((status='cancelled') = (cancelled_by is not null and cancelled_at is not null and cancellation_reason is not null))
  ),
  unique (academy_id, run_number)
);

create table public.supplier_payment_run_items (
  id uuid primary key default gen_random_uuid(),
  payment_run_id uuid not null references public.supplier_payment_runs(id) on delete restrict,
  invoice_id uuid not null references public.supplier_invoices(id) on delete restrict,
  academy_id uuid not null references public.academies(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  added_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (payment_run_id, invoice_id)
);

create index supplier_payment_runs_academy_status_idx on public.supplier_payment_runs(academy_id,status,scheduled_on);
create index supplier_payment_runs_created_by_idx on public.supplier_payment_runs(created_by);
create index supplier_payment_run_items_run_idx on public.supplier_payment_run_items(payment_run_id,created_at);
create index supplier_payment_run_items_invoice_idx on public.supplier_payment_run_items(invoice_id,created_at desc);

alter table public.supplier_payment_runs enable row level security;
alter table public.supplier_payment_run_items enable row level security;
revoke all on public.supplier_payment_runs,public.supplier_payment_run_items from public,anon,authenticated;
grant select,insert,update on public.supplier_payment_runs to authenticated;
grant select,insert,delete on public.supplier_payment_run_items to authenticated;
grant select,insert,update,delete on public.supplier_payment_runs,public.supplier_payment_run_items to service_role;
grant usage on type public.supplier_payment_run_status to authenticated,service_role;

create policy supplier_payment_runs_read_administrators
on public.supplier_payment_runs for select to authenticated
using ((select private.is_platform_administrator()));
create policy supplier_payment_runs_insert_administrators
on public.supplier_payment_runs for insert to authenticated
with check ((select private.is_platform_administrator()) and created_by=(select auth.uid()) and updated_by=(select auth.uid()));
create policy supplier_payment_runs_update_administrators
on public.supplier_payment_runs for update to authenticated
using ((select private.is_platform_administrator()))
with check ((select private.is_platform_administrator()) and updated_by=(select auth.uid()));

create policy supplier_payment_run_items_read_administrators
on public.supplier_payment_run_items for select to authenticated
using ((select private.is_platform_administrator()));
create policy supplier_payment_run_items_insert_administrators
on public.supplier_payment_run_items for insert to authenticated
with check ((select private.is_platform_administrator()) and added_by=(select auth.uid()));
create policy supplier_payment_run_items_delete_administrators
on public.supplier_payment_run_items for delete to authenticated
using ((select private.is_platform_administrator()));

create or replace function public.create_supplier_payment_run(target_academy_id uuid,target_scheduled_on date,target_currency text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare actor uuid:=(select auth.uid()); new_id uuid; normalized_currency text:=upper(btrim(target_currency)); generated_number text;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  if target_scheduled_on is null or normalized_currency!~'^[A-Z]{3}$' then raise exception 'invalid payment run details' using errcode='22023'; end if;
  if not exists(select 1 from public.academies where id=target_academy_id and archived_at is null) then raise exception 'academy not found'; end if;
  generated_number:='PAY-'||to_char(target_scheduled_on,'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.supplier_payment_runs(academy_id,run_number,scheduled_on,currency,created_by,updated_by)
  values(target_academy_id,generated_number,target_scheduled_on,normalized_currency,actor,actor) returning id into new_id;
  perform public.write_audit_event(target_academy_id,'supplier_payment_run.created','supplier_payment_run',new_id,jsonb_build_object('run_number',generated_number,'scheduled_on',target_scheduled_on,'currency',normalized_currency));
  return new_id;
end; $$;

create or replace function public.add_supplier_invoice_to_payment_run(target_payment_run_id uuid,target_invoice_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare actor uuid:=(select auth.uid()); scoped_run public.supplier_payment_runs%rowtype; scoped_invoice public.supplier_invoices%rowtype; financial public.supplier_invoice_financials%rowtype;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  select * into scoped_run from public.supplier_payment_runs where id=target_payment_run_id for update;
  if not found then raise exception 'payment run not found'; end if;
  if scoped_run.status<>'draft' then raise exception 'only draft payment runs can be changed'; end if;
  select * into scoped_invoice from public.supplier_invoices where id=target_invoice_id for update;
  if not found or scoped_invoice.academy_id<>scoped_run.academy_id then raise exception 'supplier invoice scope mismatch'; end if;
  if scoped_invoice.status<>'approved' then raise exception 'only approved supplier invoices can be scheduled'; end if;
  select * into financial from public.supplier_invoice_financials where invoice_id=target_invoice_id;
  if not found or financial.currency<>scoped_run.currency then raise exception 'supplier invoice currency mismatch'; end if;
  if exists(
    select 1 from public.supplier_payment_run_items item join public.supplier_payment_runs run on run.id=item.payment_run_id
    where item.invoice_id=target_invoice_id and run.status in ('draft','submitted','approved','paid')
  ) then raise exception 'supplier invoice is already assigned to a payment run'; end if;
  insert into public.supplier_payment_run_items(payment_run_id,invoice_id,academy_id,amount_minor,currency,added_by)
  values(scoped_run.id,scoped_invoice.id,scoped_run.academy_id,financial.amount_minor,financial.currency,actor);
  perform public.write_audit_event(scoped_run.academy_id,'supplier_payment_run.invoice_added','supplier_payment_run',scoped_run.id,jsonb_build_object('invoice_id',target_invoice_id,'amount_minor',financial.amount_minor));
end; $$;

create or replace function public.transition_supplier_payment_run(target_payment_run_id uuid,next_status public.supplier_payment_run_status,target_reason text default null)
returns void language plpgsql security invoker set search_path='' as $$
declare actor uuid:=(select auth.uid()); scoped_run public.supplier_payment_runs%rowtype; normalized_reason text:=nullif(btrim(target_reason),''); item_count integer;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  select * into scoped_run from public.supplier_payment_runs where id=target_payment_run_id for update;
  if not found then raise exception 'payment run not found'; end if;
  if not ((scoped_run.status='draft' and next_status in ('submitted','cancelled')) or (scoped_run.status='submitted' and next_status in ('draft','approved','cancelled'))) then raise exception 'invalid payment run transition'; end if;
  select count(*) into item_count from public.supplier_payment_run_items where payment_run_id=scoped_run.id;
  if next_status in ('submitted','approved') and item_count=0 then raise exception 'payment run must contain at least one invoice'; end if;
  if next_status='approved' and exists(
    select 1 from public.supplier_payment_run_items item
    join public.supplier_invoices invoice on invoice.id=item.invoice_id
    join public.supplier_invoice_financials financial on financial.invoice_id=invoice.id
    where item.payment_run_id=scoped_run.id and (invoice.status<>'approved' or invoice.academy_id<>scoped_run.academy_id or financial.amount_minor<>item.amount_minor or financial.currency<>item.currency or item.currency<>scoped_run.currency)
  ) then raise exception 'payment run contains an ineligible invoice'; end if;
  if next_status='cancelled' and (normalized_reason is null or char_length(normalized_reason) not between 2 and 240) then raise exception 'cancellation reason required'; end if;
  update public.supplier_payment_runs set status=next_status,
    approved_by=case when next_status='approved' then actor when next_status='draft' then null else approved_by end,
    approved_at=case when next_status='approved' then now() when next_status='draft' then null else approved_at end,
    cancelled_by=case when next_status='cancelled' then actor else null end,
    cancelled_at=case when next_status='cancelled' then now() else null end,
    cancellation_reason=case when next_status='cancelled' then normalized_reason else null end,
    updated_by=actor,updated_at=now() where id=scoped_run.id;
  perform public.write_audit_event(scoped_run.academy_id,'supplier_payment_run.'||next_status::text,'supplier_payment_run',scoped_run.id,jsonb_build_object('invoice_count',item_count,'reason',normalized_reason));
end; $$;

create or replace function public.execute_supplier_payment_run(target_payment_run_id uuid,target_bank_reference text)
returns void language plpgsql security invoker set search_path='' as $$
declare actor uuid:=(select auth.uid()); scoped_run public.supplier_payment_runs%rowtype; normalized_reference text:=nullif(btrim(target_bank_reference),''); item_count integer; total_minor bigint;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  if normalized_reference is null or char_length(normalized_reference) not between 2 and 160 then raise exception 'bank reference required'; end if;
  select * into scoped_run from public.supplier_payment_runs where id=target_payment_run_id for update;
  if not found then raise exception 'payment run not found'; end if;
  if scoped_run.status<>'approved' then raise exception 'payment run must be approved before execution'; end if;
  perform 1 from public.supplier_invoices invoice join public.supplier_payment_run_items item on item.invoice_id=invoice.id where item.payment_run_id=scoped_run.id for update of invoice;
  if exists(
    select 1 from public.supplier_payment_run_items item
    join public.supplier_invoices invoice on invoice.id=item.invoice_id
    join public.supplier_invoice_financials financial on financial.invoice_id=invoice.id
    where item.payment_run_id=scoped_run.id and (invoice.status<>'approved' or invoice.academy_id<>scoped_run.academy_id or financial.amount_minor<>item.amount_minor or financial.currency<>item.currency or item.currency<>scoped_run.currency)
  ) then raise exception 'payment run contains an ineligible invoice'; end if;
  select count(*),coalesce(sum(amount_minor),0) into item_count,total_minor from public.supplier_payment_run_items where payment_run_id=scoped_run.id;
  if item_count=0 then raise exception 'payment run must contain at least one invoice'; end if;
  update public.supplier_invoices invoice set status='paid',paid_by=actor,paid_at=now(),updated_by=actor,updated_at=now()
  from public.supplier_payment_run_items item where item.payment_run_id=scoped_run.id and item.invoice_id=invoice.id;
  update public.supplier_payment_runs set status='paid',paid_by=actor,paid_at=now(),bank_reference=normalized_reference,updated_by=actor,updated_at=now() where id=scoped_run.id;
  perform public.write_audit_event(scoped_run.academy_id,'supplier_payment_run.paid','supplier_payment_run',scoped_run.id,jsonb_build_object('invoice_count',item_count,'total_minor',total_minor,'bank_reference',normalized_reference));
end; $$;

-- Supplier invoices can no longer be marked paid directly. Payment execution is
-- atomic through an approved payment run so the batch and invoice ledger agree.
create or replace function public.transition_supplier_invoice(target_invoice_id uuid,next_status public.supplier_invoice_status)
returns void language plpgsql security invoker set search_path='' as $$
declare actor uuid:=(select auth.uid()); current_invoice public.supplier_invoices%rowtype; matched_order public.purchase_orders%rowtype; matched_order_id uuid; invoice_financial public.supplier_invoice_financials%rowtype; approved_invoice_total bigint; received_total bigint;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  select * into current_invoice from public.supplier_invoices where id=target_invoice_id for update;
  if not found then raise exception 'supplier invoice not found'; end if;
  if not ((current_invoice.status='draft' and next_status in ('awaiting_approval','void')) or (current_invoice.status='awaiting_approval' and next_status in ('approved','void')) or (current_invoice.status='approved' and next_status='void')) then raise exception 'invalid supplier invoice transition; use an approved payment run to mark invoices paid'; end if;
  if next_status='approved' then
    select purchase_order_id into matched_order_id from public.supplier_invoice_purchase_orders where invoice_id=target_invoice_id;
    if matched_order_id is null then raise exception 'three-way match required before invoice approval'; end if;
    select * into matched_order from public.purchase_orders where id=matched_order_id for update;
    if not found or matched_order.status not in ('partially_received','received') then raise exception 'record delivery before invoice approval'; end if;
    select * into invoice_financial from public.supplier_invoice_financials where invoice_id=target_invoice_id;
    if not found or matched_order.academy_id<>current_invoice.academy_id or matched_order.supplier_id<>current_invoice.supplier_id or matched_order.currency<>invoice_financial.currency then raise exception 'invoice purchase order match is invalid'; end if;
    select coalesce(sum(fin.amount_minor),0) into approved_invoice_total
    from public.supplier_invoice_purchase_orders match
    join public.supplier_invoices invoice on invoice.id=match.invoice_id
    join public.supplier_invoice_financials fin on fin.invoice_id=invoice.id
    where match.purchase_order_id=matched_order_id and (invoice.id=target_invoice_id or invoice.status in ('approved','paid'));
    select coalesce(sum(receipt.received_amount_minor),0) into received_total from public.purchase_order_receipts receipt where receipt.purchase_order_id=matched_order_id;
    if approved_invoice_total>matched_order.amount_minor then raise exception 'approved invoices exceed purchase order authorization'; end if;
    if approved_invoice_total>received_total then raise exception 'received delivery does not cover invoice total'; end if;
  end if;
  update public.supplier_invoices set status=next_status,
    approved_by=case when next_status='approved' then actor when next_status='void' then null else approved_by end,
    approved_at=case when next_status='approved' then now() when next_status='void' then null else approved_at end,
    paid_by=null,paid_at=null,
    voided_by=case when next_status='void' then actor else null end,
    voided_at=case when next_status='void' then now() else null end,
    updated_by=actor,updated_at=now() where id=target_invoice_id;
end; $$;

revoke all on function public.create_supplier_payment_run(uuid,date,text),public.add_supplier_invoice_to_payment_run(uuid,uuid),public.transition_supplier_payment_run(uuid,public.supplier_payment_run_status,text),public.execute_supplier_payment_run(uuid,text) from public,anon,authenticated;
grant execute on function public.create_supplier_payment_run(uuid,date,text),public.add_supplier_invoice_to_payment_run(uuid,uuid),public.transition_supplier_payment_run(uuid,public.supplier_payment_run_status,text),public.execute_supplier_payment_run(uuid,text) to authenticated;

commit;
