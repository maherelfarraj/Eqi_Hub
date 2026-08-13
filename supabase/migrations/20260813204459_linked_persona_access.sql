-- Phase 1 Stage 4: make organization relationships authoritative for linked
-- rider and horse read access. Guardian access remains read-only.
begin;

create or replace function private.can_read_rider(
  p_organization_id uuid,
  p_rider_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_rider_id = (select auth.uid())
    or exists (
      select 1
      from public.guardian_riders as link
      where link.organization_id = p_organization_id
        and link.guardian_id = (select auth.uid())
        and link.rider_id = p_rider_id
        and link.active
    )
    or private.is_platform_admin()
    or private.has_organization_role(
      p_organization_id,
      array['academy_admin', 'stable_manager']
    );
$$;

create or replace function private.can_access_horse(p_horse_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.horses as horse
    where horse.id = p_horse_id
      and (
        horse.owner_id = (select auth.uid())
        or exists (
          select 1
          from public.horse_access_assignments as access
          where access.organization_id = horse.organization_id
            and access.horse_id = horse.id
            and access.active
            and (
              access.profile_id = (select auth.uid())
              or private.can_read_rider(
                access.organization_id,
                access.profile_id
              )
            )
        )
        or exists (
          select 1
          from public.horse_riders as legacy_access
          where legacy_access.horse_id = horse.id
            and (
              legacy_access.rider_id = (select auth.uid())
              or private.can_read_rider(
                horse.organization_id,
                legacy_access.rider_id
              )
            )
        )
      )
  );
$$;

-- Preserve the legacy helper API for existing policies while using the
-- canonical assignment table as the primary source.
create or replace function private.is_horse_rider(p_horse_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_access_horse(p_horse_id);
$$;

revoke all on function private.can_read_rider(uuid, uuid) from public, anon;
revoke all on function private.can_access_horse(uuid) from public, anon;
revoke all on function private.is_horse_rider(uuid) from public, anon;
grant execute on function private.can_read_rider(uuid, uuid) to authenticated;
grant execute on function private.can_access_horse(uuid) to authenticated;
grant execute on function private.is_horse_rider(uuid) to authenticated;

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

drop policy if exists horses_select on public.horses;
create policy horses_select
on public.horses for select to authenticated
using ((select private.can_access_horse(horses.id)));

drop policy if exists horse_riders_select on public.horse_riders;
create policy horse_riders_select
on public.horse_riders for select to authenticated
using ((select private.can_access_horse(horse_riders.horse_id)));

drop policy if exists horse_access_assignments_select_authorized
on public.horse_access_assignments;
create policy horse_access_assignments_select_authorized
on public.horse_access_assignments for select to authenticated
using (
  profile_id = (select auth.uid())
  or private.can_read_rider(organization_id, profile_id)
  or private.is_platform_admin()
  or private.has_organization_role(
    organization_id,
    array['academy_admin', 'stable_manager']
  )
);

drop policy if exists lessons_select on public.lessons;
create policy lessons_select
on public.lessons for select to authenticated
using (
  rider_id = (select auth.uid())
  or trainer_id = (select auth.uid())
  or private.can_read_rider(organization_id, rider_id)
);

drop policy if exists analyses_select_participant on public.video_analyses;
create policy analyses_select_participant
on public.video_analyses for select to authenticated
using (
  private.can_read_rider(organization_id, rider_id)
  or exists (
    select 1
    from public.lessons as lesson
    where lesson.analysis_id = video_analyses.id
      and lesson.trainer_id = (select auth.uid())
  )
);

create policy training_log_linked_guardian_select
on public.training_log for select to authenticated
using ((select private.can_access_horse(training_log.horse_id)));

create policy health_records_linked_guardian_select
on public.health_records for select to authenticated
using ((select private.can_access_horse(health_records.horse_id)));

create policy documents_linked_guardian_select
on public.documents for select to authenticated
using (
  horse_id is not null
  and (select private.can_access_horse(documents.horse_id))
);

alter policy storage_user_read_own
on storage.objects
to authenticated
using (
  (storage.foldername(name))[1] = (select auth.uid())::text
  or (
    bucket_id in ('videos', 'riding-analysis-videos')
    and exists (
      select 1
      from public.guardian_riders as link
      where link.guardian_id = (select auth.uid())
        and link.rider_id::text = (storage.foldername(name))[1]
        and link.active
        and private.can_read_rider(link.organization_id, link.rider_id)
    )
  )
);

commit;
