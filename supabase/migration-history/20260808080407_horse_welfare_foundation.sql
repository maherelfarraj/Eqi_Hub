
create type public.horse_welfare_condition as enum (
  'clear',
  'monitor',
  'attention'
);

create type public.horse_welfare_appetite as enum (
  'normal',
  'reduced',
  'not_observed'
);

create type public.horse_welfare_movement as enum (
  'sound',
  'stiff',
  'irregular',
  'not_observed'
);

create type public.horse_welfare_hydration as enum (
  'normal',
  'monitor',
  'not_observed'
);

create table public.horse_welfare_checks (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null
    references public.academies(id) on delete cascade,
  horse_id uuid not null
    references public.horses(id) on delete restrict,
  checked_at timestamptz not null,
  condition_flag public.horse_welfare_condition not null,
  appetite public.horse_welfare_appetite not null default 'not_observed',
  movement public.horse_welfare_movement not null default 'not_observed',
  hydration public.horse_welfare_hydration not null default 'not_observed',
  temperature_c numeric(4, 1),
  resting_heart_rate smallint,
  notes text,
  action_required text,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint horse_welfare_temperature_range check (
    temperature_c is null or temperature_c between 34.0 and 43.0
  ),
  constraint horse_welfare_heart_rate_range check (
    resting_heart_rate is null or resting_heart_rate between 20 and 100
  ),
  constraint horse_welfare_notes_length check (
    notes is null or char_length(btrim(notes)) between 3 and 1500
  ),
  constraint horse_welfare_action_length check (
    action_required is null
    or char_length(btrim(action_required)) between 3 and 1000
  )
);

create index horse_welfare_academy_checked_idx
  on public.horse_welfare_checks (academy_id, checked_at desc);
create index horse_welfare_horse_checked_idx
  on public.horse_welfare_checks (horse_id, checked_at desc);
create index horse_welfare_recorded_by_idx
  on public.horse_welfare_checks (recorded_by);
create index horse_welfare_attention_idx
  on public.horse_welfare_checks (academy_id, checked_at desc)
  where condition_flag <> 'clear'::public.horse_welfare_condition;

comment on table public.horse_welfare_checks is
  'Sensitive horse welfare observations visible only to active academy admins and coaches.';

create function private.validate_horse_welfare_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  scoped_horse public.horses%rowtype;
begin
  select *
  into scoped_horse
  from public.horses
  where id = new.horse_id;

  if scoped_horse.id is null then
    raise exception 'Horse does not exist'
      using errcode = '23514';
  end if;

  if scoped_horse.academy_id <> new.academy_id then
    raise exception 'Welfare check must match the horse academy'
      using errcode = '23514';
  end if;

  if new.checked_at > now() + interval '5 minutes' then
    raise exception 'Welfare check time cannot be in the future'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    if new.recorded_by <> (select auth.uid())
      or not private.has_academy_role(
        new.academy_id,
        array['academy_admin', 'coach']::public.app_role[]
      )
    then
      raise exception 'Only Academy Admins and coaches may record welfare checks'
        using errcode = '42501';
    end if;
  else
    if new.academy_id <> old.academy_id
      or new.horse_id <> old.horse_id
      or new.recorded_by <> old.recorded_by
    then
      raise exception 'Welfare check ownership and scope cannot be changed'
        using errcode = '23514';
    end if;

    if not (
      private.has_academy_role(
        new.academy_id,
        array['academy_admin']::public.app_role[]
      )
      or (
        new.recorded_by = (select auth.uid())
        and private.has_academy_role(
          new.academy_id,
          array['coach']::public.app_role[]
        )
      )
    ) then
      raise exception 'Only an Academy Admin or the coach who recorded the check may update it'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create function private.touch_horse_welfare_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger horse_welfare_checks_validate_scope
before insert or update on public.horse_welfare_checks
for each row execute function private.validate_horse_welfare_check();

create trigger horse_welfare_checks_touch_updated_at
before update on public.horse_welfare_checks
for each row execute function private.touch_horse_welfare_updated_at();

alter table public.horse_welfare_checks enable row level security;

create policy horse_welfare_checks_select_staff
on public.horse_welfare_checks
for select
to authenticated
using (
  private.has_academy_role(
    academy_id,
    array['academy_admin', 'coach']::public.app_role[]
  )
);

create policy horse_welfare_checks_insert_staff
on public.horse_welfare_checks
for insert
to authenticated
with check (
  recorded_by = (select auth.uid())
  and private.has_academy_role(
    academy_id,
    array['academy_admin', 'coach']::public.app_role[]
  )
);

create policy horse_welfare_checks_update_admin_or_author
on public.horse_welfare_checks
for update
to authenticated
using (
  private.has_academy_role(
    academy_id,
    array['academy_admin']::public.app_role[]
  )
  or (
    recorded_by = (select auth.uid())
    and private.has_academy_role(
      academy_id,
      array['coach']::public.app_role[]
    )
  )
)
with check (
  private.has_academy_role(
    academy_id,
    array['academy_admin']::public.app_role[]
  )
  or (
    recorded_by = (select auth.uid())
    and private.has_academy_role(
      academy_id,
      array['coach']::public.app_role[]
    )
  )
);

revoke all on public.horse_welfare_checks from anon, authenticated;
grant select on public.horse_welfare_checks to authenticated;
grant insert (
  academy_id,
  horse_id,
  checked_at,
  condition_flag,
  appetite,
  movement,
  hydration,
  temperature_c,
  resting_heart_rate,
  notes,
  action_required,
  recorded_by
) on public.horse_welfare_checks to authenticated;
grant update (
  checked_at,
  condition_flag,
  appetite,
  movement,
  hydration,
  temperature_c,
  resting_heart_rate,
  notes,
  action_required
) on public.horse_welfare_checks to authenticated;

revoke all on type public.horse_welfare_condition
  from public, anon, authenticated;
revoke all on type public.horse_welfare_appetite
  from public, anon, authenticated;
revoke all on type public.horse_welfare_movement
  from public, anon, authenticated;
revoke all on type public.horse_welfare_hydration
  from public, anon, authenticated;
grant usage on type public.horse_welfare_condition to authenticated;
grant usage on type public.horse_welfare_appetite to authenticated;
grant usage on type public.horse_welfare_movement to authenticated;
grant usage on type public.horse_welfare_hydration to authenticated;

revoke all on function private.validate_horse_welfare_check()
  from public, anon, authenticated;
revoke all on function private.touch_horse_welfare_updated_at()
  from public, anon, authenticated;

