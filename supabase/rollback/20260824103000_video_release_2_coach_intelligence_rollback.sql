-- Roll back Video Release 2 only. Release 1 review tables, policies, and storage remain unchanged.
begin;

drop policy if exists video_release_2_storage_staff_delete on storage.objects;
drop policy if exists video_release_2_storage_staff_update on storage.objects;
drop policy if exists video_release_2_storage_authorized_upload on storage.objects;
drop policy if exists video_release_2_storage_staff_read on storage.objects;
delete from storage.buckets where id = 'video-release-2';

drop function if exists public.get_video_release_2_trend(uuid, uuid);
drop function if exists public.get_video_release_2_pilot_riders(uuid);
drop function if exists public.get_video_release_2_comparison(uuid, uuid, uuid);
drop function if exists public.get_video_release_2_approved_feedback(uuid);
drop function if exists public.get_video_release_2_rider_consent_sessions(uuid);
drop function if exists public.approve_video_release_2_revision(uuid);
drop function if exists public.save_video_release_2_scorecard(uuid, text, smallint, text);
drop function if exists public.save_video_release_2_stride_observation(uuid, uuid, integer, integer, text, integer, text);
drop function if exists public.save_video_release_2_course_tag(uuid, uuid, integer, text, text, integer, text);
drop function if exists private.assert_video_release_2_draft(uuid);
drop function if exists public.create_video_release_2_revision(uuid, text);
drop function if exists public.confirm_video_release_2_clip_upload(uuid);
drop function if exists public.register_video_release_2_clip(uuid, text, text, bigint, integer);
drop function if exists public.record_video_release_2_consent(uuid, boolean);
drop function if exists public.create_video_release_2_session(uuid, uuid, uuid, uuid, uuid, text, text);
drop function if exists public.get_video_release_2_access(uuid);

drop trigger if exists video_release_2_session_prepare on public.video_release_2_sessions;
drop function if exists private.prepare_video_release_2_session();
drop function if exists private.audit_video_release_2(uuid, uuid, uuid, text, jsonb);
drop function if exists private.can_upload_video_release_2_storage_path(text);
drop function if exists private.can_manage_video_release_2_storage_path(text);
drop function if exists private.video_release_2_storage_session_path(text);
drop function if exists private.video_release_2_revision_visible(public.video_release_2_review_revisions);
drop function if exists private.video_release_2_session_visible(public.video_release_2_sessions);
drop function if exists private.can_read_approved_video_release_2(uuid, uuid, uuid);
drop function if exists private.can_upload_video_release_2_session(public.video_release_2_sessions, uuid);
drop function if exists private.can_manage_video_release_2_session(public.video_release_2_sessions, uuid);
drop function if exists private.can_coach_video_release_2_rider(uuid, uuid, uuid);
drop function if exists private.can_manage_video_release_2(uuid, uuid);
drop function if exists private.video_release_2_adult_rider(uuid, uuid);
drop function if exists private.video_release_2_enabled(uuid);

drop table if exists public.video_release_2_audit_events;
drop table if exists public.video_release_2_consent_events;
drop table if exists public.video_release_2_scorecards;
drop table if exists public.video_release_2_stride_observations;
drop table if exists public.video_release_2_course_tags;
drop table if exists public.video_release_2_review_revisions;
drop table if exists public.video_release_2_clips;
drop table if exists public.video_release_2_sessions;
drop table if exists public.video_release_2_pilot_participants;
drop table if exists public.video_release_2_feature_flags;

commit;