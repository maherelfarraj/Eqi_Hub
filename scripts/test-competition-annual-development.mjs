import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const paths = {
  migration: "supabase/migrations/20260824150000_competition_annual_rider_development.sql",
  hardeningMigration: "supabase/migrations/20260826110000_review_security_hardening.sql",
  rollback: "supabase/rollback/20260824150000_competition_annual_rider_development_rollback.sql",
  hook: "artifacts/equus-voyages/src/hooks/use-competition-development.ts",
  page: "artifacts/equus-voyages/src/pages/CompetitionDevelopmentPage.tsx",
  persona: "artifacts/equus-voyages/src/lib/portal-persona.ts",
};
const files = Object.fromEntries(
  await Promise.all(
    Object.entries(paths).map(async ([key, path]) => [
      key,
      await readFile(resolve(root, path), "utf8"),
    ]),
  ),
);
const has = (key, pattern, message) =>
  assert.match(files[key], pattern, message);

has(
  "migration",
  /competition_development_feature_flags[\s\S]*enabled boolean not null default false/,
  "Competition development must remain default-off",
);
has(
  "migration",
  /can_manage_competition_development[\s\S]*coach_rider_assignments[\s\S]*starts_on <= current_date/,
  "Coach mutations must require a current active Coach–Rider assignment",
);
for (const helper of [
  "can_manage_competition_calendar",
  "can_manage_competition_development",
  "can_view_competition_rider",
  "can_view_competition_costs",
]) {
  assert.doesNotMatch(
    files.migration.match(new RegExp(`create or replace function private\\.${helper}[\\s\\S]*?\\n\\$\\$;`))?.[0] ?? "",
    /\bp_user_id\b/,
    `${helper} must derive caller identity from auth.uid() rather than accept a caller-supplied user id.`,
  );
}
has(
  "hardeningMigration",
  /create or replace function private\.can_manage_competition_calendar\(p_organization_id uuid\)[\s\S]*create or replace function private\.can_view_competition_costs\(/,
  "Forward hardening must provide unambiguous identity-safe competition helpers for already-applied databases.",
);
for (const [helper, signature] of [
  ["can_manage_competition_calendar", "uuid"],
  ["can_manage_competition_development", "uuid,\\s*uuid"],
  ["can_view_competition_rider", "uuid,\\s*uuid"],
  ["can_view_competition_costs", "uuid,\\s*uuid"],
  ["can_manage_competition_calendar", "uuid,\\s*uuid"],
  ["can_manage_competition_development", "uuid,\\s*uuid,\\s*uuid"],
  ["can_view_competition_rider", "uuid,\\s*uuid,\\s*uuid"],
  ["can_view_competition_costs", "uuid,\\s*uuid,\\s*uuid"],
]) {
  assert.match(
    files.hardeningMigration,
    new RegExp(`revoke\\s+all\\s+on\\s+function\\s+private\\.${helper}\\(${signature}\\)\\s+from\\s+public,\\s+anon,\\s+authenticated;`, "i"),
    `Forward hardening must revoke EXECUTE from public, anon, and authenticated for ${helper}(${signature.replaceAll("\\s*", " ")}).`,
  );
}
has(
  "migration",
  /save_competition_annual_plan[\s\S]*Annual plans require a current Coach–Rider assignment/,
  "Annual plans must not let staff bypass the assigned Coach boundary",
);
has(
  "migration",
  /foreign key \(organization_id, competition_id\)[\s\S]*competition_development_events\(organization_id, id\)/,
  "Competition entries must retain organization-scoped integrity",
);
has(
  "migration",
  /perform private\.lock_horse_operation\(p_organization_id, p_horse_id\)/,
  "Horse entry assignments must serialize through the established horse lock",
);
has(
  "migration",
  /private\.competition_readiness_source_valid[\s\S]*video_release_3_approved_revision/,
  "Video-backed readiness evidence must be revalidated against current approved video state",
);
has(
  "migration",
  /report\.status = 'published'[\s\S]*private\.competition_readiness_source_valid/,
  "Portal workspace reads must return only published reports and current valid evidence",
);
has(
  "migration",
  /case when v_costs then[\s\S]*cost_cents[\s\S]*else '\[\]'::jsonb end/,
  "Costs must be omitted unless the caller has a financial permission",
);
has(
  "migration",
  /title_en[\s\S]*title_ar[\s\S]*content_en[\s\S]*content_ar/,
  "Reports must require English and Arabic content",
);
has(
  "migration",
  /approve_competition_development_report[\s\S]*current signed-off readiness evidence/,
  "Report approval must fail closed without current signed-off evidence",
);
const readinessSignoff = files.migration.match(
  /create or replace function public\.confirm_competition_readiness[\s\S]*?\n\$\$;/,
)?.[0] ?? "";
assert.match(
  files.migration,
  /save_competition_readiness[\s\S]*p_portal_visible[\s\S]*portal_visible = p_portal_visible/,
  "A Coach portal-visibility choice must be stored with readiness evidence",
);
assert.doesNotMatch(
  readinessSignoff,
  /portal_visible\s*=\s*true/,
  "Readiness sign-off must preserve an explicit portal opt-out",
);
has(
  "migration",
  /evidence\.status = 'signed_off' and evidence\.portal_visible[\s\S]*competition_readiness_source_valid/,
  "Portal reads must require both an explicit opt-in and current valid readiness evidence",
);
has(
  "migration",
  /revoke all on table public\.competition_development_entries from anon, authenticated/,
  "Clients must not directly mutate competition entry tables",
);
has(
  "migration",
  /grant execute on function public\.save_competition_annual_plan/,
  "Mutations must use guarded RPCs",
);
has(
  "migration",
  /coalesce\(profile\.full_name, 'Rider'\) as rider_name[\s\S]*order by 2/,
  "Rider lookup output and ordering must be unambiguous",
);
has(
  "migration",
  /coalesce\(profile\.full_name, 'Coach'\) as coach_name[\s\S]*order by 2/,
  "Coach lookup output and ordering must be unambiguous",
);
has(
  "migration",
  /v_entry\.status = 'withdrawn'[\s\S]*Withdrawn entries cannot receive a result/,
  "Withdrawn entries must not be made completed or portal-visible by saving a result",
);
has(
  "page",
  /if \(!coachId\) return Promise\.reject[\s\S]*p_coach_id: coachId/,
  "Annual plan saves must never submit an empty coach UUID",
);
has(
  "page",
  /if \(!coachId\) \{[\s\S]*setError\([\s\S]*coachRequired[\s\S]*p_coach_id: coachId/,
  "Competition-entry saves must fail closed when the rider has no active Coach",
);
has(
  "rollback",
  /drop table if exists public\.competition_development_reports/,
  "Rollback must remove Batch 4 competition development records",
);
assert.doesNotMatch(
  files.rollback,
  /video_release_2_sessions|video_review_sessions|medical_waiver/,
  "Competition rollback must not remove prior releases or medical gates",
);
has(
  "hook",
  /get_competition_development_workspace[\s\S]*save_competition_development_report[\s\S]*publish_competition_development_report/,
  "The client hook must use guarded workspace and report RPCs",
);
assert.doesNotMatch(
  files.hook,
  /\.from\("competition_/,
  "The client hook must not access competition tables directly",
);
has(
  "page",
  /cost_cents !== undefined[\s\S]*formatCurrency/,
  "The UI must only render cost values that the server provided",
);
has(
  "page",
  /approveReport[\s\S]*publishReport/,
  "The UI must retain separate report approval and publication controls",
);
has(
  "persona",
  /"\/competition-development"/,
  "Guardian portal routing must explicitly allow the approved competition surface",
);

console.log(
  "Verified default-off competition development, tenant/RPC protections, approval-only portal output, and earlier-release preservation",
);