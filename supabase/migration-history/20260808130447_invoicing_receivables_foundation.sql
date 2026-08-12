begin;

create type public.invoice_status as enum ('issued', 'paid', 'overdue', 'void', 'refunded');

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  rider_user_id uuid not null references auth.users(id) on delete restrict,
  rider_membership_id uuid references public.rider_memberships(id) on delete restrict,
  invoice_number text not null,
  description text not null check (char_length(btrim(description)) between 2 and 500),
  amount_minor integer not null check (amount_minor > 0),
  currency text not null default 'JOD' check (currency ~ '^[A-Z]{3}$'),
  status public.invoice_status not null default 'issued',
  issued_at timestamptz not null default now(),
  due_at timestamptz not null,
  settled_at timestamptz,
  provider text,
  provider_reference text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_unique_number unique (academy_id, invoice_number),
  constraint invoices_due_after_issue check (due_at >= issued_at),
  constraint invoices_provider_pair check ((provider is null) = (provider_reference is null)),
  constraint invoices_settlement_consistent check (
    (status in ('paid', 'refunded') and settled_at is not null)
    or (status not in ('paid', 'refunded') and settled_at is null)
  )
);

alter table public.billing_ledger_entries
  add column invoice_id uuid references public.invoices(id) on delete restrict;

create index invoices_academy_status_due_idx on public.invoices (academy_id, status, due_at);
create index invoices_rider_created_idx on public.invoices (rider_user_id, created_at desc);
create index invoices_membership_idx on public.invoices (rider_membership_id) where rider_membership_id is not null;
create index invoices_created_by_idx on public.invoices (created_by);
create index billing_ledger_invoice_idx on public.billing_ledger_entries (invoice_id) where invoice_id is not null;

create function public.issue_invoice(
  target_academy_id uuid, target_rider_user_id uuid, target_description text,
  target_amount_minor integer, target_currency text, target_due_at timestamptz
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := (select auth.uid()); next_number integer; new_id uuid; active_membership uuid;
begin
  if current_user_id is null or not private.has_academy_role(target_academy_id, array['academy_admin']::public.app_role[]) then
    raise exception 'Academy Admin access required' using errcode = '42501';
  end if;
  if char_length(btrim(target_description)) not between 2 and 500 or target_amount_minor <= 0
    or upper(target_currency) !~ '^[A-Z]{3}$' or target_due_at < now() then
    raise exception 'Invalid invoice' using errcode = '22023';
  end if;
  if not exists (select 1 from public.academy_memberships where academy_id = target_academy_id
    and user_id = target_rider_user_id and role = 'rider' and status = 'active') then
    raise exception 'Active rider membership required' using errcode = '23514';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_academy_id::text || ':invoice', 0));
  select coalesce(max((regexp_match(invoice_number, '([0-9]+)$'))[1]::integer), 0) + 1 into next_number
  from public.invoices where academy_id = target_academy_id;
  select id into active_membership from public.rider_memberships
  where academy_id = target_academy_id and rider_user_id = target_rider_user_id and status = 'active' limit 1;
  insert into public.invoices (academy_id, rider_user_id, rider_membership_id, invoice_number,
    description, amount_minor, currency, due_at, created_by)
  values (target_academy_id, target_rider_user_id, active_membership,
    'EV-' || to_char(now(), 'YYYY') || '-' || lpad(next_number::text, 6, '0'),
    btrim(target_description), target_amount_minor, upper(target_currency), target_due_at, current_user_id)
  returning id into new_id;
  perform public.write_audit_event(target_academy_id, 'invoice.issued', 'invoice', new_id,
    jsonb_build_object('rider_user_id', target_rider_user_id, 'amount_minor', target_amount_minor, 'currency', upper(target_currency)));
  return new_id;
end;
$$;

create function public.update_invoice_status(target_invoice_id uuid, target_status text)
returns public.invoice_status language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := (select auth.uid()); scoped public.invoices%rowtype; next_status public.invoice_status;
begin
  select * into scoped from public.invoices where id = target_invoice_id for update;
  if not found or current_user_id is null
    or not private.has_academy_role(scoped.academy_id, array['academy_admin']::public.app_role[]) then
    raise exception 'Invoice and Academy Admin access required' using errcode = '42501';
  end if;
  if target_status not in ('paid', 'void', 'refunded') then raise exception 'Invalid invoice status' using errcode = '22023'; end if;
  next_status := target_status::public.invoice_status;
  if scoped.status in ('void', 'refunded') or (scoped.status = 'paid' and next_status <> 'refunded') then
    raise exception 'Invoice transition is not allowed' using errcode = '23514';
  end if;
  if next_status = 'paid' then
    insert into public.billing_ledger_entries (academy_id, rider_user_id, invoice_id, entry_type,
      amount_minor, currency, note, created_by)
    values (scoped.academy_id, scoped.rider_user_id, scoped.id, 'payment', scoped.amount_minor,
      scoped.currency, 'Payment for ' || scoped.invoice_number, current_user_id);
  elsif next_status = 'refunded' then
    insert into public.billing_ledger_entries (academy_id, rider_user_id, invoice_id, entry_type,
      amount_minor, currency, note, created_by)
    values (scoped.academy_id, scoped.rider_user_id, scoped.id, 'refund', -scoped.amount_minor,
      scoped.currency, 'Refund for ' || scoped.invoice_number, current_user_id);
  end if;
  update public.invoices set status = next_status,
    settled_at = case when next_status in ('paid', 'refunded') then now() else null end,
    updated_at = now() where id = scoped.id;
  perform public.write_audit_event(scoped.academy_id, 'invoice.' || next_status::text, 'invoice', scoped.id,
    jsonb_build_object('invoice_number', scoped.invoice_number, 'amount_minor', scoped.amount_minor));
  return next_status;
end;
$$;

create function private.invoice_effective_status(stored public.invoice_status, due_at timestamptz)
returns public.invoice_status language sql stable set search_path = '' as $$
  select case when stored = 'issued' and due_at < now() then 'overdue'::public.invoice_status else stored end;
$$;

alter table public.invoices enable row level security;
create policy invoices_select_scoped on public.invoices for select to authenticated
  using (private.can_access_rider_billing(academy_id, rider_user_id));

revoke all on public.invoices from anon, authenticated;
grant select on public.invoices to authenticated;
grant usage on type public.invoice_status to authenticated;
revoke all on function public.issue_invoice(uuid, uuid, text, integer, text, timestamptz) from public, anon;
revoke all on function public.update_invoice_status(uuid, text) from public, anon;
grant execute on function public.issue_invoice(uuid, uuid, text, integer, text, timestamptz) to authenticated;
grant execute on function public.update_invoice_status(uuid, text) to authenticated;
revoke all on function private.invoice_effective_status(public.invoice_status, timestamptz) from public, anon, authenticated;

commit;
