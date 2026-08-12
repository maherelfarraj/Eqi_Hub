begin;
create type public.riding_analysis_status as enum ('uploaded','queued','processing','review_required','approved','rejected','failed');
create table public.riding_video_analyses (
 id uuid primary key default gen_random_uuid(), academy_id uuid not null references public.academies(id) on delete cascade,
 lesson_session_id uuid references public.lesson_sessions(id) on delete set null, rider_user_id uuid not null references auth.users(id) on delete restrict,
 horse_id uuid not null references public.horses(id) on delete restrict, uploaded_by uuid not null references auth.users(id) on delete restrict,
 object_path text not null unique, status public.riding_analysis_status not null default 'uploaded', pipeline_version text, metrics jsonb,
 coach_feedback text, failure_code text, requested_at timestamptz not null default now(), processing_started_at timestamptz,
 completed_at timestamptz, reviewed_at timestamptz, reviewed_by uuid references auth.users(id) on delete restrict, updated_at timestamptz not null default now(),
 constraint riding_analysis_object_path_length check(char_length(object_path) between 20 and 500),
 constraint riding_analysis_metrics_object check(metrics is null or jsonb_typeof(metrics)='object'),
 constraint riding_analysis_feedback_length check(coach_feedback is null or char_length(btrim(coach_feedback)) between 3 and 2000)
);
create index riding_video_analyses_academy_requested_idx on public.riding_video_analyses(academy_id,requested_at desc);
create index riding_video_analyses_rider_requested_idx on public.riding_video_analyses(rider_user_id,requested_at desc);
create index riding_video_analyses_queue_idx on public.riding_video_analyses(status,requested_at) where status in ('uploaded','queued','processing','review_required');

create function private.can_manage_riding_analysis(target_academy_id uuid,target_rider_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.has_academy_role(target_academy_id,array['academy_admin']::public.app_role[]) or (
  private.has_academy_role(target_academy_id,array['coach']::public.app_role[]) and exists(select 1 from public.coach_rider_assignments a where a.academy_id=target_academy_id and a.coach_user_id=(select auth.uid()) and a.rider_user_id=target_rider_id));
$$;
create function private.can_view_approved_riding_analysis(target_academy_id uuid,target_rider_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select target_rider_id=(select auth.uid()) or exists(select 1 from public.parent_rider_links l where l.academy_id=target_academy_id and l.parent_user_id=(select auth.uid()) and l.rider_user_id=target_rider_id);
$$;
alter table public.riding_video_analyses enable row level security;
create policy riding_video_analyses_select_scoped on public.riding_video_analyses for select to authenticated using(private.can_manage_riding_analysis(academy_id,rider_user_id) or (status='approved' and private.can_view_approved_riding_analysis(academy_id,rider_user_id)));

create function public.request_riding_video_analysis(target_academy_id uuid,target_rider_user_id uuid,target_horse_id uuid,target_lesson_session_id uuid,target_object_path text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=(select auth.uid()); analysis_id uuid; lesson public.lesson_sessions%rowtype;
begin
 if actor is null or not private.can_manage_riding_analysis(target_academy_id,target_rider_user_id) then raise exception 'Analysis intake access required' using errcode='42501'; end if;
 if not exists(select 1 from public.academy_memberships m where m.academy_id=target_academy_id and m.user_id=target_rider_user_id and m.role='rider' and m.status='active') or not exists(select 1 from public.horses h where h.id=target_horse_id and h.academy_id=target_academy_id and h.status<>'retired') then raise exception 'Rider or horse is outside academy scope' using errcode='23514'; end if;
 if target_lesson_session_id is not null then select * into lesson from public.lesson_sessions where id=target_lesson_session_id; if lesson.id is null or lesson.academy_id<>target_academy_id or lesson.rider_user_id<>target_rider_user_id or lesson.horse_id<>target_horse_id then raise exception 'Lesson does not match analysis scope' using errcode='23514'; end if; end if;
 if target_object_path !~ ('^'||target_academy_id::text||'/'||actor::text||'/[0-9a-f-]+\.(mp4|mov|webm)$') then raise exception 'Invalid private video path' using errcode='22023'; end if;
 insert into public.riding_video_analyses(academy_id,lesson_session_id,rider_user_id,horse_id,uploaded_by,object_path,status) values(target_academy_id,target_lesson_session_id,target_rider_user_id,target_horse_id,actor,target_object_path,'queued') returning id into analysis_id;
 perform public.write_audit_event(target_academy_id,'riding_analysis.requested','riding_video_analysis',analysis_id,jsonb_build_object('rider_user_id',target_rider_user_id,'horse_id',target_horse_id)); return analysis_id;
end;$$;
create function public.review_riding_video_analysis(target_analysis_id uuid,target_decision text,target_feedback text) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=(select auth.uid()); scoped public.riding_video_analyses%rowtype; next_status public.riding_analysis_status;
begin
 select * into scoped from public.riding_video_analyses where id=target_analysis_id for update;
 if scoped.id is null or actor is null or not private.can_manage_riding_analysis(scoped.academy_id,scoped.rider_user_id) then raise exception 'Analysis review access required' using errcode='42501'; end if;
 if scoped.status<>'review_required' then raise exception 'Analysis is not ready for review' using errcode='22023'; end if;
 if target_decision not in('approve','reject') or char_length(btrim(target_feedback)) not between 3 and 2000 then raise exception 'Invalid review' using errcode='22023'; end if;
 next_status:=case target_decision when 'approve' then 'approved'::public.riding_analysis_status else 'rejected'::public.riding_analysis_status end;
 update public.riding_video_analyses set status=next_status,coach_feedback=btrim(target_feedback),reviewed_at=now(),reviewed_by=actor,updated_at=now() where id=target_analysis_id;
 perform public.write_audit_event(scoped.academy_id,'riding_analysis.'||next_status::text,'riding_video_analysis',scoped.id,jsonb_build_object('rider_user_id',scoped.rider_user_id)); return true;
end;$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('riding-analysis-videos','riding-analysis-videos',false,524288000,array['video/mp4','video/quicktime','video/webm']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy riding_analysis_video_insert_staff on storage.objects for insert to authenticated with check(bucket_id='riding-analysis-videos' and owner_id=(select auth.uid()::text) and split_part(name,'/',2)=(select auth.uid()::text) and case when split_part(name,'/',1)~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then private.has_academy_role(split_part(name,'/',1)::uuid,array['academy_admin','coach']::public.app_role[]) else false end);
create policy riding_analysis_video_select_staff on storage.objects for select to authenticated using(bucket_id='riding-analysis-videos' and case when split_part(name,'/',1)~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then private.has_academy_role(split_part(name,'/',1)::uuid,array['academy_admin','coach']::public.app_role[]) else false end);
revoke all on public.riding_video_analyses from anon,authenticated; grant select on public.riding_video_analyses to authenticated;
revoke all on function public.request_riding_video_analysis(uuid,uuid,uuid,uuid,text),public.review_riding_video_analysis(uuid,text,text) from public,anon;
grant execute on function public.request_riding_video_analysis(uuid,uuid,uuid,uuid,text),public.review_riding_video_analysis(uuid,text,text) to authenticated;
revoke all on function private.can_manage_riding_analysis(uuid,uuid),private.can_view_approved_riding_analysis(uuid,uuid) from public,anon;
grant execute on function private.can_manage_riding_analysis(uuid,uuid),private.can_view_approved_riding_analysis(uuid,uuid) to authenticated;
commit;
