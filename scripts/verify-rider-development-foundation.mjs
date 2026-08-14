import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const migrationPath = resolve(
  repositoryRoot,
  "supabase/migrations/20260814202204_rider_development_foundation.sql",
);
const rollbackPath = resolve(
  repositoryRoot,
  "supabase/rollback/20260814202204_rider_development_foundation_rollback.sql",
);

function isTransactional(sql) {
  return /^\s*(?:--[^\n]*\n)*begin;/i.test(sql) && /commit;\s*$/i.test(sql);
}

const tables = [
  "rider_competency_catalog",
  "lesson_development_reports",
  "lesson_development_report_history",
  "lesson_development_private_notes",
  "lesson_development_reflections",
  "rider_competency_evidence",
  "rider_competency_progress",
];

export function validateRiderDevelopmentFoundation(migration, rollback) {
  const errors = [];

  if (!isTransactional(migration))
    errors.push("migration must be transactional");
  if (!isTransactional(rollback)) errors.push("rollback must be transactional");
  if (/auth\.role\s*\(/i.test(`${migration}\n${rollback}`)) {
    errors.push("must not use deprecated auth.role()");
  }
  if (/using\s*\(\s*true\s*\)|with check\s*\(\s*true\s*\)/i.test(migration)) {
    errors.push("RLS policies must not use unconditional access");
  }

  for (const table of tables) {
    const guards = [
      new RegExp(`create table public\\.${table}\\s*\\(`, "i"),
      new RegExp(
        `alter table public\\.${table} enable row level security;`,
        "i",
      ),
      new RegExp(
        `revoke all on public\\.${table} from anon, authenticated;`,
        "i",
      ),
      new RegExp(`drop table if exists public\\.${table};`, "i"),
    ];
    for (const guard of guards) {
      if (!(guard.test(migration) || guard.test(rollback))) {
        errors.push(`missing ${table} guard: ${guard}`);
      }
    }
  }

  const requiredGuards = [
    /create function private\.can_manage_rider_development\s*\(/i,
    /from public\.coach_rider_assignments as assignment/i,
    /assignment\.active/i,
    /assignment\.starts_on <= current_date/i,
    /assignment\.ends_on is null or assignment\.ends_on >= current_date/i,
    /private\.has_organization_role\(p_organization_id, array\['coach'\]\)/i,
    /create function private\.can_manage_lesson_development\s*\(/i,
    /lesson\.trainer_id = \(select auth\.uid\(\)\)/i,
    /create policy lesson_development_reports_select_scoped[\s\S]*?using\s*\([\s\S]*?status = 'approved'\s+and private\.can_read_rider\(organization_id, rider_id\)[\s\S]*?\n\);/i,
    /old\.status = 'approved'[\s\S]*?Approved reports are immutable/i,
    /create function private\.finalize_lesson_development_report\s*\(/i,
    /old\.status = 'draft' and new\.status = 'approved'/i,
    /create trigger lesson_development_reports_finalize/i,
    /create function private\.prepare_rider_competency_evidence\s*\(/i,
    /Approved competency evidence is immutable/i,
    /Evidence approval must follow the report approval transition/i,
    /create trigger rider_competency_evidence_prepare/i,
    /create policy lesson_development_reflections_insert_rider[\s\S]*?rider_id = \(select auth\.uid\(\)\)/i,
    /create policy lesson_development_private_notes_select_staff/i,
    /create function public\.save_lesson_development_report\s*\(/i,
    /create function public\.approve_lesson_development_report\s*\(/i,
    /security invoker/i,
    /insert into public\.rider_competency_progress/i,
    /update public\.rider_competency_evidence[\s\S]*?approved_at = now\(\)/i,
    /draft evidence cannot change this table/i,
    /revoke all on function public\.save_lesson_development_report/i,
    /grant execute on function public\.save_lesson_development_report/i,
    /revoke all on function public\.approve_lesson_development_report\(uuid\)/i,
    /grant execute on function public\.approve_lesson_development_report\(uuid\)/i,
  ];

  for (const guard of requiredGuards) {
    if (!guard.test(migration)) errors.push(`missing required guard: ${guard}`);
  }

  const securityDefinerFunctions = [
    "can_manage_rider_development",
    "can_manage_lesson_development",
    "prepare_lesson_development_report",
    "finalize_lesson_development_report",
    "prepare_lesson_development_reflection",
    "prepare_lesson_development_private_note",
    "prepare_rider_competency_evidence",
  ];
  for (const fn of securityDefinerFunctions) {
    const block = new RegExp(
      `create function private\\.${fn}[\\s\\S]*?security definer[\\s\\S]*?set search_path = ''`,
      "i",
    );
    if (!block.test(migration)) {
      errors.push(`${fn} must be security definer with an empty search_path`);
    }
  }

  if (
    !/grant select on public\.rider_competency_catalog to authenticated;/i.test(
      migration,
    )
  ) {
    errors.push(
      "competency catalogue requires an explicit Data API select grant",
    );
  }
  if (
    !/grant select, insert, update on public\.lesson_development_reports to authenticated;/i.test(
      migration,
    )
  ) {
    errors.push("lesson reports require explicit Data API grants");
  }

  return errors;
}

if (process.argv[1] === import.meta.filename) {
  const [migration, rollback] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(rollbackPath, "utf8"),
  ]);
  const errors = validateRiderDevelopmentFoundation(migration, rollback);
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Verified rider-development tables, approval boundary, persona RLS, explicit grants, and rollback",
  );
}
