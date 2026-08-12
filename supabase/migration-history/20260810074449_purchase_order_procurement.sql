begin;

create type public.purchase_order_status as enum ('draft','submitted','approved','partially_received','received','cancelled');

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete restrict,
  supplier_id uuid not null references public.supplier_profiles(id) on delete restrict,
  order_number text not null,
  purpose text not null,
  amount_minor bigint not null,
  currency text not null default 'JOD',
  expected_on date,
  status public.purchase_order_status not null default 'draft',
  approved_by uuid references auth.users(id), approved_at timestamptz,
  cancelled_by uuid references auth.users(id), cancelled_at timestamptz, cancellation_reason text,
  created_by uuid not null references auth.users(id), updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint purchase_orders_number_length check (char_length(order_number) between 1 and 80),
  constraint purchase_orders_purpose_length check (char_length(purpose) between 3 and 500),
  constraint purchase_orders_amount_positive check (amount_minor > 0),
  constraint purchase_orders_currency check (currency ~ '^[A-Z]{3}$'),
  constraint purchase_orders_state_consistency check (
    ((status in ('approved','partially_received','received')) = (approved_by is not null and approved_at is not null))
    and ((status='cancelled') = (cancelled_by is not null and cancelled_at is not null and cancellation_reason is not null))
  ),
  unique (academy_id, order_number)
);

create table public.purchase_order_receipts (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  academy_id uuid not null references public.academies(id) on delete restrict,
  received_amount_minor bigint not null,
  received_on date not null,
  reference text,
  received_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint purchase_order_receipts_amount_positive check (received_amount_minor > 0),
  constraint purchase_order_receipts_reference_length check (reference is null or char_length(reference) between 2 and 160)
);

create index purchase_orders_academy_status_idx on public.purchase_orders(academy_id,status,expected_on);
create index purchase_orders_supplier_idx on public.purchase_orders(supplier_id,created_at desc);
create index purchase_order_receipts_order_idx on public.purchase_order_receipts(purchase_order_id,received_on);

alter table public.purchase_orders enable row level security;
alter table public.purchase_order_receipts enable row level security;
revoke all on public.purchase_orders from public,anon,authenticated;
revoke all on public.purchase_order_receipts from public,anon,authenticated;
grant select,insert,update on public.purchase_orders to authenticated;
grant select,insert on public.purchase_order_receipts to authenticated;
grant select,insert,update,delete on public.purchase_orders,public.purchase_order_receipts to service_role;

create policy purchase_orders_read_platform on public.purchase_orders for select to authenticated
using ((select private.is_platform_user()));
create policy purchase_orders_insert_administrators on public.purchase_orders for insert to authenticated
with check ((select private.is_platform_administrator()) and created_by=(select auth.uid()) and updated_by=(select auth.uid()));
create policy purchase_orders_update_administrators on public.purchase_orders for update to authenticated
using ((select private.is_platform_administrator()))
with check ((select private.is_platform_administrator()) and updated_by=(select auth.uid()));
create policy purchase_order_receipts_read_administrators on public.purchase_order_receipts for select to authenticated
using ((select private.is_platform_administrator()));
create policy purchase_order_receipts_insert_administrators on public.purchase_order_receipts for insert to authenticated
with check ((select private.is_platform_administrator()) and received_by=(select auth.uid()));

create or replace function public.create_purchase_order(target_academy_id uuid,target_supplier_id uuid,target_order_number text,target_purpose text,target_amount_minor bigint,target_currency text,target_expected_on date)
returns uuid language plpgsql security invoker set search_path='' as $$
declare actor uuid:=(select auth.uid()); new_id uuid;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  if not exists(select 1 from public.supplier_profiles where id=target_supplier_id and academy_id=target_academy_id and active) then raise exception 'active supplier not found'; end if;
  insert into public.purchase_orders(academy_id,supplier_id,order_number,purpose,amount_minor,currency,expected_on,created_by,updated_by)
  values(target_academy_id,target_supplier_id,trim(target_order_number),trim(target_purpose),target_amount_minor,upper(trim(target_currency)),target_expected_on,actor,actor)
  returning id into new_id;
  perform public.write_audit_event('purchase_order.created',target_academy_id,jsonb_build_object('purchase_order_id',new_id,'supplier_id',target_supplier_id,'amount_minor',target_amount_minor));
  return new_id;
end; $$;

create or replace function public.transition_purchase_order(target_purchase_order_id uuid,next_status public.purchase_order_status,target_reason text default null)
returns void language plpgsql security invoker set search_path='' as $$
declare actor uuid:=(select auth.uid()); current_order public.purchase_orders%rowtype; normalized_reason text:=nullif(trim(coalesce(target_reason,'')),'');
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  select * into current_order from public.purchase_orders where id=target_purchase_order_id for update;
  if not found then raise exception 'purchase order not found'; end if;
  if not ((current_order.status='draft' and next_status in ('submitted','cancelled')) or (current_order.status='submitted' and next_status in ('approved','cancelled')) or (current_order.status='approved' and next_status='cancelled')) then raise exception 'invalid purchase order transition'; end if;
  if next_status='cancelled' and (normalized_reason is null or char_length(normalized_reason)>240) then raise exception 'cancellation reason required'; end if;
  update public.purchase_orders set status=next_status,
    approved_by=case when next_status='approved' then actor else approved_by end,
    approved_at=case when next_status='approved' then now() else approved_at end,
    cancelled_by=case when next_status='cancelled' then actor else null end,
    cancelled_at=case when next_status='cancelled' then now() else null end,
    cancellation_reason=case when next_status='cancelled' then normalized_reason else null end,
    updated_by=actor,updated_at=now() where id=target_purchase_order_id;
  perform public.write_audit_event('purchase_order.'||next_status::text,current_order.academy_id,jsonb_build_object('purchase_order_id',target_purchase_order_id,'reason',normalized_reason));
end; $$;

create or replace function public.record_purchase_order_receipt(target_purchase_order_id uuid,target_received_amount_minor bigint,target_received_on date,target_reference text default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare actor uuid:=(select auth.uid()); current_order public.purchase_orders%rowtype; prior_total bigint; new_total bigint; receipt_id uuid; normalized_reference text:=nullif(trim(coalesce(target_reference,'')),'');
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  select * into current_order from public.purchase_orders where id=target_purchase_order_id for update;
  if not found then raise exception 'purchase order not found'; end if;
  if current_order.status not in ('approved','partially_received') then raise exception 'purchase order must be approved before receipt'; end if;
  select coalesce(sum(received_amount_minor),0) into prior_total from public.purchase_order_receipts where purchase_order_id=target_purchase_order_id;
  new_total:=prior_total+target_received_amount_minor;
  if target_received_amount_minor<=0 or new_total>current_order.amount_minor then raise exception 'received amount exceeds purchase order total'; end if;
  insert into public.purchase_order_receipts(purchase_order_id,academy_id,received_amount_minor,received_on,reference,received_by)
  values(target_purchase_order_id,current_order.academy_id,target_received_amount_minor,target_received_on,normalized_reference,actor) returning id into receipt_id;
  update public.purchase_orders set status=case when new_total=current_order.amount_minor then 'received'::public.purchase_order_status else 'partially_received'::public.purchase_order_status end,updated_by=actor,updated_at=now() where id=target_purchase_order_id;
  perform public.write_audit_event('purchase_order.receipt_recorded',current_order.academy_id,jsonb_build_object('purchase_order_id',target_purchase_order_id,'receipt_id',receipt_id,'received_amount_minor',target_received_amount_minor,'received_total_minor',new_total));
  return receipt_id;
end; $$;

revoke all on function public.create_purchase_order(uuid,uuid,text,text,bigint,text,date) from public,anon,authenticated;
revoke all on function public.transition_purchase_order(uuid,public.purchase_order_status,text) from public,anon,authenticated;
revoke all on function public.record_purchase_order_receipt(uuid,bigint,date,text) from public,anon,authenticated;
grant execute on function public.create_purchase_order(uuid,uuid,text,text,bigint,text,date) to authenticated;
grant execute on function public.transition_purchase_order(uuid,public.purchase_order_status,text) to authenticated;
grant execute on function public.record_purchase_order_receipt(uuid,bigint,date,text) to authenticated;

commit;
