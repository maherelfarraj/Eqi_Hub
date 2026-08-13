begin;

drop policy if exists documents_linked_guardian_select on public.documents;
drop policy if exists health_records_linked_guardian_select on public.health_records;
drop policy if exists training_log_linked_guardian_select on public.training_log;

drop policy if exists analyses_select_participant on public.video_analyses;
create policy analyses_select_participant on public.video_analyses for select to authenticated
using (
  rider_id = (select auth.uid())
  or exists (
    select 1 from public.lessons as lesson
    where lesson.analysis_id = video_analyses.id
      and lesson.trainer_id = (select auth.uid())
  )
);

drop policy if exists lessons_select on public.lessons;
create policy lessons_select on public.lessons for select to authenticated
using ((select auth.uid()) = rider_id or (select auth.uid()) = trainer_id);

drop policy if exists horse_riders_select on public.horse_riders;
create policy horse_riders_select on public.horse_riders for select to authenticated
using (rider_id = (select auth.uid()) or private.is_horse_owner(horse_id));

drop policy if exists horse_access_assignments_select_authorized
on public.horse_access_assignments;
create policy horse_access_assignments_select_authorized
on public.horse_access_assignments for select to authenticated
using (
  profile_id = (select auth.uid())
  or private.is_platform_admin()
  or private.has_organization_role(
    organization_id,
    array['academy_admin', 'stable_manager']
  )
);

drop policy if exists horses_select on public.horses;
create policy horses_select on public.horses for select to authenticated
using (owner_id = (select auth.uid()) or (select private.is_horse_rider(id)));

drop policy if exists profiles_select_authorized on public.profiles;
create policy profiles_select_authorized on public.profiles for select to authenticated
using ((select auth.uid()) = id or role = 'trainer');

create or replace function private.is_horse_rider(p_horse_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.horse_riders
    where horse_id = p_horse_id and rider_id = (select auth.uid())
  );
$$;

alter policy storage_user_read_own
on storage.objects
to authenticated
using ((storage.foldername(name))[1] = (select auth.uid())::text);

drop function if exists private.can_access_horse(uuid);
drop function if exists private.can_read_rider(uuid, uuid);

commit;
