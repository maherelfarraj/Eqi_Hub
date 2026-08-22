-- Batch 21 corrective migration: authorize invitation claims with the signed
-- Supabase Auth email claim rather than the user-editable profile email.

begin;

do $preflight$
begin
  if to_regprocedure('private.batch21_claim_onboarding_invitation(text)') is null
     or to_regclass('public.academy_onboarding_invitations') is null
     or to_regprocedure('extensions.digest(text,text)') is null then
    raise exception 'Batch 21 authenticated-email correction requires the onboarding migration';
  end if;
end
$preflight$;

create or replace function private.batch21_claim_onboarding_invitation(p_invite_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := (select auth.uid());
  actor_email text := lower(btrim(coalesce((select auth.jwt() ->> 'email'), '')));
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

  if actor_email = '' then
    raise insufficient_privilege using message = 'A verified Auth email is required';
  end if;
  if not exists (select 1 from public.profiles where id = actor_id) then
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

revoke all on function private.batch21_claim_onboarding_invitation(text)
from public, anon, authenticated, service_role;
grant execute on function private.batch21_claim_onboarding_invitation(text) to authenticated;

notify pgrst, 'reload schema';

commit;
