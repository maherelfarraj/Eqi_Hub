-- Roll back the private video review foundation without changing legacy video records.
begin;

drop policy if exists video_review_storage_read_approved_derivatives on storage.objects;
drop policy if exists video_review_storage_staff_manage on storage.objects;

drop trigger if exists video_review_annotation_audit on public.video_review_annotations;
drop trigger if exists video_review_clip_audit on public.video_review_clips;
drop trigger if exists video_review_session_audit on public.video_review_sessions;
drop trigger if exists video_review_annotation_prepare on public.video_review_annotations;
drop trigger if exists video_review_clip_prepare on public.video_review_clips;
drop trigger if exists video_review_session_prepare on public.video_review_sessions;

drop function if exists public.record_video_review_activity(uuid, text);
drop function if exists private.audit_video_review_change();
drop function if exists private.prepare_video_review_annotation();
drop function if exists private.prepare_video_review_clip();
drop function if exists private.invalidate_video_review_approval(uuid);
drop function if exists private.prepare_video_review_session();
drop function if exists private.can_read_video_review_derivative_path(text);
drop function if exists private.can_manage_video_review_storage_path(text);
drop function if exists private.can_read_approved_video_review(uuid, uuid);
drop function if exists private.video_review_audience_visible(public.video_review_sessions);
drop function if exists private.can_approve_video_review(uuid, uuid);
drop function if exists private.can_manage_video_review(uuid, uuid);

drop table if exists public.video_review_activity_events;
drop table if exists public.video_review_annotations;
drop table if exists public.video_review_clips;
drop table if exists public.video_review_sessions;

commit;