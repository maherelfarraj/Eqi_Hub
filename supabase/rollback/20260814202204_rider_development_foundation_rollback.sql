-- Roll back Batch 1 rider development foundation.
begin;

drop function if exists public.approve_lesson_development_report(uuid);
drop function if exists public.save_lesson_development_report(
  uuid, text[], text, text[], text[], text, text, text, timestamptz,
  text, smallint, smallint, smallint, jsonb, text
);

drop trigger if exists lesson_development_private_notes_prepare
  on public.lesson_development_private_notes;
drop trigger if exists rider_competency_evidence_prepare
  on public.rider_competency_evidence;
drop trigger if exists lesson_development_reflections_prepare
  on public.lesson_development_reflections;
drop trigger if exists lesson_development_reports_finalize
  on public.lesson_development_reports;
drop trigger if exists lesson_development_reports_prepare
  on public.lesson_development_reports;

drop function if exists private.prepare_rider_competency_evidence();
drop function if exists private.prepare_lesson_development_private_note();
drop function if exists private.prepare_lesson_development_reflection();
drop function if exists private.finalize_lesson_development_report();
drop function if exists private.prepare_lesson_development_report();
drop function if exists private.rider_competency_stage_rank(text);
drop function if exists private.can_manage_lesson_development(uuid);
drop function if exists private.can_manage_rider_development(uuid, uuid);

drop table if exists public.rider_competency_progress;
drop table if exists public.rider_competency_evidence;
drop table if exists public.lesson_development_reflections;
drop table if exists public.lesson_development_private_notes;
drop table if exists public.lesson_development_report_history;
drop table if exists public.lesson_development_reports;
drop table if exists public.rider_competency_catalog;

commit;
