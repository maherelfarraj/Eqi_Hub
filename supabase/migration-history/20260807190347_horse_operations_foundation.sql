begin;

create type public.horse_sex as enum (
  'mare',
  'gelding',
  'stallion',
  'unspecified'
);

create type public.horse_status as enum (
  'available',
  'limited',
  'rest',
  'retired'
);

create table public.horses (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  name text not null,
  stable_name text,
  birth_year integer,
  sex public.horse_sex not null default 'unspecified',
  status public.horse_status not null default 'available',
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint horses_name_length check (char_length(name) between 2 and 120),
  constraint horses_stable_name_length check (
    stable_name is null or char_length(stable_name) between 1 and 120
  ),
  constraint horses_birth_year_range check (
    birth_year is null or birth_year between 1950 and 2100
  ),
  constraint horses_notes_length check (
    notes is null or char_length(notes) between 1 and 1000
  )
);

create index horses_academy_status_name_idx
  on public.horses (academy_id, status, name);
create index horses_created_by_idx
  on public.horses (created_by);

alter table public.horses enable row level security;

create policy horses_select_members
  on public.horses for select to authenticated
  using (private.is_academy_member(academy_id));

create policy horses_insert_admins
  on public.horses for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and private.has_academy_role(
      academy_id,
      array['academy_admin']::public.app_role[]
    )
  );

create policy horses_update_admins
  on public.horses for update to authenticated
  using (
    private.has_academy_role(
      academy_id,
      array['academy_admin']::public.app_role[]
    )
  )
  with check (
    private.has_academy_role(
      academy_id,
      array['academy_admin']::public.app_role[]
    )
  );

revoke all on public.horses from anon, authenticated;
grant select on public.horses to authenticated;
grant insert (
  academy_id,
  name,
  stable_name,
  birth_year,
  sex,
  status,
  notes,
  created_by
) on public.horses to authenticated;
grant update (
  name,
  stable_name,
  birth_year,
  sex,
  status,
  notes,
  updated_at
) on public.horses to authenticated;

commit;
