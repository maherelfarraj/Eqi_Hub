-- Restore the Phase 1 Stage 4 profile read policy.
begin;

drop policy if exists profiles_select_authorized on public.profiles;
create policy profiles_select_authorized
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or role = 'trainer'
  or exists (
    select 1
    from public.guardian_riders as link
    where link.rider_id = profiles.id
      and link.guardian_id = (select auth.uid())
      and link.active
      and private.can_read_rider(link.organization_id, profiles.id)
  )
);

commit;
