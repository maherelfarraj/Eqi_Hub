-- Roll back Batch 2 RiderSync dashboard objects without touching Batch 1 data.
begin;

drop trigger if exists rider_sync_refresh_report on public.lesson_development_reports;
drop trigger if exists rider_sync_refresh_reflection on public.lesson_development_reflections;
drop trigger if exists rider_badge_awards_prepare on public.rider_badge_awards;

drop function if exists public.get_rider_sync_dashboard(uuid, uuid);
drop function if exists public.award_rider_badge(uuid, uuid, text, text, uuid);
drop function if exists private.prepare_rider_badge_award();
drop function if exists private.refresh_rider_sync_after_reflection();
drop function if exists private.refresh_rider_sync_after_report();
drop function if exists private.refresh_rider_sync_score(uuid, uuid, text, uuid, text, uuid);
drop function if exists private.rider_sync_stage_score(text);

drop table if exists public.rider_badge_awards;
drop table if exists public.rider_journey_title_unlocks;
drop table if exists public.rider_sync_score_snapshots;
drop table if exists public.rider_badge_catalog;
drop table if exists public.rider_journey_title_catalog;

commit;
