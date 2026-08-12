begin;

create or replace function private.can_manage_riding_analysis(
  target_academy_id uuid,
  target_rider_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_administrator()
    or private.has_academy_role(
      target_academy_id,
      array['academy_admin']::public.app_role[]
    )
    or (
      private.has_academy_role(
        target_academy_id,
        array['coach']::public.app_role[]
      )
      and exists (
        select 1
        from public.coach_rider_assignments assignment
        where assignment.academy_id = target_academy_id
          and assignment.coach_user_id = (select auth.uid())
          and assignment.rider_user_id = target_rider_id
      )
    );
$$;

drop policy if exists riding_analysis_video_insert_staff on storage.objects;
create policy riding_analysis_video_insert_staff
on storage.objects for insert to authenticated
with check (
  bucket_id = 'riding-analysis-videos'
  and owner_id = (select auth.uid()::text)
  and split_part(name, '/', 2) = (select auth.uid()::text)
  and case
    when split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then private.is_platform_administrator()
        or private.has_academy_role(
          split_part(name, '/', 1)::uuid,
          array['academy_admin','coach']::public.app_role[]
        )
    else false
  end
);

drop policy if exists riding_analysis_video_select_staff on storage.objects;
create policy riding_analysis_video_select_staff
on storage.objects for select to authenticated
using (
  bucket_id = 'riding-analysis-videos'
  and case
    when split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then private.is_platform_administrator()
        or private.has_academy_role(
          split_part(name, '/', 1)::uuid,
          array['academy_admin','coach']::public.app_role[]
        )
    else false
  end
);

drop policy if exists riding_analysis_video_delete_admins on storage.objects;
create policy riding_analysis_video_delete_admins
on storage.objects for delete to authenticated
using (
  bucket_id = 'riding-analysis-videos'
  and case
    when split_part(name, '/', 1) ~ '^[0-9a-f-]{36}$'
      then private.is_platform_administrator()
        or private.has_academy_role(
          split_part(name, '/', 1)::uuid,
          array['academy_admin']::public.app_role[]
        )
    else false
  end
);

create or replace function public.retry_failed_riding_analysis(target_analysis_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  scoped public.riding_video_analyses%rowtype;
begin
  if actor is null or not private.is_platform_administrator() then
    raise exception 'platform administrator access required' using errcode = '42501';
  end if;

  select * into scoped
  from public.riding_video_analyses
  where id = target_analysis_id
  for update;

  if scoped.id is null or scoped.status <> 'failed' or scoped.deleted_at is not null then
    raise exception 'analysis is not available for retry' using errcode = '22023';
  end if;

  update public.riding_video_analyses
  set status = 'queued',
      processing_attempts = 0,
      claimed_by = null,
      processing_started_at = null,
      last_heartbeat_at = null,
      failure_code = null,
      updated_at = now()
  where id = target_analysis_id;

  perform public.write_audit_event(
    scoped.academy_id,
    'riding_analysis.retry_requested',
    'riding_video_analysis',
    scoped.id,
    jsonb_build_object('previous_failure_code', scoped.failure_code)
  );

  return true;
end;
$$;

revoke all on function public.retry_failed_riding_analysis(uuid) from public, anon;
grant execute on function public.retry_failed_riding_analysis(uuid) to authenticated;

commit;
