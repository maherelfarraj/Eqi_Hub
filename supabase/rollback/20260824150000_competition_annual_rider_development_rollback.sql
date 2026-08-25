-- Roll back Competition & Annual Rider Development only.
-- Earlier rider development, medical, stable operations, and video releases remain unchanged.
begin;

drop function if exists public.publish_competition_development_report(uuid);
drop function if exists public.approve_competition_development_report(uuid);
drop function if exists public.save_competition_development_report(uuid, uuid, uuid, text, text, text, text, uuid);
drop function if exists public.save_competition_jumping_progress(uuid, uuid, smallint, text, uuid, uuid, uuid, uuid, boolean);
drop function if exists public.confirm_competition_readiness(uuid);
drop function if exists public.save_competition_readiness(uuid, uuid, text, uuid, text, uuid, uuid, uuid, boolean);
drop function if exists public.save_competition_result(uuid, integer, numeric, text, text, boolean);
drop function if exists public.save_competition_logistics(uuid, text, text, text, integer, text, boolean, text);
drop function if exists public.save_competition_entry(uuid, uuid, uuid, text, text, smallint, uuid, uuid, uuid, text, text, text, uuid, boolean, boolean);
drop function if exists public.save_competition_event(uuid, text, text, text, date, date, date, text, boolean, uuid);
drop function if exists public.save_competition_annual_plan(uuid, uuid, integer, text, text, text, text, uuid, uuid, boolean, boolean);
drop function if exists public.get_competition_development_workspace(uuid, uuid);
drop function if exists public.get_competition_development_coaches(uuid, uuid);
drop function if exists public.get_competition_development_riders(uuid);
drop function if exists public.get_competition_development_access(uuid, uuid);

drop function if exists private.competition_audit(uuid, uuid, text, uuid, text, jsonb);
drop function if exists private.competition_readiness_source_valid(uuid, uuid, uuid, text, uuid);
drop function if exists private.can_view_competition_costs(uuid, uuid);
drop function if exists private.can_view_competition_rider(uuid, uuid);
drop function if exists private.can_manage_competition_development(uuid, uuid);
drop function if exists private.can_manage_competition_calendar(uuid);
drop function if exists private.competition_development_enabled(uuid);

drop table if exists public.competition_development_audit_events;
drop table if exists public.competition_development_reports;
drop table if exists public.competition_jumping_ladder_progress;
drop table if exists public.competition_jumping_ladder_catalog;
drop table if exists public.competition_readiness_evidence;
drop table if exists public.competition_entry_results;
drop table if exists public.competition_entry_logistics;
drop table if exists public.competition_development_entries;
drop table if exists public.competition_development_events;
drop table if exists public.competition_annual_plans;
drop table if exists public.competition_development_feature_flags;

commit;