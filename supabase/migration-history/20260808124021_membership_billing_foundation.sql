begin;

create type public.rider_membership_status as enum ('active', 'paused', 'cancelled', 'expired');
create type public.billing_entry_type as enum (
  'payment', 'credit_grant', 'credit_consumption', 'credit_restoration', 'adjustment', 'refund'
);

create table public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  description text check (description is null or char_length(description) <= 500),
  price_minor integer not null check (price_minor >= 0),
  currency text not null default 'JOD' check (currency ~ '^[A-Z]{3}$'),
  included_credits smallint not null check (included_credits between 1 and 250),
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rider_memberships (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  rider_user_id uuid not null references auth.users(id) on delete restrict,
  plan_id uuid not null references public.membership_plans(id) on delete restrict,
  status public.rider_membership_status not null default 'active',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rider_memberships_dates_valid check (ends_at is null or ends_at > starts_at)
);

create table public.lesson_credit_accounts (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  rider_user_id uuid not null references auth.users(id) on delete restrict,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now(),
  constraint lesson_credit_accounts_unique_rider unique (academy_id, rider_user_id)
);

create table public.billing_ledger_entries (
  id bigint generated always as identity primary key,
  academy_id uuid not null references public.academies(id) on delete cascade,
  rider_user_id uuid not null references auth.users(id) on delete restrict,
  rider_membership_id uuid references public.rider_memberships(id) on delete restrict,
  lesson_booking_id uuid references public.lesson_bookings(id) on delete restrict,
  entry_type public.billing_entry_type not null,
  amount_minor integer not null default 0,
  credit_delta integer not null default 0,
  currency text not null default 'JOD' check (currency ~ '^[A-Z]{3}$'),
  note text check (note is null or char_length(note) <= 500),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint billing_ledger_entry_has_value check (amount_minor <> 0 or credit_delta <> 0),
  constraint billing_credit_event_shape check (
    (entry_type = 'credit_consumption' and credit_delta = -1 and amount_minor = 0)
    or (entry_type = 'credit_restoration' and credit_delta = 1 and amount_minor = 0)
    or entry_type not in ('credit_consumption', 'credit_restoration')
  )
);

create index membership_plans_academy_active_idx on public.membership_plans (academy_id, active, created_at desc);
create index membership_plans_created_by_idx on public.membership_plans (created_by);
create index rider_memberships_academy_status_idx on public.rider_memberships (academy_id, status, created_at desc);
create index rider_memberships_rider_idx on public.rider_memberships (rider_user_id, status);
create index rider_memberships_plan_idx on public.rider_memberships (plan_id);
create index rider_memberships_created_by_idx on public.rider_memberships (created_by);
create unique index rider_memberships_one_active_idx on public.rider_memberships (academy_id, rider_user_id) where status = 'active';
create index lesson_credit_accounts_rider_idx on public.lesson_credit_accounts (rider_user_id);
create index billing_ledger_academy_created_idx on public.billing_ledger_entries (academy_id, created_at desc);
create index billing_ledger_rider_created_idx on public.billing_ledger_entries (rider_user_id, created_at desc);
create index billing_ledger_membership_idx on public.billing_ledger_entries (rider_membership_id) where rider_membership_id is not null;
create index billing_ledger_booking_idx on public.billing_ledger_entries (lesson_booking_id) where lesson_booking_id is not null;
create index billing_ledger_created_by_idx on public.billing_ledger_entries (created_by);
create unique index billing_ledger_booking_consumption_idx
  on public.billing_ledger_entries (lesson_booking_id, entry_type)
  where lesson_booking_id is not null and entry_type in ('credit_consumption', 'credit_restoration');

comment on table public.billing_ledger_entries is 'Immutable academy billing and lesson-credit journal.';

create function private.can_access_rider_billing(target_academy_id uuid, target_rider_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_academy_role(target_academy_id, array['academy_admin']::public.app_role[])
    or (
      target_rider_user_id = (select auth.uid())
      and private.has_academy_role(target_academy_id, array['rider']::public.app_role[])
    )
    or exists (
      select 1 from public.parent_rider_links link
      where link.academy_id = target_academy_id
        and link.parent_user_id = (select auth.uid())
        and link.rider_user_id = target_rider_user_id
        and private.has_academy_role(target_academy_id, array['parent']::public.app_role[])
    );
$$;

create function private.consume_lesson_credit(
  target_academy_id uuid, target_rider_user_id uuid, target_booking_id uuid, actor_id uuid
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.billing_ledger_entries
    where lesson_booking_id = target_booking_id and entry_type = 'credit_consumption'
  ) then return; end if;

  update public.lesson_credit_accounts
  set balance = balance - 1, updated_at = now()
  where academy_id = target_academy_id and rider_user_id = target_rider_user_id and balance > 0;
  if not found then raise exception 'Rider has no available lesson credits' using errcode = 'P0001'; end if;

  insert into public.billing_ledger_entries (
    academy_id, rider_user_id, lesson_booking_id, entry_type, credit_delta, note, created_by
  ) values (
    target_academy_id, target_rider_user_id, target_booking_id,
    'credit_consumption', -1, 'Credit used for confirmed lesson booking', actor_id
  );
end;
$$;

create function private.restore_lesson_credit(
  target_academy_id uuid, target_rider_user_id uuid, target_booking_id uuid, actor_id uuid
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.billing_ledger_entries
    where lesson_booking_id = target_booking_id and entry_type = 'credit_consumption'
  ) or exists (
    select 1 from public.billing_ledger_entries
    where lesson_booking_id = target_booking_id and entry_type = 'credit_restoration'
  ) then return; end if;

  update public.lesson_credit_accounts
  set balance = balance + 1, updated_at = now()
  where academy_id = target_academy_id and rider_user_id = target_rider_user_id;

  insert into public.billing_ledger_entries (
    academy_id, rider_user_id, lesson_booking_id, entry_type, credit_delta, note, created_by
  ) values (
    target_academy_id, target_rider_user_id, target_booking_id,
    'credit_restoration', 1, 'Credit restored after eligible cancellation', actor_id
  );
end;
$$;

create function public.create_membership_plan(
  target_academy_id uuid, plan_name text, plan_description text,
  plan_price_minor integer, plan_currency text, plan_credits integer
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := (select auth.uid()); new_id uuid;
begin
  if current_user_id is null or not private.has_academy_role(target_academy_id, array['academy_admin']::public.app_role[]) then
    raise exception 'Academy Admin access required' using errcode = '42501';
  end if;
  if char_length(btrim(plan_name)) not between 2 and 120 or plan_price_minor < 0
    or plan_credits not between 1 and 250 or upper(plan_currency) !~ '^[A-Z]{3}$' then
    raise exception 'Invalid membership plan' using errcode = '22023';
  end if;
  insert into public.membership_plans (academy_id, name, description, price_minor, currency, included_credits, created_by)
  values (target_academy_id, btrim(plan_name), nullif(btrim(plan_description), ''), plan_price_minor, upper(plan_currency), plan_credits, current_user_id)
  returning id into new_id;
  perform public.write_audit_event(target_academy_id, 'membership_plan.created', 'membership_plan', new_id,
    jsonb_build_object('included_credits', plan_credits, 'price_minor', plan_price_minor, 'currency', upper(plan_currency)));
  return new_id;
end;
$$;

create function public.enroll_rider_membership(target_plan_id uuid, target_rider_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := (select auth.uid()); scoped_plan public.membership_plans%rowtype; new_id uuid;
begin
  select * into scoped_plan from public.membership_plans where id = target_plan_id and active for update;
  if not found or current_user_id is null
    or not private.has_academy_role(scoped_plan.academy_id, array['academy_admin']::public.app_role[]) then
    raise exception 'Active plan and Academy Admin access required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.academy_memberships where academy_id = scoped_plan.academy_id
    and user_id = target_rider_user_id and role = 'rider' and status = 'active') then
    raise exception 'Active rider membership required' using errcode = '23514';
  end if;
  update public.rider_memberships set status = 'cancelled', ends_at = now(), updated_at = now()
  where academy_id = scoped_plan.academy_id and rider_user_id = target_rider_user_id and status = 'active';
  insert into public.rider_memberships (academy_id, rider_user_id, plan_id, created_by)
  values (scoped_plan.academy_id, target_rider_user_id, scoped_plan.id, current_user_id) returning id into new_id;
  insert into public.lesson_credit_accounts (academy_id, rider_user_id, balance)
  values (scoped_plan.academy_id, target_rider_user_id, scoped_plan.included_credits)
  on conflict (academy_id, rider_user_id) do update
  set balance = public.lesson_credit_accounts.balance + excluded.balance, updated_at = now();
  insert into public.billing_ledger_entries (
    academy_id, rider_user_id, rider_membership_id, entry_type, credit_delta, currency, note, created_by
  ) values (
    scoped_plan.academy_id, target_rider_user_id, new_id, 'credit_grant', scoped_plan.included_credits,
    scoped_plan.currency, scoped_plan.name || ' membership credits', current_user_id
  );
  perform public.write_audit_event(scoped_plan.academy_id, 'rider_membership.enrolled', 'rider_membership', new_id,
    jsonb_build_object('rider_user_id', target_rider_user_id, 'plan_id', scoped_plan.id, 'credits', scoped_plan.included_credits));
  return new_id;
end;
$$;

create function public.record_billing_entry(
  target_academy_id uuid, target_rider_user_id uuid, target_entry_type text,
  target_amount_minor integer, target_credit_delta integer, target_currency text, target_note text
)
returns bigint language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := (select auth.uid()); new_id bigint;
begin
  if current_user_id is null or not private.has_academy_role(target_academy_id, array['academy_admin']::public.app_role[]) then
    raise exception 'Academy Admin access required' using errcode = '42501';
  end if;
  if target_entry_type not in ('payment', 'adjustment', 'refund')
    or (target_amount_minor = 0 and target_credit_delta = 0)
    or upper(target_currency) !~ '^[A-Z]{3}$' or char_length(coalesce(target_note, '')) > 500 then
    raise exception 'Invalid billing entry' using errcode = '22023';
  end if;
  if not exists (select 1 from public.academy_memberships where academy_id = target_academy_id
    and user_id = target_rider_user_id and role = 'rider' and status = 'active') then
    raise exception 'Active rider membership required' using errcode = '23514';
  end if;
  if target_credit_delta <> 0 then
    insert into public.lesson_credit_accounts (academy_id, rider_user_id, balance)
    values (target_academy_id, target_rider_user_id, greatest(target_credit_delta, 0))
    on conflict (academy_id, rider_user_id) do update
    set balance = public.lesson_credit_accounts.balance + target_credit_delta, updated_at = now()
    where public.lesson_credit_accounts.balance + target_credit_delta >= 0;
    if not found then raise exception 'Credit adjustment would make balance negative' using errcode = '23514'; end if;
  end if;
  insert into public.billing_ledger_entries (
    academy_id, rider_user_id, entry_type, amount_minor, credit_delta, currency, note, created_by
  ) values (
    target_academy_id, target_rider_user_id, target_entry_type::public.billing_entry_type,
    target_amount_minor, target_credit_delta, upper(target_currency), nullif(btrim(target_note), ''), current_user_id
  ) returning id into new_id;
  perform public.write_audit_event(target_academy_id, 'billing_ledger.' || target_entry_type, 'billing_ledger_entry', null,
    jsonb_build_object('entry_id', new_id, 'rider_user_id', target_rider_user_id, 'amount_minor', target_amount_minor, 'credit_delta', target_credit_delta));
  return new_id;
end;
$$;

create or replace function public.decide_lesson_booking(target_booking_id uuid, decision text)
returns public.lesson_booking_status language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := (select auth.uid()); scoped_booking public.lesson_bookings%rowtype;
  scoped_lesson public.lesson_sessions%rowtype; occupied_count integer; next_status public.lesson_booking_status;
begin
  if current_user_id is null or decision not in ('approve', 'decline') then raise exception 'Invalid booking decision' using errcode = '22023'; end if;
  select * into scoped_booking from public.lesson_bookings where id = target_booking_id for update;
  if not found or scoped_booking.status <> 'requested' then raise exception 'Booking is not awaiting a decision' using errcode = '23514'; end if;
  if not private.has_academy_role(scoped_booking.academy_id, array['academy_admin']::public.app_role[]) then raise exception 'Academy Admin access required' using errcode = '42501'; end if;
  select * into scoped_lesson from public.lesson_sessions where id = scoped_booking.lesson_session_id and academy_id = scoped_booking.academy_id for update;
  if not found or scoped_lesson.status = 'cancelled' then raise exception 'Lesson is unavailable' using errcode = '23514'; end if;
  if decision = 'decline' then next_status := 'declined'; else
    select count(*) into occupied_count from public.lesson_bookings where lesson_session_id = scoped_lesson.id and status in ('confirmed', 'attended', 'no_show');
    if scoped_lesson.rider_user_id is not null and scoped_lesson.rider_user_id <> scoped_booking.rider_user_id then occupied_count := occupied_count + 1; end if;
    next_status := case when occupied_count < scoped_lesson.capacity then 'confirmed'::public.lesson_booking_status else 'waitlisted'::public.lesson_booking_status end;
    if next_status = 'confirmed' then perform private.consume_lesson_credit(scoped_booking.academy_id, scoped_booking.rider_user_id, scoped_booking.id, current_user_id); end if;
  end if;
  update public.lesson_bookings set status = next_status, decided_at = now(), decided_by = current_user_id where id = target_booking_id;
  perform public.write_audit_event(scoped_booking.academy_id, 'lesson_booking.' || next_status::text, 'lesson_booking', target_booking_id,
    jsonb_build_object('lesson_session_id', scoped_booking.lesson_session_id, 'credit_consumed', next_status = 'confirmed'));
  return next_status;
end;
$$;

create or replace function public.cancel_lesson_booking(target_booking_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := (select auth.uid()); scoped_booking public.lesson_bookings%rowtype; promoted public.lesson_bookings%rowtype;
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into scoped_booking from public.lesson_bookings where id = target_booking_id for update;
  if not found or scoped_booking.status not in ('requested', 'confirmed', 'waitlisted') then raise exception 'Booking cannot be cancelled' using errcode = '23514'; end if;
  if not (private.has_academy_role(scoped_booking.academy_id, array['academy_admin']::public.app_role[])
    or scoped_booking.rider_user_id = current_user_id or scoped_booking.requested_by = current_user_id) then
    raise exception 'Booking cancellation is not authorized' using errcode = '42501';
  end if;
  perform 1 from public.lesson_sessions where id = scoped_booking.lesson_session_id for update;
  update public.lesson_bookings set status = 'cancelled' where id = target_booking_id;
  if scoped_booking.status = 'confirmed' then
    perform private.restore_lesson_credit(scoped_booking.academy_id, scoped_booking.rider_user_id, scoped_booking.id, current_user_id);
    select booking.* into promoted from public.lesson_bookings booking
    join public.lesson_credit_accounts account on account.academy_id = booking.academy_id
      and account.rider_user_id = booking.rider_user_id and account.balance > 0
    where booking.lesson_session_id = scoped_booking.lesson_session_id and booking.status = 'waitlisted'
    order by booking.requested_at, booking.id for update of booking skip locked limit 1;
    if promoted.id is not null then
      perform private.consume_lesson_credit(promoted.academy_id, promoted.rider_user_id, promoted.id, current_user_id);
      update public.lesson_bookings set status = 'confirmed', decided_at = now(), decided_by = current_user_id where id = promoted.id;
      perform public.write_audit_event(scoped_booking.academy_id, 'lesson_booking.promoted', 'lesson_booking', promoted.id,
        jsonb_build_object('lesson_session_id', scoped_booking.lesson_session_id, 'credit_consumed', true));
    end if;
  end if;
  perform public.write_audit_event(scoped_booking.academy_id, 'lesson_booking.cancelled', 'lesson_booking', target_booking_id,
    jsonb_build_object('lesson_session_id', scoped_booking.lesson_session_id, 'credit_restored', scoped_booking.status = 'confirmed'));
  return promoted.id;
end;
$$;

alter table public.membership_plans enable row level security;
alter table public.rider_memberships enable row level security;
alter table public.lesson_credit_accounts enable row level security;
alter table public.billing_ledger_entries enable row level security;

create policy membership_plans_select_members on public.membership_plans for select to authenticated
  using (private.is_academy_member(academy_id));
create policy rider_memberships_select_scoped on public.rider_memberships for select to authenticated
  using (private.can_access_rider_billing(academy_id, rider_user_id));
create policy lesson_credit_accounts_select_scoped on public.lesson_credit_accounts for select to authenticated
  using (private.can_access_rider_billing(academy_id, rider_user_id));
create policy billing_ledger_entries_select_scoped on public.billing_ledger_entries for select to authenticated
  using (private.can_access_rider_billing(academy_id, rider_user_id));

revoke all on public.membership_plans, public.rider_memberships, public.lesson_credit_accounts, public.billing_ledger_entries from anon, authenticated;
grant select on public.membership_plans, public.rider_memberships, public.lesson_credit_accounts, public.billing_ledger_entries to authenticated;
grant usage on type public.rider_membership_status, public.billing_entry_type to authenticated;

revoke all on function private.can_access_rider_billing(uuid, uuid) from public, anon;
grant execute on function private.can_access_rider_billing(uuid, uuid) to authenticated;
revoke all on function private.consume_lesson_credit(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.restore_lesson_credit(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_membership_plan(uuid, text, text, integer, text, integer) from public, anon;
revoke all on function public.enroll_rider_membership(uuid, uuid) from public, anon;
revoke all on function public.record_billing_entry(uuid, uuid, text, integer, integer, text, text) from public, anon;
grant execute on function public.create_membership_plan(uuid, text, text, integer, text, integer) to authenticated;
grant execute on function public.enroll_rider_membership(uuid, uuid) to authenticated;
grant execute on function public.record_billing_entry(uuid, uuid, text, integer, integer, text, text) to authenticated;

commit;
