-- Batch 22: academy onboarding operations, observability, and safe token replacement.
-- This migration creates no organizations, users, memberships, invitations, or delivery jobs.

begin;

do $preflight$
begin
  if to_regclass('public.academy_onboarding_batches') is null
     or to_regclass('public.academy_onboarding_invitations') is null
     or to_regclass('public.audit_events') is null
     or to_regprocedure('private.phase_0b2_is_organization_manager(uuid)') is null
     or to_regprocedure('private.batch21_get_onboarding_invitations(uuid,uuid)') is null
     or to_regprocedure('extensions.gen_random_bytes(integer)') is null
     or to_regprocedure('extensions.digest(text,text)') is null then
    raise exception 'Batch 22 preflight failed: Batch 21 onboarding is not present';
  end if;
end
$preflight$;

alter table public.academy_onboarding_invitations
  add column reissue_count integer not null default 0,
  add column last_reissued_at timestamptz,
  add column last_reissued_by uuid references public.profiles(id) on delete restrict,
  add constraint academy_onboarding_invitations_reissue_count_check
    check (reissue_count between 0 and 5),
  add constraint academy_onboarding_invitations_reissue_state_check
    check (
      (reissue_count = 0 and last_reissued_at is null and last_reissued_by is null)
      or (reissue_count > 0 and last_reissued_at is not null and last_reissued_by is not null)
    );

create index academy_onboarding_invitations_last_reissued_by_idx
  on public.academy_onboarding_invitations (last_reissued_by)
  where last_reissued_by is not null;

drop function public.get_academy_onboarding_invitations(uuid, uuid);
drop function private.batch21_get_onboarding_invitations(uuid, uuid);

create function private.batch21_get_onboarding_invitations(
  p_organization_id uuid,
  p_batch_id uuid
)
returns table (
  id uuid,
  email text,
  full_name text,
  roles text[],
  status text,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz,
  reissue_count integer,
  last_reissued_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;
  if not (select private.phase_0b2_is_organization_manager(p_organization_id)) then
    raise insufficient_privilege using message = 'Organization administrator access required';
  end if;

  return query
  select
    invitation.id,
    invitation.email,
    invitation.full_name,
    invitation.roles,
    case
      when invitation.status = 'pending' and invitation.expires_at <= now() then 'expired'
      else invitation.status
    end,
    invitation.expires_at,
    invitation.accepted_at,
    invitation.created_at,
    invitation.reissue_count,
    invitation.last_reissued_at
  from public.academy_onboarding_invitations as invitation
  where invitation.organization_id = p_organization_id
    and invitation.batch_id = p_batch_id
  order by invitation.created_at;
end;
$function$;

create function private.batch22_get_onboarding_metrics(p_organization_id uuid)
returns table (
  total_batches bigint,
  active_batches bigint,
  pending_invitations bigint,
  expiring_in_24_hours bigint,
  expiring_in_7_days bigint,
  accepted_invitations bigint,
  revoked_invitations bigint,
  expired_invitations bigint,
  replacement_links_generated bigint,
  acceptance_rate numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;
  if not (select private.phase_0b2_is_organization_manager(p_organization_id)) then
    raise insufficient_privilege using message = 'Organization administrator access required';
  end if;

  return query
  select
    (select count(*) from public.academy_onboarding_batches as batch
      where batch.organization_id = p_organization_id),
    (select count(*) from public.academy_onboarding_batches as batch
      where batch.organization_id = p_organization_id and batch.status = 'active'),
    count(*) filter (where invitation.status = 'pending' and invitation.expires_at > now()),
    count(*) filter (
      where invitation.status = 'pending'
        and invitation.expires_at > now()
        and invitation.expires_at <= now() + interval '24 hours'
    ),
    count(*) filter (
      where invitation.status = 'pending'
        and invitation.expires_at > now()
        and invitation.expires_at <= now() + interval '7 days'
    ),
    count(*) filter (where invitation.status = 'accepted'),
    count(*) filter (where invitation.status = 'revoked'),
    count(*) filter (where invitation.status = 'pending' and invitation.expires_at <= now()),
    coalesce(sum(invitation.reissue_count), 0)::bigint,
    case
      when count(*) = 0 then 0::numeric
      else round(
        100::numeric * count(*) filter (where invitation.status = 'accepted') / count(*),
        1
      )
    end
  from public.academy_onboarding_invitations as invitation
  where invitation.organization_id = p_organization_id;
end;
$function$;

create function private.batch22_get_onboarding_activity(
  p_organization_id uuid,
  p_limit integer default 25
)
returns table (
  id uuid,
  action text,
  entity_type text,
  entity_id uuid,
  actor_name text,
  details jsonb,
  occurred_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;
  if not (select private.phase_0b2_is_organization_manager(p_organization_id)) then
    raise insufficient_privilege using message = 'Organization administrator access required';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise check_violation using message = 'Activity limit must be between 1 and 100';
  end if;

  return query
  select
    event.id,
    event.action,
    event.entity_type,
    event.entity_id,
    coalesce(nullif(btrim(profile.full_name), ''), 'System'),
    case event.action
      when 'onboarding.batch_created' then jsonb_build_object(
        'row_count', event.after_data->'row_count',
        'expires_in_days', event.after_data->'expires_in_days'
      )
      when 'onboarding.invitation_accepted' then jsonb_build_object(
        'roles', coalesce(event.after_data->'roles', '[]'::jsonb)
      )
      when 'onboarding.invitation_revoked' then jsonb_build_object('status', 'revoked')
      when 'onboarding.batch_closed' then jsonb_build_object(
        'revoked_pending_count', event.after_data->'revoked_pending_count'
      )
      when 'onboarding.invitation_reissued' then jsonb_build_object(
        'reason', event.after_data->'reason',
        'replacement_count', event.after_data->'replacement_count'
      )
      else '{}'::jsonb
    end,
    event.occurred_at
  from public.audit_events as event
  left join public.profiles as profile on profile.id = event.actor_user_id
  where event.organization_id = p_organization_id
    and event.action in (
      'onboarding.batch_created',
      'onboarding.invitation_accepted',
      'onboarding.invitation_revoked',
      'onboarding.batch_closed',
      'onboarding.invitation_reissued'
    )
  order by event.occurred_at desc, event.id desc
  limit p_limit;
end;
$function$;

create function private.batch22_reissue_onboarding_invitation(
  p_organization_id uuid,
  p_invitation_id uuid,
  p_reason text default 'operator_request'
)
returns table (
  invitation_id uuid,
  email text,
  full_name text,
  roles text[],
  invite_token text,
  expires_at timestamptz,
  replacement_count integer
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := (select auth.uid());
  target public.academy_onboarding_invitations%rowtype;
  replacement_token text;
begin
  if actor_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;
  if not (select private.phase_0b2_is_organization_manager(p_organization_id)) then
    raise insufficient_privilege using message = 'Organization administrator access required';
  end if;
  if p_reason is null or p_reason not in (
    'not_received', 'incorrect_delivery', 'security_rotation', 'operator_request'
  ) then
    raise check_violation using message = 'A supported replacement reason is required';
  end if;

  select invitation.* into target
  from public.academy_onboarding_invitations as invitation
  join public.academy_onboarding_batches as batch on batch.id = invitation.batch_id
  where invitation.id = p_invitation_id
    and invitation.organization_id = p_organization_id
    and invitation.status = 'pending'
    and invitation.expires_at > now()
    and batch.status = 'active'
  for update of invitation;

  if target.id is null then
    raise no_data_found using message = 'Active pending invitation not found';
  end if;
  if target.reissue_count >= 5 then
    raise check_violation using message = 'Invitation replacement limit reached';
  end if;
  if target.last_reissued_at is not null
     and target.last_reissued_at > now() - interval '5 minutes' then
    raise check_violation using message = 'Wait five minutes before generating another replacement link';
  end if;

  replacement_token := encode(extensions.gen_random_bytes(32), 'hex');

  update public.academy_onboarding_invitations as invitation
  set token_hash = encode(extensions.digest(replacement_token, 'sha256'), 'hex'),
      reissue_count = invitation.reissue_count + 1,
      last_reissued_at = now(),
      last_reissued_by = actor_id
  where invitation.id = target.id;

  insert into public.audit_events (
    organization_id, request_id, source, actor_user_id,
    entity_type, entity_id, action, after_data
  ) values (
    p_organization_id, gen_random_uuid(), 'application', actor_id,
    'academy_onboarding_invitation', target.id, 'onboarding.invitation_reissued',
    jsonb_build_object(
      'reason', p_reason,
      'replacement_count', target.reissue_count + 1
    )
  );

  return query
  select
    target.id,
    target.email,
    target.full_name,
    target.roles,
    replacement_token,
    target.expires_at,
    target.reissue_count + 1;
end;
$function$;

create function public.get_academy_onboarding_invitations(
  p_organization_id uuid,
  p_batch_id uuid
)
returns table (
  id uuid,
  email text,
  full_name text,
  roles text[],
  status text,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz,
  reissue_count integer,
  last_reissued_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select * from private.batch21_get_onboarding_invitations(p_organization_id, p_batch_id);
$function$;

create function public.get_academy_onboarding_metrics(p_organization_id uuid)
returns table (
  total_batches bigint,
  active_batches bigint,
  pending_invitations bigint,
  expiring_in_24_hours bigint,
  expiring_in_7_days bigint,
  accepted_invitations bigint,
  revoked_invitations bigint,
  expired_invitations bigint,
  replacement_links_generated bigint,
  acceptance_rate numeric
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select * from private.batch22_get_onboarding_metrics(p_organization_id);
$function$;

create function public.get_academy_onboarding_activity(
  p_organization_id uuid,
  p_limit integer default 25
)
returns table (
  id uuid,
  action text,
  entity_type text,
  entity_id uuid,
  actor_name text,
  details jsonb,
  occurred_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select * from private.batch22_get_onboarding_activity(p_organization_id, p_limit);
$function$;

create function public.reissue_academy_onboarding_invitation(
  p_organization_id uuid,
  p_invitation_id uuid,
  p_reason text default 'operator_request'
)
returns table (
  invitation_id uuid,
  email text,
  full_name text,
  roles text[],
  invite_token text,
  expires_at timestamptz,
  replacement_count integer
)
language sql
security invoker
set search_path = ''
as $function$
  select * from private.batch22_reissue_onboarding_invitation(
    p_organization_id, p_invitation_id, p_reason
  );
$function$;

revoke all on function private.batch21_get_onboarding_invitations(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function private.batch22_get_onboarding_metrics(uuid) from public, anon, authenticated, service_role;
revoke all on function private.batch22_get_onboarding_activity(uuid, integer) from public, anon, authenticated, service_role;
revoke all on function private.batch22_reissue_onboarding_invitation(uuid, uuid, text) from public, anon, authenticated, service_role;

grant execute on function private.batch21_get_onboarding_invitations(uuid, uuid) to authenticated;
grant execute on function private.batch22_get_onboarding_metrics(uuid) to authenticated;
grant execute on function private.batch22_get_onboarding_activity(uuid, integer) to authenticated;
grant execute on function private.batch22_reissue_onboarding_invitation(uuid, uuid, text) to authenticated;

revoke all on function public.get_academy_onboarding_invitations(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.get_academy_onboarding_metrics(uuid) from public, anon, authenticated, service_role;
revoke all on function public.get_academy_onboarding_activity(uuid, integer) from public, anon, authenticated, service_role;
revoke all on function public.reissue_academy_onboarding_invitation(uuid, uuid, text) from public, anon, authenticated, service_role;

grant execute on function public.get_academy_onboarding_invitations(uuid, uuid) to authenticated;
grant execute on function public.get_academy_onboarding_metrics(uuid) to authenticated;
grant execute on function public.get_academy_onboarding_activity(uuid, integer) to authenticated;
grant execute on function public.reissue_academy_onboarding_invitation(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';

commit;
