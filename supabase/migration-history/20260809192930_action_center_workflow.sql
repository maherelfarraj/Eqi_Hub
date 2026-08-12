begin;

create type public.action_center_workflow_status as enum (
  'open',
  'in_progress',
  'resolved'
);

create table public.action_center_tracking (
  action_key text primary key,
  academy_id uuid not null references public.academies(id) on delete cascade,
  category text not null,
  status public.action_center_workflow_status not null default 'open',
  assigned_to uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  note text,
  updated_by uuid not null references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint action_center_tracking_key_length
    check (char_length(action_key) between 3 and 150),
  constraint action_center_tracking_category
    check (category in ('finance', 'booking', 'welfare', 'payroll', 'ai')),
  constraint action_center_tracking_note_length
    check (note is null or char_length(note) <= 1000),
  constraint action_center_tracking_resolution
    check ((status = 'resolved') = (resolved_at is not null))
);

create index action_center_tracking_status_due_idx
  on public.action_center_tracking (status, due_at)
  where status <> 'resolved';
create index action_center_tracking_assignee_idx
  on public.action_center_tracking (assigned_to, status)
  where assigned_to is not null;
create index action_center_tracking_academy_idx
  on public.action_center_tracking (academy_id, status);

alter table public.action_center_tracking enable row level security;

revoke all on public.action_center_tracking from public, anon, authenticated;
grant select on public.action_center_tracking to authenticated;
grant select, insert, update, delete on public.action_center_tracking to service_role;

create policy action_center_tracking_select_administrators
on public.action_center_tracking for select
to authenticated
using ((select private.is_platform_administrator()));

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
security definer
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
    or target_category not in ('finance', 'booking', 'welfare', 'payroll', 'ai')
    or not exists (
      select 1 from public.academies academy where academy.id = target_academy_id
    )
  then
    raise exception 'invalid action center item';
  end if;

  if normalized_note is not null and char_length(normalized_note) > 1000 then
    raise exception 'action note must not exceed 1000 characters';
  end if;

  if target_assigned_to is not null and not exists (
    select 1
    from public.platform_access access
    where access.user_id = target_assigned_to
      and access.access_level = 'administrator'
      and access.status = 'active'
  ) then
    raise exception 'assignee must be an active platform administrator';
  end if;

  insert into public.action_center_tracking as tracking (
    action_key,
    academy_id,
    category,
    status,
    assigned_to,
    due_at,
    note,
    updated_by,
    resolved_at
  )
  values (
    target_action_key,
    target_academy_id,
    target_category,
    target_status,
    target_assigned_to,
    target_due_at,
    normalized_note,
    current_user_id,
    case when target_status = 'resolved' then now() else null end
  )
  on conflict (action_key) do update
  set academy_id = excluded.academy_id,
      category = excluded.category,
      status = excluded.status,
      assigned_to = excluded.assigned_to,
      due_at = excluded.due_at,
      note = excluded.note,
      updated_by = current_user_id,
      resolved_at = case
        when excluded.status = 'resolved' then coalesce(tracking.resolved_at, now())
        else null
      end,
      updated_at = now();

  insert into public.platform_audit_events (
    actor_user_id,
    action,
    target_user_id,
    academy_id,
    metadata
  )
  values (
    current_user_id,
    'platform.action_center_updated',
    target_assigned_to,
    target_academy_id,
    jsonb_build_object(
      'action_key', target_action_key,
      'category', target_category,
      'status', target_status,
      'due_at', target_due_at,
      'has_note', normalized_note is not null
    )
  );
end;
$$;

revoke all on function public.update_action_center_item(
  text,
  uuid,
  text,
  public.action_center_workflow_status,
  uuid,
  timestamptz,
  text
) from public, anon;
grant execute on function public.update_action_center_item(
  text,
  uuid,
  text,
  public.action_center_workflow_status,
  uuid,
  timestamptz,
  text
) to authenticated;

commit;
