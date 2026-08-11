-- Fix infinite recursion between horses and horse_riders policies.
-- Idempotent and safe to run repeatedly.

begin;

create or replace function public.is_horse_owner(p_horse_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.horses
    where id = p_horse_id
      and owner_id = (select auth.uid())
  );
$$;

create or replace function public.is_horse_rider(p_horse_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.horse_riders
    where horse_id = p_horse_id
      and rider_id = (select auth.uid())
  );
$$;

revoke all on function public.is_horse_owner(uuid) from public, anon;
revoke all on function public.is_horse_rider(uuid) from public, anon;
grant execute on function public.is_horse_owner(uuid) to authenticated, service_role;
grant execute on function public.is_horse_rider(uuid) to authenticated, service_role;

create index if not exists horses_owner_id_idx
on public.horses (owner_id);

create index if not exists horse_riders_rider_id_idx
on public.horse_riders (rider_id);

drop policy if exists horses_select on public.horses;
drop policy if exists horses_modify_owner on public.horses;

create policy horses_select
on public.horses
for select
to authenticated
using (
  owner_id = (select auth.uid())
  or public.is_horse_rider(id)
);

create policy horses_modify_owner
on public.horses
for all
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists horse_riders_all on public.horse_riders;
drop policy if exists horse_riders_select on public.horse_riders;
drop policy if exists horse_riders_insert_owner on public.horse_riders;
drop policy if exists horse_riders_update_owner on public.horse_riders;
drop policy if exists horse_riders_delete_owner on public.horse_riders;

create policy horse_riders_select
on public.horse_riders
for select
to authenticated
using (
  rider_id = (select auth.uid())
  or public.is_horse_owner(horse_id)
);

create policy horse_riders_insert_owner
on public.horse_riders
for insert
to authenticated
with check (public.is_horse_owner(horse_id));

create policy horse_riders_update_owner
on public.horse_riders
for update
to authenticated
using (public.is_horse_owner(horse_id))
with check (public.is_horse_owner(horse_id));

create policy horse_riders_delete_owner
on public.horse_riders
for delete
to authenticated
using (public.is_horse_owner(horse_id));

commit;
