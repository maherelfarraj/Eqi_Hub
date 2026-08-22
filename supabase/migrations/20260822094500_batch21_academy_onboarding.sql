-- Batch 21: audited, invitation-based academy onboarding.
-- This migration creates no organizations, users, memberships, or invitations.

begin;

do $preflight$
begin
  if to_regclass('public.organizations') is null
     or to_regclass('public.organization_memberships') is null
     or to_regclass('public.organization_member_roles') is null
     or to_regclass('public.audit_events') is null
     or to_regprocedure('private.phase_0b2_is_organization_manager(uuid)') is null then
    raise exception 'Batch 21 preflight failed: organization operations are not present';
  end if;

  if to_regclass('public.academy_onboarding_batches') is not null
     or to_regclass('public.academy_onboarding_invitations') is not null then
    raise exception 'Batch 21 preflight failed: onboarding tables already exist';
  end if;
end
$preflight$;

create table public.academy_onboarding_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null,
  status text not null default 'active',
  row_count integer not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint academy_onboarding_batches_name_check
    check (length(btrim(name)) between 2 and 120),
  constraint academy_onboarding_batches_status_check
    check (status in ('active', 'closed', 'cancelled')),
  constraint academy_onboarding_batches_row_count_check
    check (row_count between 1 and 100),
  constraint academy_onboarding_batches_closed_state_check
    check ((status = 'active' and closed_at is null) or (status <> 'active' and closed_at is not null)),
  unique (id, organization_id)
);

create table public.academy_onboarding_invitations (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  organization_id uuid not null,
  email text not null,
  full_name text not null,
  roles text[] not null,
  token_hash text not null unique,
  status text not null default 'pending',
  expires_at timestamptz not null,
  accepted_by uuid references public.profiles(id) on delete restrict,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint academy_onboarding_invitations_batch_fkey
    foreign key (batch_id, organization_id)
    references public.academy_onboarding_batches(id, organization_id)
    on delete cascade,
  constraint academy_onboarding_invitations_email_check
    check (
      email = lower(btrim(email))
      and length(email) between 3 and 254
      and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ),
  constraint academy_onboarding_invitations_name_check
    check (length(btrim(full_name)) between 2 and 160),
  constraint academy_onboarding_invitations_roles_check
    check (
      cardinality(roles) between 1 and 8
      and roles <@ array[
        'coach', 'rider', 'guardian', 'horse_owner', 'stable_manager',
        'accountant', 'competition_manager'
      ]::text[]
    ),
  constraint academy_onboarding_invitations_token_hash_check
    check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint academy_onboarding_invitations_status_check
    check (status in ('pending', 'accepted', 'revoked')),
  constraint academy_onboarding_invitations_resolution_check
    check (
      (status = 'pending' and accepted_by is null and accepted_at is null and revoked_at is null)
      or (status = 'accepted' and accepted_by is not null and accepted_at is not null and revoked_at is null)
      or (status = 'revoked' and accepted_by is null and accepted_at is null and revoked_at is not null)
    )
);

create index academy_onboarding_batches_organization_idx
  on public.academy_onboarding_batches (organization_id, created_at desc);
create index academy_onboarding_batches_created_by_idx
  on public.academy_onboarding_batches (created_by);
create index academy_onboarding_invitations_batch_idx
  on public.academy_onboarding_invitations (batch_id, organization_id, created_at);
create index academy_onboarding_invitations_organization_idx
  on public.academy_onboarding_invitations (organization_id, status, expires_at);
create index academy_onboarding_invitations_accepted_by_idx
  on public.academy_onboarding_invitations (accepted_by)
  where accepted_by is not null;
create index academy_onboarding_invitations_created_by_idx
  on public.academy_onboarding_invitations (created_by);
create unique index academy_onboarding_invitations_pending_email_idx
  on public.academy_onboarding_invitations (organization_id, email)
  where status = 'pending';

alter table public.academy_onboarding_batches enable row level security;
alter table public.academy_onboarding_invitations enable row level security;

create policy academy_onboarding_batches_deny_direct_access
on public.academy_onboarding_batches
as restrictive for all to authenticated
using (false)
with check (false);

create policy academy_onboarding_invitations_deny_direct_access
on public.academy_onboarding_invitations
as restrictive for all to authenticated
using (false)
with check (false);

-- Tables remain RPC-only so token hashes and invitation PII are never exposed
-- through direct PostgREST selects. The service role retains operational access.
revoke all on public.academy_onboarding_batches from public, anon, authenticated;
revoke all on public.academy_onboarding_invitations from public, anon, authenticated;
grant select, insert, update, delete on public.academy_onboarding_batches to service_role;
grant select, insert, update, delete on public.academy_onboarding_invitations to service_role;

create function private.batch21_validate_onboarding_entries(
  p_organization_id uuid,
  p_entries jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  entry jsonb;
  entry_number integer := 0;
  entry_email text;
  entry_name text;
  entry_roles text[];
  seen_emails text[] := '{}'::text[];
  validation_errors jsonb := '[]'::jsonb;
  existing_accounts integer := 0;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not (select private.phase_0b2_is_organization_manager(p_organization_id)) then
    raise insufficient_privilege using message = 'Organization administrator access required';
  end if;

  if jsonb_typeof(p_entries) <> 'array' then
    return jsonb_build_object(
      'valid', false,
      'rowCount', 0,
      'existingAccountCount', 0,
      'errors', jsonb_build_array(jsonb_build_object(
        'row', 0, 'field', 'file', 'message', 'Onboarding input must be a JSON array'
      ))
    );
  end if;

  if jsonb_array_length(p_entries) < 1 or jsonb_array_length(p_entries) > 100 then
    validation_errors := validation_errors || jsonb_build_array(jsonb_build_object(
      'row', 0,
      'field', 'file',
      'message', 'An onboarding batch must contain between 1 and 100 rows'
    ));
  end if;

  for entry in select value from jsonb_array_elements(p_entries)
  loop
    entry_number := entry_number + 1;

    if jsonb_typeof(entry) <> 'object' then
      validation_errors := validation_errors || jsonb_build_array(jsonb_build_object(
        'row', entry_number, 'field', 'row', 'message', 'Each row must be an object'
      ));
      continue;
    end if;

    entry_email := lower(btrim(coalesce(entry->>'email', '')));
    entry_name := btrim(coalesce(entry->>'fullName', entry->>'full_name', ''));

    if entry_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
       or length(entry_email) > 254 then
      validation_errors := validation_errors || jsonb_build_array(jsonb_build_object(
        'row', entry_number, 'field', 'email', 'message', 'Enter a valid email address'
      ));
    elsif entry_email = any(seen_emails) then
      validation_errors := validation_errors || jsonb_build_array(jsonb_build_object(
        'row', entry_number, 'field', 'email', 'message', 'Email is duplicated in this batch'
      ));
    else
      seen_emails := array_append(seen_emails, entry_email);

      if exists (
        select 1
        from public.organization_memberships as membership
        join public.profiles as profile on profile.id = membership.user_id
        where membership.organization_id = p_organization_id
          and membership.status = 'active'
          and lower(profile.email) = entry_email
      ) then
        validation_errors := validation_errors || jsonb_build_array(jsonb_build_object(
          'row', entry_number, 'field', 'email', 'message', 'Account is already an active organization member'
        ));
      end if;

      if exists (
        select 1
        from public.academy_onboarding_invitations as invitation
        where invitation.organization_id = p_organization_id
          and invitation.email = entry_email
          and invitation.status = 'pending'
          and invitation.expires_at > now()
      ) then
        validation_errors := validation_errors || jsonb_build_array(jsonb_build_object(
          'row', entry_number, 'field', 'email', 'message', 'A live invitation already exists for this email'
        ));
      end if;

      if exists (select 1 from public.profiles where lower(email) = entry_email) then
        existing_accounts := existing_accounts + 1;
      end if;
    end if;

    if length(entry_name) < 2 or length(entry_name) > 160 then
      validation_errors := validation_errors || jsonb_build_array(jsonb_build_object(
        'row', entry_number, 'field', 'full_name', 'message', 'Full name must contain 2 to 160 characters'
      ));
    end if;

    if jsonb_typeof(entry->'roles') <> 'array' then
      validation_errors := validation_errors || jsonb_build_array(jsonb_build_object(
        'row', entry_number, 'field', 'roles', 'message', 'Roles must be a JSON array'
      ));
      continue;
    end if;

    select coalesce(array_agg(distinct lower(btrim(role)) order by lower(btrim(role))), '{}'::text[])
    into entry_roles
    from jsonb_array_elements_text(entry->'roles') as role;

    if cardinality(entry_roles) < 1 then
      validation_errors := validation_errors || jsonb_build_array(jsonb_build_object(
        'row', entry_number, 'field', 'roles', 'message', 'At least one role is required'
      ));
    elsif exists (
      select 1 from unnest(entry_roles) as role
      where role <> all(array[
        'coach', 'rider', 'guardian', 'horse_owner', 'stable_manager',
        'accountant', 'competition_manager'
      ]::text[])
    ) then
      validation_errors := validation_errors || jsonb_build_array(jsonb_build_object(
        'row', entry_number, 'field', 'roles', 'message', 'One or more roles are not eligible for batch onboarding'
      ));
    end if;
  end loop;

  return jsonb_build_object(
    'valid', jsonb_array_length(validation_errors) = 0,
    'rowCount', jsonb_array_length(p_entries),
    'existingAccountCount', existing_accounts,
    'errors', validation_errors
  );
end;
$function$;

create function private.batch21_create_onboarding_batch(
  p_organization_id uuid,
  p_name text,
  p_entries jsonb,
  p_expires_in_days integer
)
returns table (
  invitation_id uuid,
  email text,
  full_name text,
  roles text[],
  invite_token text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := (select auth.uid());
  validation jsonb;
  created_batch_id uuid;
  entry jsonb;
begin
  if actor_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if p_expires_in_days < 1 or p_expires_in_days > 30 then
    raise check_violation using message = 'Invitation expiry must be between 1 and 30 days';
  end if;

  if length(btrim(p_name)) < 2 or length(btrim(p_name)) > 120 then
    raise check_violation using message = 'Batch name must contain 2 to 120 characters';
  end if;

  if not (select private.phase_0b2_is_organization_manager(p_organization_id)) then
    raise insufficient_privilege using message = 'Organization administrator access required';
  end if;

  perform 1 from public.organizations where id = p_organization_id and active for update;
  if not found then
    raise no_data_found using message = 'Active organization not found';
  end if;

  update public.academy_onboarding_invitations as expired_invitation
  set status = 'revoked', revoked_at = now()
  where expired_invitation.organization_id = p_organization_id
    and expired_invitation.status = 'pending'
    and expired_invitation.expires_at <= now();

  validation := private.batch21_validate_onboarding_entries(p_organization_id, p_entries);
  if not coalesce((validation->>'valid')::boolean, false) then
    raise check_violation using
      message = 'Onboarding validation failed',
      detail = validation::text;
  end if;

  insert into public.academy_onboarding_batches (
    organization_id, name, row_count, created_by
  ) values (
    p_organization_id, btrim(p_name), jsonb_array_length(p_entries), actor_id
  ) returning id into created_batch_id;

  for entry in select value from jsonb_array_elements(p_entries)
  loop
    email := lower(btrim(entry->>'email'));
    full_name := btrim(coalesce(entry->>'fullName', entry->>'full_name'));
    select array_agg(distinct lower(btrim(role)) order by lower(btrim(role)))
      into roles
      from jsonb_array_elements_text(entry->'roles') as role;
    invite_token := encode(extensions.gen_random_bytes(32), 'hex');
    expires_at := now() + make_interval(days => p_expires_in_days);

    insert into public.academy_onboarding_invitations (
      batch_id, organization_id, email, full_name, roles, token_hash,
      expires_at, created_by
    ) values (
      created_batch_id, p_organization_id, email, full_name, roles,
      encode(extensions.digest(invite_token, 'sha256'), 'hex'),
      expires_at, actor_id
    ) returning id into invitation_id;

    return next;
  end loop;

  insert into public.audit_events (
    organization_id, request_id, source, actor_user_id,
    entity_type, entity_id, action, after_data
  ) values (
    p_organization_id, gen_random_uuid(), 'application', actor_id,
    'academy_onboarding_batch', created_batch_id, 'onboarding.batch_created',
    jsonb_build_object(
      'row_count', jsonb_array_length(p_entries),
      'expires_in_days', p_expires_in_days
    )
  );
end;
$function$;

create function private.batch21_get_onboarding_batches(p_organization_id uuid)
returns table (
  id uuid,
  name text,
  status text,
  row_count integer,
  pending_count bigint,
  accepted_count bigint,
  revoked_count bigint,
  created_at timestamptz,
  closed_at timestamptz
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
    batch.id,
    batch.name,
    batch.status,
    batch.row_count,
    count(*) filter (
      where invitation.status = 'pending' and invitation.expires_at > now()
    ),
    count(*) filter (where invitation.status = 'accepted'),
    count(*) filter (
      where invitation.status = 'revoked'
         or (invitation.status = 'pending' and invitation.expires_at <= now())
    ),
    batch.created_at,
    batch.closed_at
  from public.academy_onboarding_batches as batch
  join public.academy_onboarding_invitations as invitation on invitation.batch_id = batch.id
  where batch.organization_id = p_organization_id
  group by batch.id
  order by batch.created_at desc;
end;
$function$;

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
  created_at timestamptz
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
    invitation.created_at
  from public.academy_onboarding_invitations as invitation
  where invitation.organization_id = p_organization_id
    and invitation.batch_id = p_batch_id
  order by invitation.created_at;
end;
$function$;

create function private.batch21_claim_onboarding_invitation(p_invite_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := (select auth.uid());
  actor_email text;
  target public.academy_onboarding_invitations%rowtype;
  claimed_membership_id uuid;
  requested_role text;
begin
  if actor_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;
  if p_invite_token !~ '^[a-f0-9]{64}$' then
    raise invalid_parameter_value using message = 'Invitation is invalid or expired';
  end if;

  select lower(email) into actor_email from public.profiles where id = actor_id;
  if actor_email is null then
    raise no_data_found using message = 'A completed EquiVista profile is required';
  end if;

  select invitation.* into target
  from public.academy_onboarding_invitations as invitation
  join public.academy_onboarding_batches as batch on batch.id = invitation.batch_id
  where invitation.token_hash = encode(extensions.digest(p_invite_token, 'sha256'), 'hex')
    and invitation.status = 'pending'
    and invitation.expires_at > now()
    and batch.status = 'active'
  for update of invitation;

  if target.id is null then
    raise no_data_found using message = 'Invitation is invalid or expired';
  end if;
  if actor_email <> target.email then
    raise insufficient_privilege using message = 'Sign in with the invited email address';
  end if;

  insert into public.organization_memberships (
    organization_id, user_id, status, invited_by, joined_at
  ) values (
    target.organization_id, actor_id, 'active', target.created_by, now()
  )
  on conflict (organization_id, user_id) do update
  set status = 'active',
      invited_by = excluded.invited_by,
      joined_at = coalesce(public.organization_memberships.joined_at, now()),
      updated_at = now()
  returning id into claimed_membership_id;

  foreach requested_role in array target.roles
  loop
    insert into public.organization_member_roles (membership_id, role, assigned_by)
    values (claimed_membership_id, requested_role, target.created_by)
    on conflict (membership_id, role) do nothing;
  end loop;

  update public.academy_onboarding_invitations
  set status = 'accepted', accepted_by = actor_id, accepted_at = now()
  where id = target.id;

  insert into public.audit_events (
    organization_id, request_id, source, actor_user_id,
    entity_type, entity_id, action, after_data
  ) values (
    target.organization_id, gen_random_uuid(), 'application', actor_id,
    'academy_onboarding_invitation', target.id, 'onboarding.invitation_accepted',
    jsonb_build_object('user_id', actor_id, 'roles', target.roles)
  );

  return target.organization_id;
end;
$function$;

create function private.batch21_revoke_onboarding_invitation(
  p_organization_id uuid,
  p_invitation_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;
  if not (select private.phase_0b2_is_organization_manager(p_organization_id)) then
    raise insufficient_privilege using message = 'Organization administrator access required';
  end if;

  update public.academy_onboarding_invitations
  set status = 'revoked', revoked_at = now()
  where id = p_invitation_id
    and organization_id = p_organization_id
    and status = 'pending';
  if not found then
    raise no_data_found using message = 'Pending invitation not found';
  end if;

  insert into public.audit_events (
    organization_id, request_id, source, actor_user_id,
    entity_type, entity_id, action, after_data
  ) values (
    p_organization_id, gen_random_uuid(), 'application', actor_id,
    'academy_onboarding_invitation', p_invitation_id, 'onboarding.invitation_revoked',
    jsonb_build_object('status', 'revoked')
  );
end;
$function$;

create function private.batch21_close_onboarding_batch(
  p_organization_id uuid,
  p_batch_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := (select auth.uid());
  revoked_count integer;
begin
  if actor_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;
  if not (select private.phase_0b2_is_organization_manager(p_organization_id)) then
    raise insufficient_privilege using message = 'Organization administrator access required';
  end if;

  update public.academy_onboarding_batches
  set status = 'closed', closed_at = now()
  where id = p_batch_id and organization_id = p_organization_id and status = 'active';
  if not found then
    raise no_data_found using message = 'Active onboarding batch not found';
  end if;

  update public.academy_onboarding_invitations
  set status = 'revoked', revoked_at = now()
  where batch_id = p_batch_id and organization_id = p_organization_id and status = 'pending';
  get diagnostics revoked_count = row_count;

  insert into public.audit_events (
    organization_id, request_id, source, actor_user_id,
    entity_type, entity_id, action, after_data
  ) values (
    p_organization_id, gen_random_uuid(), 'application', actor_id,
    'academy_onboarding_batch', p_batch_id, 'onboarding.batch_closed',
    jsonb_build_object('revoked_pending_count', revoked_count)
  );

  return revoked_count;
end;
$function$;

-- Public SECURITY INVOKER wrappers are the only PostgREST entry points.
create function public.preview_academy_onboarding(p_organization_id uuid, p_entries jsonb)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.batch21_validate_onboarding_entries(p_organization_id, p_entries);
$function$;

create function public.create_academy_onboarding_batch(
  p_organization_id uuid,
  p_name text,
  p_entries jsonb,
  p_expires_in_days integer default 7
)
returns table (
  invitation_id uuid,
  email text,
  full_name text,
  roles text[],
  invite_token text,
  expires_at timestamptz
)
language sql
security invoker
set search_path = ''
as $function$
  select * from private.batch21_create_onboarding_batch(
    p_organization_id, p_name, p_entries, p_expires_in_days
  );
$function$;

create function public.get_academy_onboarding_batches(p_organization_id uuid)
returns table (
  id uuid,
  name text,
  status text,
  row_count integer,
  pending_count bigint,
  accepted_count bigint,
  revoked_count bigint,
  created_at timestamptz,
  closed_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select * from private.batch21_get_onboarding_batches(p_organization_id);
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
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select * from private.batch21_get_onboarding_invitations(p_organization_id, p_batch_id);
$function$;

create function public.claim_academy_onboarding_invitation(p_invite_token text)
returns uuid
language sql
security invoker
set search_path = ''
as $function$
  select private.batch21_claim_onboarding_invitation(p_invite_token);
$function$;

create function public.revoke_academy_onboarding_invitation(
  p_organization_id uuid,
  p_invitation_id uuid
)
returns void
language sql
security invoker
set search_path = ''
as $function$
  select private.batch21_revoke_onboarding_invitation(p_organization_id, p_invitation_id);
$function$;

create function public.close_academy_onboarding_batch(
  p_organization_id uuid,
  p_batch_id uuid
)
returns integer
language sql
security invoker
set search_path = ''
as $function$
  select private.batch21_close_onboarding_batch(p_organization_id, p_batch_id);
$function$;

revoke all on function private.batch21_validate_onboarding_entries(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.batch21_create_onboarding_batch(uuid, text, jsonb, integer) from public, anon, authenticated, service_role;
revoke all on function private.batch21_get_onboarding_batches(uuid) from public, anon, authenticated, service_role;
revoke all on function private.batch21_get_onboarding_invitations(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function private.batch21_claim_onboarding_invitation(text) from public, anon, authenticated, service_role;
revoke all on function private.batch21_revoke_onboarding_invitation(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function private.batch21_close_onboarding_batch(uuid, uuid) from public, anon, authenticated, service_role;

grant execute on function private.batch21_validate_onboarding_entries(uuid, jsonb) to authenticated;
grant execute on function private.batch21_create_onboarding_batch(uuid, text, jsonb, integer) to authenticated;
grant execute on function private.batch21_get_onboarding_batches(uuid) to authenticated;
grant execute on function private.batch21_get_onboarding_invitations(uuid, uuid) to authenticated;
grant execute on function private.batch21_claim_onboarding_invitation(text) to authenticated;
grant execute on function private.batch21_revoke_onboarding_invitation(uuid, uuid) to authenticated;
grant execute on function private.batch21_close_onboarding_batch(uuid, uuid) to authenticated;

revoke all on function public.preview_academy_onboarding(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.create_academy_onboarding_batch(uuid, text, jsonb, integer) from public, anon, authenticated, service_role;
revoke all on function public.get_academy_onboarding_batches(uuid) from public, anon, authenticated, service_role;
revoke all on function public.get_academy_onboarding_invitations(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.claim_academy_onboarding_invitation(text) from public, anon, authenticated, service_role;
revoke all on function public.revoke_academy_onboarding_invitation(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.close_academy_onboarding_batch(uuid, uuid) from public, anon, authenticated, service_role;

grant execute on function public.preview_academy_onboarding(uuid, jsonb) to authenticated;
grant execute on function public.create_academy_onboarding_batch(uuid, text, jsonb, integer) to authenticated;
grant execute on function public.get_academy_onboarding_batches(uuid) to authenticated;
grant execute on function public.get_academy_onboarding_invitations(uuid, uuid) to authenticated;
grant execute on function public.claim_academy_onboarding_invitation(text) to authenticated;
grant execute on function public.revoke_academy_onboarding_invitation(uuid, uuid) to authenticated;
grant execute on function public.close_academy_onboarding_batch(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
