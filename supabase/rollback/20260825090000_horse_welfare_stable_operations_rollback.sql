-- Rollback for Batch 5 Horse Welfare & Stable Operations.
-- Removes only the default-off Batch 5 schema and RPC surface.
begin;

drop function if exists public.update_horse_welfare_alert(uuid, uuid, text);
drop function if exists public.create_horse_welfare_alert(uuid, uuid, text, text, text, text, text, text, text, uuid, timestamptz);
drop function if exists public.upsert_stable_maintenance_record(uuid, uuid, uuid, text, text, text, text, text, text, timestamptz, text, text, text);
drop function if exists public.upsert_stable_safety_inspection(uuid, uuid, text, text, text, text, text, text, text, text, timestamptz, timestamptz, text);
drop function if exists public.close_horse_welfare_incident(uuid, uuid, text);
drop function if exists public.record_horse_welfare_incident(uuid, uuid, uuid, text, text, text, text, text, text, timestamptz, text);
drop function if exists public.upsert_horse_emergency_protocol(uuid, uuid, text, text, text, text, text, text, text, text, text, boolean);
drop function if exists public.resolve_horse_welfare_observation(uuid, uuid, text);
drop function if exists public.record_horse_welfare_observation(uuid, uuid, text, text, text, text, text, text, timestamptz, text);
drop function if exists public.upsert_horse_clinical_schedule(uuid, uuid, uuid, text, text, text, text, text, text, text, text, timestamptz, text, text, text, text, text);
drop function if exists public.upsert_horse_daily_care_log(uuid, uuid, date, boolean, boolean, boolean, boolean, boolean, text, text, text);
drop function if exists public.upsert_horse_feeding_plan(uuid, uuid, uuid, text, text, text, text, text, smallint, text, text, date, date, text);
drop function if exists public.upsert_horse_welfare_profile(uuid, uuid, text, text, integer, numeric, text, text, text, boolean);
drop function if exists public.get_horse_welfare_workspace(uuid);
drop function if exists public.get_horse_welfare_access(uuid);
drop function if exists private.audit_horse_welfare(uuid, uuid, text, uuid, text, jsonb, jsonb);
drop function if exists private.assert_horse_welfare_access(uuid, uuid);
drop function if exists private.can_manage_horse_welfare(uuid);
drop function if exists private.horse_welfare_enabled(uuid);

drop table if exists public.horse_welfare_audit_events;
drop table if exists public.horse_welfare_alerts;
drop table if exists public.stable_maintenance_records;
drop table if exists public.stable_safety_inspections;
drop table if exists public.horse_welfare_incidents;
drop table if exists public.horse_emergency_protocols;
drop table if exists public.horse_welfare_observations;
drop table if exists public.horse_clinical_schedules;
drop table if exists public.horse_daily_care_logs;
drop table if exists public.horse_feeding_plans;
drop table if exists public.horse_welfare_profiles;
drop table if exists public.horse_welfare_feature_flags;

commit;