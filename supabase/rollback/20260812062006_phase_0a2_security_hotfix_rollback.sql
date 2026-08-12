-- Roll back only Phase 0A.2 and restore the production-derived ADR-001
-- baseline. This intentionally restores the prior trainer policy defect and
-- broad grants, so it is for emergency reversal only.

begin;

do $preflight$
begin
  if to_regprocedure('private.is_horse_owner(uuid)') is null
     or to_regprocedure('private.is_horse_rider(uuid)') is null
     or to_regprocedure('public.is_horse_owner(uuid)') is not null
     or to_regprocedure('public.is_horse_rider(uuid)') is not null then
    raise exception 'Phase 0A.2 rollback preflight failed: forward helper state not found';
  end if;

  if not exists (
    select 1
    from storage.buckets
    where id = 'videos'
      and public = false
      and file_size_limit = 524288000
      and allowed_mime_types = array['video/mp4', 'video/quicktime', 'video/webm']::text[]
  ) then
    raise exception 'Phase 0A.2 rollback preflight failed: hardened videos bucket state not found';
  end if;
end
$preflight$;

update storage.buckets
set file_size_limit = null,
    allowed_mime_types = null
where id = 'videos';

create function public.is_horse_owner(p_horse_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.horses
    where id = p_horse_id
      and owner_id = (select auth.uid())
  );
$function$;

create function public.is_horse_rider(p_horse_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.horse_riders
    where horse_id = p_horse_id
      and rider_id = (select auth.uid())
  );
$function$;

revoke all on function public.is_horse_owner(uuid) from public, anon;
revoke all on function public.is_horse_rider(uuid) from public, anon;
grant execute on function public.is_horse_owner(uuid) to authenticated, service_role;
grant execute on function public.is_horse_rider(uuid) to authenticated, service_role;

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

drop function private.is_horse_owner(uuid);
drop function private.is_horse_rider(uuid);

drop policy if exists analyses_select_trainer on public.video_analyses;
create policy analyses_select_trainer
on public.video_analyses
for select
to public
using (
  exists (
    select 1
    from public.lessons as lesson
    where lesson.analysis_id = lesson.id
      and lesson.trainer_id = (select auth.uid())
  )
);

drop policy if exists memberships_select_own on public.memberships;
drop policy if exists memberships_all_own on public.memberships;
create policy memberships_all_own
on public.memberships
for all
to public
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists payment_methods_select_own on public.payment_methods;
drop policy if exists payment_methods_all_own on public.payment_methods;
create policy payment_methods_all_own
on public.payment_methods
for all
to public
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant all privileges on table public.memberships to anon, authenticated, service_role;
grant all privileges on table public.payment_methods to anon, authenticated, service_role;
grant all privileges on table public.invoices to anon, authenticated, service_role;
grant all privileges on table public.invoice_lines to anon, authenticated, service_role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $function$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;

  insert into public.notification_prefs (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end
$function$;

grant execute on function public.handle_new_user() to public, anon, authenticated, service_role;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
as $function$
begin
  new.updated_at = now();
  return new;
end
$function$;

grant execute on function public.set_updated_at() to public, anon, authenticated, service_role;

commit;
