-- Phase 0B.2 rollback removes the operational RPC boundary only.
-- It preserves every organization, membership, role, and audit row.

begin;

do $preflight$
begin
  if to_regprocedure('public.get_organization_members(uuid)') is null
     or to_regprocedure('private.phase_0b2_manage_organization_member(uuid,text,text,text[])') is null then
    raise exception 'Phase 0B.2 rollback preflight failed: forward state not found';
  end if;
end
$preflight$;

drop function public.update_organization_name(uuid, text);
drop function public.manage_organization_member(uuid, text, text, text[]);
drop function public.create_organization(text, text, text);
drop function public.get_organization_members(uuid);

drop function private.phase_0b2_update_organization_name(uuid, text);
drop function private.phase_0b2_manage_organization_member(uuid, text, text, text[]);
drop function private.phase_0b2_create_organization(text, text, text);
drop function private.phase_0b2_get_organization_members(uuid);
drop function private.phase_0b2_is_organization_manager(uuid);

drop index if exists public.horse_access_assignments_horse_organization_idx;

notify pgrst, 'reload schema';

commit;
