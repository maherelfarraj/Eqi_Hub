begin;

create function private.valid_riding_analysis_timeline(target_metrics jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare event jsonb;point jsonb;start_value numeric;peak_value numeric;end_value numeric;coordinate numeric;
begin
 if jsonb_typeof(target_metrics->'timeline')<>'array' or jsonb_array_length(target_metrics->'timeline')>100 then return false;end if;
 for event in select value from jsonb_array_elements(target_metrics->'timeline')loop
  if jsonb_typeof(event)<>'object' or not(event?&array['code','title','severity','confidence','start_seconds','peak_seconds','end_seconds','frame_index','overlay']) or event->>'severity'not in('high','moderate','low') or jsonb_typeof(event->'confidence')<>'number' or jsonb_typeof(event->'start_seconds')<>'number' or jsonb_typeof(event->'peak_seconds')<>'number' or jsonb_typeof(event->'end_seconds')<>'number' or jsonb_typeof(event->'frame_index')<>'number' or jsonb_typeof(event->'overlay')<>'object' or jsonb_typeof(event->'overlay'->'points')<>'array' or jsonb_array_length(event->'overlay'->'points')not between 4 and 16 then return false;end if;
  start_value:=(event->>'start_seconds')::numeric;peak_value:=(event->>'peak_seconds')::numeric;end_value:=(event->>'end_seconds')::numeric;
  if start_value<0 or peak_value<start_value or end_value<peak_value or end_value-start_value>5 or(event->>'confidence')::numeric not between 0 and 100 or(event->>'frame_index')::numeric<0 or char_length(event->>'code')not between 3 and 80 or char_length(event->>'title')not between 5 and 180 then return false;end if;
  for point in select value from jsonb_array_elements(event->'overlay'->'points')loop
   if jsonb_typeof(point)<>'object' or not(point?&array['name','x','y']) or jsonb_typeof(point->'x')<>'number' or jsonb_typeof(point->'y')<>'number' or(point?'visibility'and jsonb_typeof(point->'visibility')<>'number')then return false;end if;
   coordinate:=(point->>'x')::numeric;if coordinate not between 0 and 1 then return false;end if;coordinate:=(point->>'y')::numeric;if coordinate not between 0 and 1 then return false;end if;
   if point?'visibility'and(point->>'visibility')::numeric not between 0 and 1 then return false;end if;
  end loop;
 end loop;
 return true;
exception when others then return false;
end;$$;

create or replace function public.complete_riding_analysis_job(target_analysis_id uuid,worker_id text,result_metrics jsonb,result_media_probe jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare scoped public.riding_video_analyses%rowtype;
begin
 if current_user not in('postgres','service_role')then raise exception 'Worker access required' using errcode='42501';end if;
 if jsonb_typeof(result_metrics)<>'object' or not(result_metrics?&array['posture_score','rhythm_score','symmetry_score','gait_confidence']) or exists(select 1 from jsonb_each(result_metrics)e where e.key in('posture_score','rhythm_score','symmetry_score','gait_confidence')and(jsonb_typeof(e.value)<>'number'or(e.value#>>'{}')::numeric not between 0 and 100))then raise exception 'Invalid analysis metrics' using errcode='22023';end if;
 if result_metrics?'timeline'and not private.valid_riding_analysis_timeline(result_metrics)then raise exception 'Invalid timestamped analysis evidence' using errcode='22023';end if;
 if jsonb_typeof(result_media_probe)<>'object' or not(result_media_probe?&array['format_name','duration_seconds','video_codec','width','height'])then raise exception 'Validated media probe required' using errcode='22023';end if;
 select*into scoped from public.riding_video_analyses where id=target_analysis_id for update;
 if scoped.id is null or scoped.status<>'processing'or scoped.claimed_by<>worker_id then raise exception 'Job claim does not match' using errcode='42501';end if;
 update public.riding_video_analyses set status='review_required',metrics=result_metrics,media_probe=result_media_probe,completed_at=now(),last_heartbeat_at=now(),updated_at=now()where id=target_analysis_id;
 perform private.write_worker_audit_event(scoped.academy_id,scoped.uploaded_by,'riding_analysis.processed','riding_video_analysis',scoped.id,jsonb_build_object('pipeline_version',scoped.pipeline_version,'worker_id',worker_id,'timestamped_findings',coalesce(jsonb_array_length(result_metrics->'timeline'),0)));
 return true;
end;$$;

create policy riding_analysis_video_select_approved on storage.objects for select to authenticated using(
 bucket_id='riding-analysis-videos'and exists(select 1 from public.riding_video_analyses analysis where analysis.object_path=name and analysis.deleted_at is null and analysis.status='approved'and private.can_view_approved_riding_analysis(analysis.academy_id,analysis.rider_user_id))
);

revoke all on function private.valid_riding_analysis_timeline(jsonb)from public,anon,authenticated;
revoke all on function public.complete_riding_analysis_job(uuid,text,jsonb,jsonb)from public,anon,authenticated;
grant execute on function public.complete_riding_analysis_job(uuid,text,jsonb,jsonb)to service_role;

commit;
