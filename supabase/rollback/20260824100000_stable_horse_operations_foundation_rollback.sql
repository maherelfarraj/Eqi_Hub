-- Roll back Stable & Horse Operations without changing canonical horses, lessons, or legacy health records.
begin;

drop trigger if exists lessons_horse_operation_assignment_guard on public.lessons;
drop trigger if exists stable_tasks_audit on public.stable_tasks;
drop trigger if exists horse_care_schedules_audit on public.horse_care_schedules;
drop trigger if exists horse_operation_holds_audit on public.horse_operation_holds;
drop trigger if exists horse_operation_profiles_audit on public.horse_operation_profiles;
drop trigger if exists stable_tasks_prepare on public.stable_tasks;
drop trigger if exists horse_care_schedules_prepare on public.horse_care_schedules;
drop trigger if exists horse_operation_holds_prepare_delete on public.horse_operation_holds;
drop trigger if exists horse_operation_holds_prepare on public.horse_operation_holds;
drop trigger if exists horse_operation_profiles_prevent_delete on public.horse_operation_profiles;
drop trigger if exists horse_operation_profiles_prepare on public.horse_operation_profiles;

drop function if exists public.get_safe_horse_availability(uuid);
drop function if exists public.get_stable_operations_roster(uuid);
drop function if exists private.enforce_lesson_horse_operation_assignment();
drop function if exists public.assert_horse_assignment_allowed(uuid, uuid, timestamptz, integer, uuid, boolean);
drop function if exists private.audit_horse_operation_change();
drop function if exists private.prepare_stable_task();
drop function if exists private.prepare_horse_care_schedule();
drop function if exists private.prepare_horse_operation_hold_delete();
drop function if exists private.prepare_horse_operation_hold();
drop function if exists private.prevent_horse_operation_profile_delete();
drop function if exists private.prepare_horse_operation_profile();
drop function if exists private.lock_horse_operation(uuid, uuid);
drop function if exists private.can_read_safe_horse_availability(uuid, uuid);
drop function if exists private.can_manage_stable_operations(uuid);

drop table if exists public.horse_operation_audit_events;
drop table if exists public.stable_tasks;
drop table if exists public.horse_care_schedules;
drop table if exists public.horse_operation_holds;
drop table if exists public.horse_operation_profiles;

commit;