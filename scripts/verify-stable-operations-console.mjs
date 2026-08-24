import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const paths = {
  migration: resolve(root, "supabase/migrations/20260824120000_stable_operations_console_daily_workflows.sql"),
  rollback: resolve(root, "supabase/rollback/20260824120000_stable_operations_console_daily_workflows_rollback.sql"),
  page: resolve(root, "artifacts/equus-voyages/src/pages/StableOperationsPage.tsx"),
  hook: resolve(root, "artifacts/equus-voyages/src/hooks/use-stable-operations-console.ts"),
};

const transactional = (sql) =>
  /^\s*(?:--[^\n]*\n)*begin;/i.test(sql) && /commit;\s*$/i.test(sql);

export function validateStableOperationsConsole({ migration, rollback, page, hook }) {
  const errors = [];
  if (!transactional(migration) || !transactional(rollback)) {
    errors.push("Batch 2 migration and rollback must be transactional");
  }
  if (/revoke all on function if exists/i.test(rollback)) {
    errors.push("rollback must use valid PostgreSQL REVOKE syntax");
  }
  const eligibilityFunction =
    migration.match(/create function public\.check_horse_assignment_eligibility[\s\S]*?\$\$;/i)?.[0] ?? "";
  for (const required of [
    "create function public.check_horse_assignment_eligibility",
    "perform private.lock_horse_operation(p_organization_id, p_horse_id)",
    "create function public.get_stable_operations_console",
    "create function public.get_stable_daily_tasks",
    "create function public.get_stable_care_schedules",
    "create function public.get_stable_operations_audit_timeline",
    "create function public.update_horse_operation_profile",
    "create function public.create_horse_operation_hold",
    "create function public.release_horse_operation_hold",
    "create function public.upsert_horse_care_schedule",
    "create function public.complete_horse_care_schedule",
    "create function public.create_stable_task",
    "create function public.update_stable_task_workflow",
    "reason text not null",
    "escalation_level text not null default 'none'",
    "'feeding', 'turnout', 'tack_equipment'",
  ]) {
    if (!migration.includes(required)) errors.push(`missing required Batch 2 contract: ${required}`);
  }
  if (!eligibilityFunction.includes("p_exclude_lesson_id uuid default null")) {
    errors.push("missing required Batch 2 contract: p_exclude_lesson_id uuid default null");
  }
  if (!/released or expired horse operation holds are immutable/i.test(migration)) {
    errors.push("closed holds must be immutable");
  }
  if (!/private\.can_manage_stable_operations\(p_organization_id\)/.test(migration)) {
    errors.push("staff workflow RPCs must enforce stable operations access");
  }
  if (!/create or replace function public\.assert_horse_assignment_allowed/i.test(rollback)
    || !/create or replace function private\.prepare_stable_task/i.test(rollback)) {
    errors.push("rollback must restore replaced Batch 1 guard and trigger behavior");
  }
  if (!/useStableOperationsConsole/.test(page)
    || !/if \(!canManage\)/.test(page)
    || !/useStableOperationsPreview/.test(page)) {
    errors.push("page must keep staff workflows and audience-safe rendering separate");
  }
  if (!/releaseHold/.test(page) || !/checkAssignmentEligibility/.test(page)) {
    errors.push("page must expose hold closure and assignment feedback workflows");
  }
  if (/\.(?:insert|update|delete|upsert)\s*\(/.test(page)) {
    errors.push("page must not bypass guarded workflow RPCs with direct mutations");
  }
  if (!/get_stable_operations_console/.test(hook)
    || !/check_horse_assignment_eligibility/.test(hook)
    || !/p_exclude_lesson_id: null/.test(hook)) {
    errors.push("client hook must use the Batch 2 guarded read and eligibility contracts");
  }
  return errors;
}

const [migration, rollback, page, hook] = await Promise.all([
  readFile(paths.migration, "utf8"),
  readFile(paths.rollback, "utf8"),
  readFile(paths.page, "utf8"),
  readFile(paths.hook, "utf8"),
]);
const errors = validateStableOperationsConsole({ migration, rollback, page, hook });
if (errors.length) {
  throw new Error(`Stable Operations Console validation failed:\n- ${errors.join("\n- ")}`);
}
console.log("Verified Batch 2 stable operations workflow, guard, privacy, and rollback contracts");