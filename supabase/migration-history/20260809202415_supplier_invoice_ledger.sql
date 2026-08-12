begin;

create type public.supplier_invoice_status as enum (
  'draft', 'awaiting_approval', 'approved', 'paid', 'void'
);

create table public.supplier_profiles (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete restrict,
  supplier_name text not null,
  payment_terms_days integer not null default 30,
  active boolean not null default true,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_profiles_name_length check (char_length(supplier_name) between 2 and 160),
  constraint supplier_profiles_terms_range check (payment_terms_days between 0 and 365),
  unique (academy_id, supplier_name)
);

create table public.supplier_private_contacts (
  supplier_id uuid primary key references public.supplier_profiles(id) on delete cascade,
  academy_id uuid not null references public.academies(id) on delete restrict,
  contact_name text,
  contact_email text,
  contact_phone text,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_private_contacts_name_length check (contact_name is null or char_length(contact_name) between 2 and 120),
  constraint supplier_private_contacts_email_length check (contact_email is null or char_length(contact_email) between 3 and 254),
  constraint supplier_private_contacts_phone_length check (contact_phone is null or char_length(contact_phone) between 5 and 40)
);

create table public.supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete restrict,
  supplier_id uuid not null references public.supplier_profiles(id) on delete restrict,
  invoice_number text not null,
  issued_on date not null,
  due_on date not null,
  status public.supplier_invoice_status not null default 'draft',
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  paid_by uuid references auth.users(id),
  paid_at timestamptz,
  voided_by uuid references auth.users(id),
  voided_at timestamptz,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_invoices_number_length check (char_length(invoice_number) between 1 and 80),
  constraint supplier_invoices_due_order check (due_on >= issued_on),
  constraint supplier_invoices_approval_state check (
    (status in ('approved', 'paid') and approved_by is not null and approved_at is not null)
    or (status not in ('approved', 'paid') and approved_by is null and approved_at is null)
  ),
  constraint supplier_invoices_paid_state check (
    (status = 'paid' and paid_by is not null and paid_at is not null)
    or (status <> 'paid' and paid_by is null and paid_at is null)
  ),
  constraint supplier_invoices_void_state check (
    (status = 'void' and voided_by is not null and voided_at is not null)
    or (status <> 'void' and voided_by is null and voided_at is null)
  ),
  unique (academy_id, supplier_id, invoice_number)
);

create table public.supplier_invoice_financials (
  invoice_id uuid primary key references public.supplier_invoices(id) on delete cascade,
  academy_id uuid not null references public.academies(id) on delete restrict,
  description text not null,
  amount_minor bigint not null,
  currency text not null default 'JOD',
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_invoice_financials_description_length check (char_length(description) between 3 and 500),
  constraint supplier_invoice_financials_amount_positive check (amount_minor > 0),
  constraint supplier_invoice_financials_currency check (currency ~ '^[A-Z]{3}$')
);

create index supplier_profiles_academy_active_name_idx on public.supplier_profiles (academy_id, active, supplier_name);
create index supplier_profiles_created_by_idx on public.supplier_profiles (created_by);
create index supplier_profiles_updated_by_idx on public.supplier_profiles (updated_by);
create index supplier_private_contacts_academy_idx on public.supplier_private_contacts (academy_id);
create index supplier_private_contacts_created_by_idx on public.supplier_private_contacts (created_by);
create index supplier_private_contacts_updated_by_idx on public.supplier_private_contacts (updated_by);
create index supplier_invoices_academy_status_due_idx on public.supplier_invoices (academy_id, status, due_on);
create index supplier_invoices_supplier_created_idx on public.supplier_invoices (supplier_id, created_at desc);
create index supplier_invoices_approved_by_idx on public.supplier_invoices (approved_by) where approved_by is not null;
create index supplier_invoices_paid_by_idx on public.supplier_invoices (paid_by) where paid_by is not null;
create index supplier_invoices_voided_by_idx on public.supplier_invoices (voided_by) where voided_by is not null;
create index supplier_invoices_created_by_idx on public.supplier_invoices (created_by);
create index supplier_invoices_updated_by_idx on public.supplier_invoices (updated_by);
create index supplier_invoice_financials_academy_idx on public.supplier_invoice_financials (academy_id);
create index supplier_invoice_financials_created_by_idx on public.supplier_invoice_financials (created_by);
create index supplier_invoice_financials_updated_by_idx on public.supplier_invoice_financials (updated_by);

alter table public.supplier_profiles enable row level security;
alter table public.supplier_private_contacts enable row level security;
alter table public.supplier_invoices enable row level security;
alter table public.supplier_invoice_financials enable row level security;

revoke all on public.supplier_profiles from public, anon, authenticated;
revoke all on public.supplier_private_contacts from public, anon, authenticated;
revoke all on public.supplier_invoices from public, anon, authenticated;
revoke all on public.supplier_invoice_financials from public, anon, authenticated;
grant select, insert, update on public.supplier_profiles to authenticated;
grant select, insert, update on public.supplier_private_contacts to authenticated;
grant select, insert, update on public.supplier_invoices to authenticated;
grant select, insert, update on public.supplier_invoice_financials to authenticated;
grant select, insert, update, delete on public.supplier_profiles to service_role;
grant select, insert, update, delete on public.supplier_private_contacts to service_role;
grant select, insert, update, delete on public.supplier_invoices to service_role;
grant select, insert, update, delete on public.supplier_invoice_financials to service_role;

create policy supplier_profiles_read_platform
on public.supplier_profiles for select to authenticated
using ((select private.is_platform_user()));

create policy supplier_profiles_insert_administrators
on public.supplier_profiles for insert to authenticated
with check (
  (select private.is_platform_administrator())
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy supplier_profiles_update_administrators
on public.supplier_profiles for update to authenticated
using ((select private.is_platform_administrator()))
with check (
  (select private.is_platform_administrator())
  and updated_by = (select auth.uid())
);

create policy supplier_private_contacts_read_administrators
on public.supplier_private_contacts for select to authenticated
using ((select private.is_platform_administrator()));

create policy supplier_private_contacts_insert_administrators
on public.supplier_private_contacts for insert to authenticated
with check (
  (select private.is_platform_administrator())
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy supplier_private_contacts_update_administrators
on public.supplier_private_contacts for update to authenticated
using ((select private.is_platform_administrator()))
with check ((select private.is_platform_administrator()) and updated_by = (select auth.uid()));

create policy supplier_invoices_read_platform
on public.supplier_invoices for select to authenticated
using ((select private.is_platform_user()));

create policy supplier_invoices_insert_administrators
on public.supplier_invoices for insert to authenticated
with check (
  (select private.is_platform_administrator())
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy supplier_invoices_update_administrators
on public.supplier_invoices for update to authenticated
using ((select private.is_platform_administrator()))
with check (
  (select private.is_platform_administrator())
  and updated_by = (select auth.uid())
);

create policy supplier_invoice_financials_read_administrators
on public.supplier_invoice_financials for select to authenticated
using ((select private.is_platform_administrator()));

create policy supplier_invoice_financials_insert_administrators
on public.supplier_invoice_financials for insert to authenticated
with check (
  (select private.is_platform_administrator())
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy supplier_invoice_financials_update_administrators
on public.supplier_invoice_financials for update to authenticated
using ((select private.is_platform_administrator()))
with check ((select private.is_platform_administrator()) and updated_by = (select auth.uid()));

create or replace function private.audit_supplier_ledger_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null or not private.is_platform_administrator() then
    raise exception 'platform administrator access required' using errcode = '42501';
  end if;
  insert into public.platform_audit_events (actor_user_id, action, academy_id, metadata)
  values (
    actor,
    case when tg_table_name = 'supplier_profiles'
      then case when tg_op = 'INSERT' then 'platform.supplier_created' else 'platform.supplier_updated' end
      else case when tg_op = 'INSERT' then 'platform.supplier_invoice_created' else 'platform.supplier_invoice_updated' end
    end,
    new.academy_id,
    case when tg_table_name = 'supplier_profiles'
      then jsonb_build_object('supplier_id', new.id, 'supplier_name', new.supplier_name, 'active', new.active)
      else jsonb_build_object('invoice_id', new.id, 'supplier_id', new.supplier_id, 'invoice_number', new.invoice_number, 'status', new.status)
    end
  );
  return new;
end;
$$;

create trigger audit_supplier_profile_after_write
after insert or update on public.supplier_profiles
for each row execute function private.audit_supplier_ledger_change();

create trigger audit_supplier_invoice_after_write
after insert or update on public.supplier_invoices
for each row execute function private.audit_supplier_ledger_change();

create or replace function public.create_supplier_profile(
  target_academy_id uuid,
  target_supplier_name text,
  target_contact_name text,
  target_contact_email text,
  target_contact_phone text,
  target_payment_terms_days integer
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare actor uuid := (select auth.uid()); new_supplier_id uuid;
begin
  if actor is null or not private.is_platform_administrator() then
    raise exception 'platform administrator access required' using errcode = '42501';
  end if;
  insert into public.supplier_profiles (academy_id, supplier_name, payment_terms_days, created_by, updated_by)
  values (target_academy_id, trim(target_supplier_name), target_payment_terms_days, actor, actor)
  returning id into new_supplier_id;
  insert into public.supplier_private_contacts (supplier_id, academy_id, contact_name, contact_email, contact_phone, created_by, updated_by)
  values (new_supplier_id, target_academy_id, nullif(trim(coalesce(target_contact_name, '')), ''), nullif(trim(coalesce(target_contact_email, '')), ''), nullif(trim(coalesce(target_contact_phone, '')), ''), actor, actor);
  return new_supplier_id;
end;
$$;

create or replace function public.create_supplier_invoice(
  target_academy_id uuid,
  target_supplier_id uuid,
  target_invoice_number text,
  target_description text,
  target_issued_on date,
  target_due_on date,
  target_amount_minor bigint,
  target_currency text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare actor uuid := (select auth.uid()); new_invoice_id uuid;
begin
  if actor is null or not private.is_platform_administrator() then
    raise exception 'platform administrator access required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.supplier_profiles where id = target_supplier_id and academy_id = target_academy_id and active) then
    raise exception 'active supplier not found';
  end if;
  insert into public.supplier_invoices (academy_id, supplier_id, invoice_number, issued_on, due_on, created_by, updated_by)
  values (target_academy_id, target_supplier_id, trim(target_invoice_number), target_issued_on, target_due_on, actor, actor)
  returning id into new_invoice_id;
  insert into public.supplier_invoice_financials (invoice_id, academy_id, description, amount_minor, currency, created_by, updated_by)
  values (new_invoice_id, target_academy_id, trim(target_description), target_amount_minor, upper(trim(target_currency)), actor, actor);
  return new_invoice_id;
end;
$$;

create or replace function public.transition_supplier_invoice(
  target_invoice_id uuid,
  next_status public.supplier_invoice_status
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  current_invoice public.supplier_invoices%rowtype;
begin
  if actor is null or not private.is_platform_administrator() then
    raise exception 'platform administrator access required' using errcode = '42501';
  end if;

  select * into current_invoice
  from public.supplier_invoices
  where id = target_invoice_id
  for update;
  if not found then raise exception 'supplier invoice not found'; end if;

  if not (
    (current_invoice.status = 'draft' and next_status in ('awaiting_approval', 'void'))
    or (current_invoice.status = 'awaiting_approval' and next_status in ('approved', 'void'))
    or (current_invoice.status = 'approved' and next_status in ('paid', 'void'))
  ) then
    raise exception 'invalid supplier invoice transition';
  end if;

  update public.supplier_invoices
  set status = next_status,
      approved_by = case when next_status = 'approved' then actor when next_status = 'void' then null else approved_by end,
      approved_at = case when next_status = 'approved' then now() when next_status = 'void' then null else approved_at end,
      paid_by = case when next_status = 'paid' then actor else null end,
      paid_at = case when next_status = 'paid' then now() else null end,
      voided_by = case when next_status = 'void' then actor else null end,
      voided_at = case when next_status = 'void' then now() else null end,
      updated_by = actor,
      updated_at = now()
  where id = target_invoice_id;
end;
$$;

revoke all on function public.transition_supplier_invoice(uuid, public.supplier_invoice_status) from public, anon, authenticated;
revoke all on function public.create_supplier_profile(uuid, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.create_supplier_invoice(uuid, uuid, text, text, date, date, bigint, text) from public, anon, authenticated;
grant execute on function public.transition_supplier_invoice(uuid, public.supplier_invoice_status) to authenticated;
grant execute on function public.create_supplier_profile(uuid, text, text, text, text, integer) to authenticated;
grant execute on function public.create_supplier_invoice(uuid, uuid, text, text, date, date, bigint, text) to authenticated;
revoke all on function private.audit_supplier_ledger_change() from public, anon, authenticated;

alter table public.action_center_tracking drop constraint action_center_tracking_category;
alter table public.action_center_tracking add constraint action_center_tracking_category
  check (category in ('finance', 'booking', 'welfare', 'payroll', 'ai', 'conduct', 'inventory', 'supplier'));

create or replace function public.update_action_center_item(
  target_action_key text,
  target_academy_id uuid,
  target_category text,
  target_status public.action_center_workflow_status,
  target_assigned_to uuid default null,
  target_due_at timestamptz default null,
  target_note text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_note text := nullif(trim(coalesce(target_note, '')), '');
begin
  if current_user_id is null or not private.is_platform_administrator() then
    raise exception 'platform administrator access required' using errcode = '42501';
  end if;
  if char_length(target_action_key) not between 3 and 150
    or target_category not in ('finance', 'booking', 'welfare', 'payroll', 'ai', 'conduct', 'inventory', 'supplier')
    or (target_category = 'conduct' and target_academy_id is not null)
    or (target_category <> 'conduct' and not exists (
      select 1 from public.academies academy where academy.id = target_academy_id
    ))
  then raise exception 'invalid action center item'; end if;
  if normalized_note is not null and char_length(normalized_note) > 1000 then
    raise exception 'action note must not exceed 1000 characters';
  end if;
  if target_assigned_to is not null and not exists (
    select 1 from public.platform_access access
    where access.user_id = target_assigned_to
      and access.access_level = 'administrator' and access.status = 'active'
  ) then raise exception 'assignee must be an active platform administrator'; end if;

  insert into public.action_center_tracking as tracking (
    action_key, academy_id, category, status, assigned_to, due_at, note, updated_by, resolved_at
  ) values (
    target_action_key, target_academy_id, target_category, target_status,
    target_assigned_to, target_due_at, normalized_note, current_user_id,
    case when target_status = 'resolved' then now() else null end
  )
  on conflict (action_key) do update
  set academy_id = excluded.academy_id, category = excluded.category,
      status = excluded.status, assigned_to = excluded.assigned_to,
      due_at = excluded.due_at, note = excluded.note, updated_by = current_user_id,
      resolved_at = case when excluded.status = 'resolved' then coalesce(tracking.resolved_at, now()) else null end,
      updated_at = now();
end;
$$;

revoke all on function public.update_action_center_item(text, uuid, text, public.action_center_workflow_status, uuid, timestamptz, text) from public, anon, authenticated;
grant execute on function public.update_action_center_item(text, uuid, text, public.action_center_workflow_status, uuid, timestamptz, text) to authenticated;

commit;
