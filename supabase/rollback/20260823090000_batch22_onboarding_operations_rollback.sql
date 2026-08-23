-- Roll back Batch 22 while preserving all Batch 21 batches and invitations.

begin;

drop function if exists public.reissue_academy_onboarding_invitation(uuid, uuid, text);
drop function if exists public.get_academy_onboarding_activity(uuid, integer);
drop function if exists public.get_academy_onboarding_metrics(uuid);
drop function if exists public.get_academy_onboarding_invitations(uuid, uuid);

drop function if exists private.batch22_reissue_onboarding_invitation(uuid, uuid, text);
drop function if exists private.batch22_get_onboarding_activity(uuid, integer);
drop function if exists private.batch22_get_onboarding_metrics(uuid);
drop function if exists private.batch21_get_onboarding_invitations(uuid, uuid);

drop index if exists public.academy_onboarding_invitations_last_reissued_by_idx;

alter table public.academy_onboarding_invitations
  drop constraint if exists academy_onboarding_invitations_reissue_state_check,
  drop constraint if exists academy_onboarding_invitations_reissue_count_check,
  drop column if exists last_reissued_by,
  drop column if exists last_reissued_at,
  drop column if exists reissue_count;

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

revoke all on function private.batch21_get_onboarding_invitations(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function private.batch21_get_onboarding_invitations(uuid, uuid) to authenticated;

revoke all on function public.get_academy_onboarding_invitations(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_academy_onboarding_invitations(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
