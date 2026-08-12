begin;

create table public.supplier_invoice_purchase_orders (
  invoice_id uuid primary key references public.supplier_invoices(id) on delete restrict,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  academy_id uuid not null references public.academies(id) on delete restrict,
  linked_by uuid not null references auth.users(id),
  linked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index supplier_invoice_po_purchase_order_idx
on public.supplier_invoice_purchase_orders(purchase_order_id,invoice_id);
create index supplier_invoice_po_academy_idx
on public.supplier_invoice_purchase_orders(academy_id,purchase_order_id);

alter table public.supplier_invoice_purchase_orders enable row level security;
revoke all on public.supplier_invoice_purchase_orders from public,anon,authenticated;
grant select,insert,update on public.supplier_invoice_purchase_orders to authenticated;
grant select,insert,update,delete on public.supplier_invoice_purchase_orders to service_role;

create policy supplier_invoice_po_read_administrators
on public.supplier_invoice_purchase_orders for select to authenticated
using ((select private.is_platform_administrator()));

create policy supplier_invoice_po_insert_administrators
on public.supplier_invoice_purchase_orders for insert to authenticated
with check ((select private.is_platform_administrator()) and linked_by=(select auth.uid()));

create policy supplier_invoice_po_update_administrators
on public.supplier_invoice_purchase_orders for update to authenticated
using ((select private.is_platform_administrator()))
with check ((select private.is_platform_administrator()) and linked_by=(select auth.uid()));

create or replace function public.link_supplier_invoice_purchase_order(
  target_invoice_id uuid,
  target_purchase_order_id uuid
)
returns void
language plpgsql
security invoker
set search_path=''
as $$
declare
  actor uuid:=(select auth.uid());
  scoped_invoice public.supplier_invoices%rowtype;
  scoped_order public.purchase_orders%rowtype;
  invoice_financial public.supplier_invoice_financials%rowtype;
  other_linked_total bigint;
begin
  if actor is null or not private.is_platform_administrator() then
    raise exception 'platform administrator access required' using errcode='42501';
  end if;

  select * into scoped_invoice from public.supplier_invoices
  where id=target_invoice_id for update;
  if not found then raise exception 'supplier invoice not found'; end if;
  if scoped_invoice.status not in ('draft','awaiting_approval') then
    raise exception 'only unapproved invoices can be matched';
  end if;

  select * into scoped_order from public.purchase_orders
  where id=target_purchase_order_id for update;
  if not found then raise exception 'purchase order not found'; end if;
  if scoped_order.status not in ('approved','partially_received','received') then
    raise exception 'purchase order must be approved before matching';
  end if;
  if scoped_order.academy_id<>scoped_invoice.academy_id or scoped_order.supplier_id<>scoped_invoice.supplier_id then
    raise exception 'invoice and purchase order scope mismatch';
  end if;

  select * into invoice_financial from public.supplier_invoice_financials
  where invoice_id=target_invoice_id;
  if not found or invoice_financial.currency<>scoped_order.currency then
    raise exception 'invoice and purchase order currency mismatch';
  end if;

  select coalesce(sum(fin.amount_minor),0) into other_linked_total
  from public.supplier_invoice_purchase_orders match
  join public.supplier_invoices invoice on invoice.id=match.invoice_id and invoice.status<>'void'
  join public.supplier_invoice_financials fin on fin.invoice_id=invoice.id
  where match.purchase_order_id=target_purchase_order_id and match.invoice_id<>target_invoice_id;
  if other_linked_total+invoice_financial.amount_minor>scoped_order.amount_minor then
    raise exception 'linked invoices exceed purchase order total';
  end if;

  insert into public.supplier_invoice_purchase_orders(invoice_id,purchase_order_id,academy_id,linked_by)
  values(target_invoice_id,target_purchase_order_id,scoped_invoice.academy_id,actor)
  on conflict(invoice_id) do update set purchase_order_id=excluded.purchase_order_id,
    academy_id=excluded.academy_id,linked_by=actor,linked_at=now(),updated_at=now();
  perform public.write_audit_event('supplier_invoice.purchase_order_linked',scoped_invoice.academy_id,
    jsonb_build_object('invoice_id',target_invoice_id,'purchase_order_id',target_purchase_order_id));
end;
$$;

create or replace function public.transition_supplier_invoice(
  target_invoice_id uuid,
  next_status public.supplier_invoice_status
)
returns void
language plpgsql
security invoker
set search_path=''
as $$
declare
  actor uuid:=(select auth.uid());
  current_invoice public.supplier_invoices%rowtype;
  matched_order public.purchase_orders%rowtype;
  matched_order_id uuid;
  invoice_financial public.supplier_invoice_financials%rowtype;
  approved_invoice_total bigint;
  received_total bigint;
begin
  if actor is null or not private.is_platform_administrator() then
    raise exception 'platform administrator access required' using errcode='42501';
  end if;

  select * into current_invoice from public.supplier_invoices
  where id=target_invoice_id for update;
  if not found then raise exception 'supplier invoice not found'; end if;

  if not (
    (current_invoice.status='draft' and next_status in ('awaiting_approval','void'))
    or (current_invoice.status='awaiting_approval' and next_status in ('approved','void'))
    or (current_invoice.status='approved' and next_status in ('paid','void'))
  ) then raise exception 'invalid supplier invoice transition'; end if;

  if next_status='approved' then
    select purchase_order_id into matched_order_id
    from public.supplier_invoice_purchase_orders where invoice_id=target_invoice_id;
    if matched_order_id is null then raise exception 'three-way match required before invoice approval'; end if;

    select * into matched_order from public.purchase_orders
    where id=matched_order_id for update;
    if not found or matched_order.status not in ('partially_received','received') then
      raise exception 'record delivery before invoice approval';
    end if;
    select * into invoice_financial from public.supplier_invoice_financials
    where invoice_id=target_invoice_id;
    if not found or matched_order.academy_id<>current_invoice.academy_id
      or matched_order.supplier_id<>current_invoice.supplier_id
      or matched_order.currency<>invoice_financial.currency then
      raise exception 'invoice purchase order match is invalid';
    end if;

    select coalesce(sum(fin.amount_minor),0) into approved_invoice_total
    from public.supplier_invoice_purchase_orders match
    join public.supplier_invoices invoice on invoice.id=match.invoice_id
    join public.supplier_invoice_financials fin on fin.invoice_id=invoice.id
    where match.purchase_order_id=matched_order_id
      and (invoice.id=target_invoice_id or invoice.status in ('approved','paid'));
    select coalesce(sum(receipt.received_amount_minor),0) into received_total
    from public.purchase_order_receipts receipt where receipt.purchase_order_id=matched_order_id;
    if approved_invoice_total>matched_order.amount_minor then
      raise exception 'approved invoices exceed purchase order authorization';
    end if;
    if approved_invoice_total>received_total then
      raise exception 'received delivery does not cover invoice total';
    end if;
  end if;

  update public.supplier_invoices set status=next_status,
    approved_by=case when next_status='approved' then actor when next_status='void' then null else approved_by end,
    approved_at=case when next_status='approved' then now() when next_status='void' then null else approved_at end,
    paid_by=case when next_status='paid' then actor else null end,
    paid_at=case when next_status='paid' then now() else null end,
    voided_by=case when next_status='void' then actor else null end,
    voided_at=case when next_status='void' then now() else null end,
    updated_by=actor,updated_at=now()
  where id=target_invoice_id;
end;
$$;

revoke all on function public.link_supplier_invoice_purchase_order(uuid,uuid) from public,anon,authenticated;
grant execute on function public.link_supplier_invoice_purchase_order(uuid,uuid) to authenticated;
revoke all on function public.transition_supplier_invoice(uuid,public.supplier_invoice_status) from public,anon,authenticated;
grant execute on function public.transition_supplier_invoice(uuid,public.supplier_invoice_status) to authenticated;

commit;
