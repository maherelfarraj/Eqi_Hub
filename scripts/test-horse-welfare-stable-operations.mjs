import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const paths = {
  migration: "supabase/migrations/20260825090000_horse_welfare_stable_operations.sql",
  rollback: "supabase/rollback/20260825090000_horse_welfare_stable_operations_rollback.sql",
  hook: "artifacts/equus-voyages/src/hooks/use-horse-welfare.ts",
  page: "artifacts/equus-voyages/src/pages/HorseWelfarePage.tsx",
  appShell: "artifacts/equus-voyages/src/components/AppShell.tsx",
  persona: "artifacts/equus-voyages/src/lib/portal-persona.ts",
};
const files = Object.fromEntries(
  await Promise.all(
    Object.entries(paths).map(async ([key, path]) => [key, await readFile(resolve(root, path), "utf8")]),
  ),
);
const has = (key, pattern, message) => assert.match(files[key], pattern, message);

has(
  "migration",
  /horse_welfare_feature_flags[\s\S]*enabled boolean not null default false/,
  "Horse Welfare must remain default-off for every organization",
);
has(
  "migration",
  /array\['academy_admin', 'stable_manager', 'coach'\]/,
  "Only explicitly authorized academy roles may manage horse welfare",
);
assert.doesNotMatch(
  files.migration,
  /array\[[^\]]*'rider'|array\[[^\]]*'guardian'/,
  "Riders and Guardians must never receive medical or welfare role access",
);
has(
  "migration",
  /private\.assert_horse_welfare_access[\s\S]*private\.lock_horse_operation/,
  "Horse-affecting Batch 5 actions must serialize through the established horse lock",
);
has(
  "migration",
  /revoke all on table public\.horse_clinical_schedules from anon, authenticated/,
  "Clinical schedules must not be read or written directly by clients",
);
has(
  "migration",
  /grant execute on function public\.get_horse_welfare_workspace/,
  "Staff records must be accessed through guarded RPCs",
);
const clinicalScheduleSignature =
  "uuid, uuid, uuid, text, text, text, text, text, text, text, text, timestamptz, text, text, text, text, text";
assert.ok(
  files.migration.includes(
    `revoke all on function public.upsert_horse_clinical_schedule(${clinicalScheduleSignature}) from public, anon;`,
  ),
  "Clinical schedule revoke must use the exact declared RPC signature",
);
assert.ok(
  files.migration.includes(
    `grant execute on function public.upsert_horse_clinical_schedule(${clinicalScheduleSignature}) to authenticated;`,
  ),
  "Clinical schedule grant must use the exact declared RPC signature",
);
assert.ok(
  files.rollback.includes(
    `drop function if exists public.upsert_horse_clinical_schedule(${clinicalScheduleSignature});`,
  ),
  "Clinical schedule rollback must use the exact declared RPC signature",
);
has(
  "migration",
  /feed_name_en[\s\S]*feed_name_ar[\s\S]*instructions_en[\s\S]*instructions_ar/,
  "Feeding plans must store bilingual user-facing content",
);
has(
  "migration",
  /title_en[\s\S]*title_ar[\s\S]*response_steps_en[\s\S]*response_steps_ar/,
  "Emergency protocols must store bilingual instructions",
);
has(
  "migration",
  /maintenance_type_en text not null[\s\S]*maintenance_type_ar text not null/,
  "Maintenance record types must store bilingual user-facing content",
);
has(
  "migration",
  /foreign key \(horse_id, organization_id\)[\s\S]*on delete set null \(horse_id\)/,
  "Deleting a horse must clear only an optional alert horse reference, never organization ownership",
);
has(
  "migration",
  /foreign key \(emergency_protocol_id, organization_id\)[\s\S]*on delete set null \(emergency_protocol_id\)/,
  "Deleting an emergency protocol must retain the incident organization boundary",
);
has(
  "migration",
  /foreign key \(inspection_id, organization_id\)[\s\S]*on delete set null \(inspection_id\)/,
  "Deleting an inspection must retain the maintenance organization boundary",
);
has(
  "migration",
  /horse_welfare_audit_events[\s\S]*before_data jsonb[\s\S]*after_data jsonb/,
  "The module must retain a private audit history",
);
has(
  "rollback",
  /drop table if exists public\.horse_welfare_alerts/,
  "Rollback must remove Batch 5 operational alert records",
);
assert.doesNotMatch(
  files.rollback,
  /video_review_sessions|competition_development|medical_waiver|horse_operation_holds/,
  "Rollback must not remove prior video, competition, safety, or stable foundations",
);
has(
  "hook",
  /get_horse_welfare_access[\s\S]*get_horse_welfare_workspace/,
  "The client must use the guarded access and workspace RPCs",
);
assert.doesNotMatch(
  files.hook,
  /\.from\("(horse_welfare|horse_clinical|stable_safety|stable_maintenance)/,
  "The client hook must not access private welfare tables directly",
);
has(
  "page",
  /useHorseWelfareAccess\(\)[\s\S]*access\.data\?\.canManage/,
  "The private staff page must fail closed before loading its workspace",
);
has(
  "page",
  /onChangeAr=\{\(v: string\) => setData\(\{\.\.\.data, correctiveActionAr: v\}\)\}/,
  "The inspection Arabic corrective-action field must update its Arabic state",
);
has(
  "page",
  /maintenanceTypeEn[\s\S]*maintenanceTypeAr/,
  "The maintenance form must collect both English and Arabic record types",
);
for (const method of [
  "saveProfile",
  "saveFeedingPlan",
  "saveDailyCareLog",
  "saveClinicalSchedule",
  "recordObservation",
  "saveProtocol",
  "recordIncident",
  "saveInspection",
  "saveMaintenance",
  "createAlert",
  "updateAlert",
]) {
  assert.match(files.page, new RegExp(method), `The staff page must expose ${method}`);
}
has(
  "appShell",
  /path: "\/horse-welfare"[\s\S]*horseWelfareAccess\.data\?\.canManage/,
  "Navigation must not expose the private route without authorized access",
);
const guardianPaths = files.persona.match(
  /const guardianNavigationPaths = new Set\(\[[\s\S]*?\]\);/,
)?.[0] ?? "";
const academyAdminPaths = files.persona.match(
  /const academyAdminNavigationPaths = new Set\(\[[\s\S]*?\]\);/,
)?.[0] ?? "";
assert.match(
  academyAdminPaths,
  /"\/horse-welfare"/,
  "The existing academy-admin portal may access the authorized staff route",
);
assert.doesNotMatch(
  guardianPaths,
  /"\/horse-welfare"/,
  "Guardian portal navigation must not expose horse welfare",
);

console.log("Horse Welfare & Stable Operations static checks passed.");