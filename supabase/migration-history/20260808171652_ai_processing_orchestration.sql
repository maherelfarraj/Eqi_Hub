begin;
alter table public.riding_video_analyses add column processing_attempts smallint not null default 0, add column claimed_by text, add column last_heartbeat_at timestamptz;
alter table public.riding_video_analyses add constraint riding_analysis_attempts_range check(processing_attempts between 0 and 10), add constraint riding_analysis_worker_length check(claimed_by is null or char_length(claimed_by) between 3 and 120);

create function public.claim_riding_analysis_job(worker_id text,worker_pipeline_version text) returns public.riding_video_analyses language plpgsql security definer set search_path='' as $$
declare job public.riding_video_analyses%rowtype;
begin
 if current_user not in('postgres','service_role') then raise exception 'Worker access required' using errcode='42501'; end if;
 if char_length(worker_id) not between 3 and 120 or char_length(worker_pipeline_version) not between 3 and 80 then raise exception 'Invalid worker identity' using errcode='22023'; end if;
 select * into job from public.riding_video_analyses where status='queued' and processing_attempts<10 order by requested_at for update skip locked limit 1;
 if job.id is null then return null; end if;
 update public.riding_video_analyses set status='processing',processing_attempts=processing_attempts+1,claimed_by=worker_id,pipeline_version=worker_pipeline_version,processing_started_at=now(),last_heartbeat_at=now(),failure_code=null,updated_at=now() where id=job.id returning * into job;return job;
end;$$;

create function public.heartbeat_riding_analysis_job(target_analysis_id uuid,worker_id text) returns boolean language plpgsql security definer set search_path='' as $$
begin if current_user not in('postgres','service_role') then raise exception 'Worker access required' using errcode='42501'; end if;update public.riding_video_analyses set last_heartbeat_at=now(),updated_at=now() where id=target_analysis_id and status='processing' and claimed_by=worker_id;return found;end;$$;

create function public.complete_riding_analysis_job(target_analysis_id uuid,worker_id text,result_metrics jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare scoped public.riding_video_analyses%rowtype;
begin
 if current_user not in('postgres','service_role') then raise exception 'Worker access required' using errcode='42501'; end if;
 if jsonb_typeof(result_metrics)<>'object' or not(result_metrics ?& array['posture_score','rhythm_score','symmetry_score','gait_confidence']) or exists(select 1 from jsonb_each(result_metrics) e where e.key in('posture_score','rhythm_score','symmetry_score','gait_confidence') and (jsonb_typeof(e.value)<>'number' or (e.value#>>'{}')::numeric not between 0 and 100)) then raise exception 'Invalid analysis metrics' using errcode='22023'; end if;
 select * into scoped from public.riding_video_analyses where id=target_analysis_id for update;if scoped.status<>'processing' or scoped.claimed_by<>worker_id then raise exception 'Job claim does not match' using errcode='42501'; end if;
 update public.riding_video_analyses set status='review_required',metrics=result_metrics,completed_at=now(),last_heartbeat_at=now(),updated_at=now() where id=target_analysis_id;
 perform public.write_audit_event(scoped.academy_id,'riding_analysis.processed','riding_video_analysis',scoped.id,jsonb_build_object('pipeline_version',scoped.pipeline_version));return true;
end;$$;

create function public.fail_riding_analysis_job(target_analysis_id uuid,worker_id text,target_failure_code text,retryable boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare scoped public.riding_video_analyses%rowtype;next_status public.riding_analysis_status;
begin
 if current_user not in('postgres','service_role') then raise exception 'Worker access required' using errcode='42501'; end if;
 select * into scoped from public.riding_video_analyses where id=target_analysis_id for update;if scoped.status<>'processing' or scoped.claimed_by<>worker_id or target_failure_code!~'^[a-z0-9_]{3,80}$' then raise exception 'Invalid job failure' using errcode='22023'; end if;
 next_status:=case when retryable and scoped.processing_attempts<10 then 'queued'::public.riding_analysis_status else 'failed'::public.riding_analysis_status end;
 update public.riding_video_analyses set status=next_status,failure_code=target_failure_code,claimed_by=case when next_status='queued' then null else claimed_by end,updated_at=now() where id=target_analysis_id;
 perform public.write_audit_event(scoped.academy_id,'riding_analysis.'||next_status::text,'riding_video_analysis',scoped.id,jsonb_build_object('failure_code',target_failure_code,'retryable',retryable));return true;
end;$$;

revoke all on function public.claim_riding_analysis_job(text,text),public.heartbeat_riding_analysis_job(uuid,text),public.complete_riding_analysis_job(uuid,text,jsonb),public.fail_riding_analysis_job(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.claim_riding_analysis_job(text,text),public.heartbeat_riding_analysis_job(uuid,text),public.complete_riding_analysis_job(uuid,text,jsonb),public.fail_riding_analysis_job(uuid,text,text,boolean) to service_role;
commit;
