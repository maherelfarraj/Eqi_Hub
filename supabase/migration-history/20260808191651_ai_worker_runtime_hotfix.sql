begin;

create function private.write_worker_audit_event(
  target_academy_id uuid,
  target_actor_user_id uuid,
  event_action text,
  event_entity_type text,
  event_entity_id uuid,
  event_metadata jsonb default '{}'::jsonb
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare audit_id bigint;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'Worker access required' using errcode = '42501';
  end if;
  if target_academy_id is null or target_actor_user_id is null then
    raise exception 'Worker audit scope required' using errcode = '22023';
  end if;
  if jsonb_typeof(event_metadata) <> 'object' then
    raise exception 'Audit metadata must be an object' using errcode = '22023';
  end if;
  insert into public.audit_events(academy_id, actor_user_id, action, entity_type, entity_id, metadata)
  values(target_academy_id, target_actor_user_id, event_action, event_entity_type, event_entity_id, event_metadata)
  returning id into audit_id;
  return audit_id;
end;
$$;

create or replace function public.complete_riding_analysis_job(target_analysis_id uuid, worker_id text, result_metrics jsonb, result_media_probe jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare scoped public.riding_video_analyses%rowtype;
begin
  if current_user not in ('postgres', 'service_role') then raise exception 'Worker access required' using errcode='42501'; end if;
  if jsonb_typeof(result_metrics)<>'object' or not(result_metrics?&array['posture_score','rhythm_score','symmetry_score','gait_confidence']) or exists(select 1 from jsonb_each(result_metrics)e where e.key in('posture_score','rhythm_score','symmetry_score','gait_confidence') and(jsonb_typeof(e.value)<>'number' or(e.value#>>'{}')::numeric not between 0 and 100)) then raise exception 'Invalid analysis metrics' using errcode='22023'; end if;
  if jsonb_typeof(result_media_probe)<>'object' or not(result_media_probe?&array['format_name','duration_seconds','video_codec','width','height']) then raise exception 'Validated media probe required' using errcode='22023'; end if;
  select * into scoped from public.riding_video_analyses where id=target_analysis_id for update;
  if scoped.id is null or scoped.status<>'processing' or scoped.claimed_by<>worker_id then raise exception 'Job claim does not match' using errcode='42501'; end if;
  update public.riding_video_analyses set status='review_required',metrics=result_metrics,media_probe=result_media_probe,completed_at=now(),last_heartbeat_at=now(),updated_at=now() where id=target_analysis_id;
  perform private.write_worker_audit_event(scoped.academy_id,scoped.uploaded_by,'riding_analysis.processed','riding_video_analysis',scoped.id,jsonb_build_object('pipeline_version',scoped.pipeline_version,'worker_id',worker_id));
  return true;
end;
$$;

create or replace function public.fail_riding_analysis_job(target_analysis_id uuid,worker_id text,target_failure_code text,retryable boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare scoped public.riding_video_analyses%rowtype;next_status public.riding_analysis_status;
begin
  if current_user not in('postgres','service_role') then raise exception 'Worker access required' using errcode='42501'; end if;
  select * into scoped from public.riding_video_analyses where id=target_analysis_id for update;
  if scoped.id is null or scoped.status<>'processing' or scoped.claimed_by<>worker_id or target_failure_code!~'^[a-z0-9_]{3,80}$' then raise exception 'Invalid job failure' using errcode='22023'; end if;
  next_status:=case when retryable and scoped.processing_attempts<10 then 'queued'::public.riding_analysis_status else 'failed'::public.riding_analysis_status end;
  update public.riding_video_analyses set status=next_status,failure_code=target_failure_code,claimed_by=case when next_status='queued' then null else claimed_by end,updated_at=now() where id=target_analysis_id;
  perform private.write_worker_audit_event(scoped.academy_id,scoped.uploaded_by,'riding_analysis.'||next_status::text,'riding_video_analysis',scoped.id,jsonb_build_object('failure_code',target_failure_code,'retryable',retryable,'worker_id',worker_id));
  return true;
end;
$$;

create or replace function public.record_riding_video_deleted(target_analysis_id uuid,target_reason text) returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid:=(select auth.uid());scoped public.riding_video_analyses%rowtype;
begin
  select * into scoped from public.riding_video_analyses where id=target_analysis_id for update;
  if scoped.id is null then return false; end if;
  if current_user not in('postgres','service_role') and (actor is null or not private.has_academy_role(scoped.academy_id,array['academy_admin']::public.app_role[])) then raise exception 'Academy administrator required' using errcode='42501'; end if;
  if target_reason!~'^[a-z_]{3,80}$' then raise exception 'Invalid deletion reason' using errcode='22023'; end if;
  update public.riding_video_analyses set deleted_at=now(),deleted_by=actor,deletion_reason=target_reason,updated_at=now() where id=scoped.id;
  if current_user in('postgres','service_role') then
    perform private.write_worker_audit_event(scoped.academy_id,scoped.uploaded_by,'riding_analysis.video_deleted','riding_video_analysis',scoped.id,jsonb_build_object('reason',target_reason,'source','retention_worker'));
  else
    perform public.write_audit_event(scoped.academy_id,'riding_analysis.video_deleted','riding_video_analysis',scoped.id,jsonb_build_object('reason',target_reason));
  end if;
  return true;
end;
$$;

revoke all on function private.write_worker_audit_event(uuid,uuid,text,text,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.complete_riding_analysis_job(uuid,text,jsonb,jsonb),public.fail_riding_analysis_job(uuid,text,text,boolean),public.record_riding_video_deleted(uuid,text) from public,anon,authenticated;
grant execute on function public.complete_riding_analysis_job(uuid,text,jsonb,jsonb),public.fail_riding_analysis_job(uuid,text,text,boolean),public.record_riding_video_deleted(uuid,text) to service_role;
grant execute on function public.record_riding_video_deleted(uuid,text) to authenticated;

commit;
