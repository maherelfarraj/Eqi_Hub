begin;

alter table public.academies
  add column archived_at timestamptz,
  add column archived_by uuid references auth.users(id);

create index academies_active_name_idx
  on public.academies (name)
  where archived_at is null;

drop policy if exists platform_academy_directory_read on public.academies;
create policy platform_academy_directory_read
on public.academies for select to authenticated
using (
  (archived_at is null and (select private.is_platform_user()))
  or (select private.is_platform_administrator())
);

create or replace function public.update_academy_settings(
  target_academy_id uuid,
  academy_name text,
  academy_timezone text,
  target_archived boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  existing public.academies%rowtype;
  next_action text;
begin
  if current_user_id is null or not private.is_platform_administrator() then
    raise exception 'platform administrator access required' using errcode = '42501';
  end if;

  select * into existing
  from public.academies
  where id = target_academy_id
  for update;

  if existing.id is null then
    raise exception 'academy not found' using errcode = 'P0002';
  end if;
  if char_length(trim(academy_name)) not between 2 and 120 then
    raise exception 'academy name must be between 2 and 120 characters' using errcode = '22023';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_timezone_names
    where name = trim(academy_timezone)
  ) then
    raise exception 'invalid IANA timezone' using errcode = '22023';
  end if;

  next_action := case
    when existing.archived_at is null and target_archived then 'academy.archived'
    when existing.archived_at is not null and not target_archived then 'academy.restored'
    else 'academy.settings_updated'
  end;

  update public.academies
  set name = trim(academy_name),
      timezone = trim(academy_timezone),
      archived_at = case when target_archived then coalesce(archived_at, now()) else null end,
      archived_by = case when target_archived then current_user_id else null end,
      updated_at = now()
  where id = target_academy_id;

  insert into public.audit_events (
    academy_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    target_academy_id,
    current_user_id,
    next_action,
    'academy',
    target_academy_id,
    jsonb_build_object(
      'previous_name', existing.name,
      'new_name', trim(academy_name),
      'previous_timezone', existing.timezone,
      'new_timezone', trim(academy_timezone),
      'archived', target_archived
    )
  );
end;
$$;

revoke all on function public.update_academy_settings(uuid, text, text, boolean)
  from public, anon;
grant execute on function public.update_academy_settings(uuid, text, text, boolean)
  to authenticated;

commit;
