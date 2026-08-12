-- Phase 0A.2: browser-commercial-write boundary, RLS correction, function
-- hardening, and private video bucket limits. Forward-only; no row changes.

begin;

do $preflight$
declare
  object_name text;
begin
  foreach object_name in array array[
    'public.memberships',
    'public.payment_methods',
    'public.invoices',
    'public.invoice_lines',
    'public.video_analyses',
    'public.lessons',
    'public.horses',
    'public.horse_riders'
  ] loop
    if to_regclass(object_name) is null then
      raise exception 'Phase 0A.2 preflight failed: % is missing', object_name;
    end if;
  end loop;

  if to_regprocedure('public.handle_new_user()') is null
     or to_regprocedure('public.set_updated_at()') is null
     or to_regprocedure('public.is_horse_owner(uuid)') is null
     or to_regprocedure('public.is_horse_rider(uuid)') is null then
    raise exception 'Phase 0A.2 preflight failed: canonical public functions are missing';
  end if;

  if to_regnamespace('private') is null
     or not has_schema_privilege('authenticated', 'private', 'USAGE') then
    raise exception 'Phase 0A.2 preflight failed: authenticated lacks private schema usage';
  end if;

  if to_regprocedure('private.is_horse_owner(uuid)') is not null
     or to_regprocedure('private.is_horse_rider(uuid)') is not null then
    raise exception 'Phase 0A.2 preflight failed: target private helpers already exist';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payment_methods'
      and column_name = 'provider_token'
      and data_type = 'text'
  ) then
    raise exception 'Phase 0A.2 preflight failed: payment_methods.provider_token text is missing';
  end if;

  if not exists (
    select 1
    from storage.buckets
    where id = 'videos'
      and public = false
      and file_size_limit is null
      and allowed_mime_types is null
  ) then
    raise exception 'Phase 0A.2 preflight failed: videos bucket differs from the reviewed baseline';
  end if;

  if exists (
    select 1
    from (values
      ('memberships'), ('payment_methods'), ('invoices'), ('invoice_lines'),
      ('video_analyses'), ('lessons'), ('horses'), ('horse_riders')
    ) as expected(table_name)
    where not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = expected.table_name
        and c.relrowsecurity
    )
  ) then
    raise exception 'Phase 0A.2 preflight failed: an audited table does not have RLS enabled';
  end if;
end
$preflight$;

-- Commercial records become client-readable and server-owned.
revoke all privileges on table public.memberships from anon;
revoke all privileges on table public.payment_methods from anon;
revoke all privileges on table public.invoices from anon;
revoke all privileges on table public.invoice_lines from anon;

revoke insert, update, delete, truncate, references, trigger
  on table public.memberships, public.payment_methods,
  public.invoices, public.invoice_lines
  from authenticated;

grant select on table public.memberships to authenticated;
grant select on table public.invoices to authenticated;
grant select on table public.invoice_lines to authenticated;

revoke select on table public.payment_methods from authenticated;
grant select (
  id, user_id, brand, last4, exp_month, exp_year, is_default, created_at
) on table public.payment_methods to authenticated;

grant all privileges on table public.memberships to service_role;
grant all privileges on table public.payment_methods to service_role;
grant all privileges on table public.invoices to service_role;
grant all privileges on table public.invoice_lines to service_role;

drop policy if exists memberships_all_own on public.memberships;
drop policy if exists memberships_select_own on public.memberships;
create policy memberships_select_own
on public.memberships
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists payment_methods_all_own on public.payment_methods;
drop policy if exists payment_methods_select_own on public.payment_methods;
create policy payment_methods_select_own
on public.payment_methods
for select
to authenticated
using (user_id = (select auth.uid()));

-- Trainers may read only analyses actually attached to one of their lessons.
drop policy if exists analyses_select_trainer on public.video_analyses;
create policy analyses_select_trainer
on public.video_analyses
for select
to authenticated
using (
  exists (
    select 1
    from public.lessons as lesson
    where lesson.analysis_id = video_analyses.id
      and lesson.trainer_id = (select auth.uid())
  )
);

-- Trigger functions retain their existing behavior but use a fixed path and
-- cannot be invoked from the Data API.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
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

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  new.updated_at = pg_catalog.now();
  return new;
end
$function$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- Authorization helpers live outside exposed schemas. Only the exact helper
-- signatures are callable by authenticated policies.
create function private.is_horse_owner(p_horse_id uuid)
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

create function private.is_horse_rider(p_horse_id uuid)
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

revoke all on function private.is_horse_owner(uuid) from public, anon, authenticated, service_role;
revoke all on function private.is_horse_rider(uuid) from public, anon, authenticated, service_role;
grant execute on function private.is_horse_owner(uuid) to authenticated;
grant execute on function private.is_horse_rider(uuid) to authenticated;

drop policy if exists horses_select on public.horses;
drop policy if exists horses_modify_owner on public.horses;
create policy horses_select
on public.horses
for select
to authenticated
using (
  owner_id = (select auth.uid())
  or private.is_horse_rider(id)
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
  or private.is_horse_owner(horse_id)
);
create policy horse_riders_insert_owner
on public.horse_riders
for insert
to authenticated
with check (private.is_horse_owner(horse_id));
create policy horse_riders_update_owner
on public.horse_riders
for update
to authenticated
using (private.is_horse_owner(horse_id))
with check (private.is_horse_owner(horse_id));
create policy horse_riders_delete_owner
on public.horse_riders
for delete
to authenticated
using (private.is_horse_owner(horse_id));

drop function public.is_horse_owner(uuid);
drop function public.is_horse_rider(uuid);

update storage.buckets
set file_size_limit = 524288000,
    allowed_mime_types = array['video/mp4', 'video/quicktime', 'video/webm']::text[]
where id = 'videos';

commit;
