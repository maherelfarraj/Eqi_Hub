-- Roll back Video Release 3 only. Video Releases 1 and 2 remain unchanged.
begin;

drop function if exists public.approve_video_release_3_report(uuid);
drop function if exists public.save_video_release_3_report(uuid, uuid, date, date, text, text, text, text, uuid[], uuid);
drop function if exists public.get_video_release_3_reports(uuid, uuid);
drop function if exists public.create_video_release_3_comparison(uuid, uuid, uuid, uuid, text, uuid);
drop function if exists public.get_video_release_3_comparisons(uuid, uuid);
drop function if exists public.create_video_release_3_milestone(uuid, uuid, text, date, text, uuid, uuid);
drop function if exists public.get_video_release_3_milestones(uuid, uuid);
drop function if exists public.confirm_video_release_3_benchmark(uuid, uuid, text, smallint, uuid, uuid, text);
drop function if exists public.get_video_release_3_benchmarks(uuid, uuid);
drop function if exists public.link_video_release_3_plan_evidence(uuid, uuid, text);
drop function if exists public.save_video_release_3_training_plan(uuid, uuid, text, text, date, date, text, uuid, uuid, text);
drop function if exists public.get_video_release_3_plans(uuid, uuid);
drop function if exists public.get_video_release_3_timeline(uuid, uuid, uuid);
drop function if exists public.get_video_release_3_access(uuid);

drop function if exists private.video_release_3_plan_visible(public.video_release_3_training_plans);
drop function if exists private.video_release_3_audit(uuid, uuid, text, uuid, text, jsonb);
drop function if exists private.video_release_3_approved_revision(uuid, uuid, uuid, uuid);
drop function if exists private.video_release_3_approved_session(uuid, uuid, uuid, uuid);
drop function if exists private.can_manage_video_release_3(uuid, uuid, uuid);
drop function if exists private.video_release_3_enabled(uuid);

drop table if exists public.video_release_3_audit_events;
drop table if exists public.video_release_3_report_evidence;
drop table if exists public.video_release_3_reports;
drop table if exists public.video_release_3_comparisons;
drop table if exists public.video_release_3_milestones;
drop table if exists public.video_release_3_benchmarks;
drop table if exists public.video_release_3_plan_evidence;
drop table if exists public.video_release_3_training_plans;
drop table if exists public.video_release_3_feature_flags;

commit;