begin;

create table public.academy_analysis_settings(
 academy_id uuid primary key references public.academies(id) on delete cascade,
 retention_days smallint not null default 90 check(retention_days between 7 and 365),
 abandoned_upload_hours smallint not null default 24 check(abandoned_upload_hours between 1 and 168),
 consent_version text not null default '2026-08' check(char_length(consent_version) between 3 and 40),
 updated_at timestamptz not null default now(), updated_by uuid references auth.users(id) on delete restrict
);
alter table public.academy_analysis_settings enable row level security;
create policy academy_analysis_settings_select_staff on public.academy_analysis_settings for select to authenticated using(private.has_academy_role(academy_id,array['academy_admin','coach']::public.app_role[]));
create policy academy_analysis_settings_admin_write on public.academy_analysis_settings for all to authenticated using(private.has_academy_role(academy_id,array['academy_admin']::public.app_role[])) with check(private.has_academy_role(academy_id,array['academy_admin']::public.app_role[]) and updated_by=(select auth.uid()));
revoke all on public.academy_analysis_settings from anon,authenticated;grant select,insert,update on public.academy_analysis_settings to authenticated;

alter table public.riding_video_analyses add column consent_confirmed_at timestamptz,add column consent_version text,add column retention_until timestamptz,add column deleted_at timestamptz,add column deleted_by uuid references auth.users(id) on delete restrict,add column deletion_reason text,add column media_probe jsonb;
alter table public.riding_video_analyses add constraint riding_analysis_consent_version check(consent_version is null or char_length(consent_version) between 3 and 40),add constraint riding_analysis_retention_after_request check(retention_until is null or retention_until>requested_at),add constraint riding_analysis_deletion_reason check(deletion_reason is null or char_length(deletion_reason) between 3 and 200);
create index riding_video_analyses_retention_idx on public.riding_video_analyses(retention_until) where deleted_at is null;

drop function public.request_riding_video_analysis(uuid,uuid,uuid,uuid,text);
create function public.request_riding_video_analysis(target_academy_id uuid,target_rider_user_id uuid,target_horse_id uuid,target_lesson_session_id uuid,target_object_path text,target_consent_version text,target_retention_days smallint) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=(select auth.uid());analysis_id uuid;lesson public.lesson_sessions%rowtype;settings public.academy_analysis_settings%rowtype;
begin
 if actor is null or not private.can_manage_riding_analysis(target_academy_id,target_rider_user_id) then raise exception 'Analysis intake access required' using errcode='42501';end if;
 if target_retention_days not between 7 and 365 or target_consent_version!~'^[A-Za-z0-9._-]{3,40}$' then raise exception 'Consent and retention required' using errcode='22023';end if;
 select * into settings from public.academy_analysis_settings where academy_id=target_academy_id;if settings.academy_id is null then insert into public.academy_analysis_settings(academy_id,updated_by) values(target_academy_id,actor) returning * into settings;end if;
 if target_consent_version<>settings.consent_version or target_retention_days>settings.retention_days then raise exception 'Academy retention or consent policy mismatch' using errcode='22023';end if;
 if not exists(select 1 from public.academy_memberships m where m.academy_id=target_academy_id and m.user_id=target_rider_user_id and m.role='rider' and m.status='active') or not exists(select 1 from public.horses h where h.id=target_horse_id and h.academy_id=target_academy_id and h.status<>'retired') then raise exception 'Rider or horse outside academy scope' using errcode='23514';end if;
 if target_lesson_session_id is not null then select * into lesson from public.lesson_sessions where id=target_lesson_session_id;if lesson.id is null or lesson.academy_id<>target_academy_id or lesson.rider_user_id<>target_rider_user_id or lesson.horse_id<>target_horse_id then raise exception 'Lesson does not match analysis scope' using errcode='23514';end if;end if;
 if target_object_path!~('^'||target_academy_id::text||'/'||actor::text||'/[0-9a-f-]+\.(mp4|mov|webm)$') then raise exception 'Invalid private video path' using errcode='22023';end if;
 insert into public.riding_video_analyses(academy_id,lesson_session_id,rider_user_id,horse_id,uploaded_by,object_path,status,consent_confirmed_at,consent_version,retention_until) values(target_academy_id,target_lesson_session_id,target_rider_user_id,target_horse_id,actor,target_object_path,'queued',now(),target_consent_version,now()+make_interval(days=>target_retention_days)) returning id into analysis_id;
 perform public.write_audit_event(target_academy_id,'riding_analysis.requested','riding_video_analysis',analysis_id,jsonb_build_object('rider_user_id',target_rider_user_id,'horse_id',target_horse_id,'consent_version',target_consent_version,'retention_days',target_retention_days));return analysis_id;
end;$$;

create function public.list_riding_video_cleanup_candidates(target_limit integer default 100) returns table(analysis_id uuid,object_path text,reason text) language sql security definer set search_path='' as $$
 select a.id,a.object_path,'retention_expired'::text from public.riding_video_analyses a where a.deleted_at is null and a.retention_until<now() order by a.retention_until limit least(greatest(target_limit,1),1000);
$$;
create function public.list_abandoned_riding_uploads(target_cutoff timestamptz,target_limit integer default 100) returns table(object_path text) language sql security definer set search_path='' as $$
 select o.name from storage.objects o where o.bucket_id='riding-analysis-videos' and o.created_at<least(target_cutoff,now()-interval '1 hour') and not exists(select 1 from public.riding_video_analyses a where a.object_path=o.name) order by o.created_at limit least(greatest(target_limit,1),1000);
$$;
create function public.record_riding_video_deleted(target_analysis_id uuid,target_reason text) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=(select auth.uid());scoped public.riding_video_analyses%rowtype;
begin select * into scoped from public.riding_video_analyses where id=target_analysis_id for update;if scoped.id is null then return false;end if;if current_user not in('postgres','service_role') and (actor is null or not private.has_academy_role(scoped.academy_id,array['academy_admin']::public.app_role[])) then raise exception 'Academy administrator required' using errcode='42501';end if;if target_reason!~'^[a-z_]{3,80}$' then raise exception 'Invalid deletion reason' using errcode='22023';end if;update public.riding_video_analyses set deleted_at=now(),deleted_by=actor,deletion_reason=target_reason,updated_at=now() where id=scoped.id;perform public.write_audit_event(scoped.academy_id,'riding_analysis.video_deleted','riding_video_analysis',scoped.id,jsonb_build_object('reason',target_reason));return true;end;$$;
drop function public.complete_riding_analysis_job(uuid,text,jsonb);
create function public.complete_riding_analysis_job(target_analysis_id uuid,worker_id text,result_metrics jsonb,result_media_probe jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare scoped public.riding_video_analyses%rowtype;
begin if current_user not in('postgres','service_role') then raise exception 'Worker access required' using errcode='42501';end if;if jsonb_typeof(result_metrics)<>'object' or not(result_metrics?&array['posture_score','rhythm_score','symmetry_score','gait_confidence']) or exists(select 1 from jsonb_each(result_metrics)e where e.key in('posture_score','rhythm_score','symmetry_score','gait_confidence') and(jsonb_typeof(e.value)<>'number' or(e.value#>>'{}')::numeric not between 0 and 100)) then raise exception 'Invalid analysis metrics' using errcode='22023';end if;if jsonb_typeof(result_media_probe)<>'object' or not(result_media_probe?&array['format_name','duration_seconds','video_codec','width','height']) then raise exception 'Validated media probe required' using errcode='22023';end if;select * into scoped from public.riding_video_analyses where id=target_analysis_id for update;if scoped.status<>'processing' or scoped.claimed_by<>worker_id then raise exception 'Job claim does not match' using errcode='42501';end if;update public.riding_video_analyses set status='review_required',metrics=result_metrics,media_probe=result_media_probe,completed_at=now(),last_heartbeat_at=now(),updated_at=now() where id=target_analysis_id;perform public.write_audit_event(scoped.academy_id,'riding_analysis.processed','riding_video_analysis',scoped.id,jsonb_build_object('pipeline_version',scoped.pipeline_version));return true;end;$$;

create policy riding_analysis_video_delete_admins on storage.objects for delete to authenticated using(bucket_id='riding-analysis-videos' and case when split_part(name,'/',1)~'^[0-9a-f-]{36}$' then private.has_academy_role(split_part(name,'/',1)::uuid,array['academy_admin']::public.app_role[]) else false end);
revoke all on function public.request_riding_video_analysis(uuid,uuid,uuid,uuid,text,text,smallint),public.list_riding_video_cleanup_candidates(integer),public.list_abandoned_riding_uploads(timestamptz,integer),public.record_riding_video_deleted(uuid,text),public.complete_riding_analysis_job(uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.request_riding_video_analysis(uuid,uuid,uuid,uuid,text,text,smallint),public.record_riding_video_deleted(uuid,text) to authenticated;
grant execute on function public.list_riding_video_cleanup_candidates(integer),public.list_abandoned_riding_uploads(timestamptz,integer),public.record_riding_video_deleted(uuid,text),public.complete_riding_analysis_job(uuid,text,jsonb,jsonb) to service_role;
commit;
