import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const paths = {
  migration: "supabase/migrations/20260824143000_video_release_3_development_intelligence.sql",
  hardeningMigration: "supabase/migrations/20260826110000_review_security_hardening.sql",
  rollback: "supabase/rollback/20260824143000_video_release_3_development_intelligence_rollback.sql",
  hook: "artifacts/equus-voyages/src/hooks/use-video-release-3.ts",
  workspace: "artifacts/equus-voyages/src/components/VideoDevelopmentWorkspace.tsx",
  page: "artifacts/equus-voyages/src/pages/VideoIntelligencePage.tsx",
  persona: "artifacts/equus-voyages/src/lib/portal-persona.ts",
  arabic: "artifacts/equus-voyages/src/i18n/ar.json",
};
const files = Object.fromEntries(
  await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readFile(resolve(root, path), "utf8")])),
);
const has = (key, pattern, message) => assert.match(files[key], pattern, message);

has("migration", /video_release_3_feature_flags[\s\S]*enabled boolean not null default false/, "Batch 3 must be default-off");
has("migration", /private\.video_release_3_enabled[\s\S]*private\.video_release_2_enabled/, "Batch 3 must inherit the Release 2 pilot boundary");
has("migration", /private\.can_manage_video_release_3[\s\S]*can_coach_video_release_2_rider/, "Batch 3 must be assigned-Coach-only");
has("migration", /video_release_3_approved_session[\s\S]*review_status = 'approved'[\s\S]*consent_status = 'granted'[\s\S]*retention_state = 'active'/, "Batch 3 evidence must remain approved, consented, and retained");
has("migration", /private\.video_release_3_approved_revision/, "Revision-linked Batch 3 records must be revalidated against current session eligibility");
has("migration", /get_video_release_3_benchmarks[\s\S]*video_release_3_approved_revision[\s\S]*get_video_release_3_milestones[\s\S]*video_release_3_approved_revision/, "Benchmark and milestone reads must suppress withdrawn or deleted evidence");
has("migration", /get_video_release_3_comparisons[\s\S]*first_session_id[\s\S]*video_release_3_approved_session[\s\S]*second_session_id[\s\S]*video_release_3_approved_session/, "Comparison reads must suppress invalidated source sessions");
has("migration", /get_video_release_3_reports[\s\S]*video_release_3_report_evidence[\s\S]*not private\.video_release_3_approved_session/, "Report reads must suppress any report with invalidated evidence");
has("migration", /get_video_release_3_plans[\s\S]*video_release_3_plan_evidence[\s\S]*not private\.video_release_3_approved_session/, "Training plans linked to invalidated evidence must be suppressed");
has("migration", /benchmark_family in \('foundation', 'show_jumping'\)[\s\S]*level between 1 and 10[\s\S]*level between 1 and 5/, "Benchmark scales must be constrained");
has("migration", /title_en[\s\S]*title_ar[\s\S]*content_en[\s\S]*content_ar/, "Coach reports must contain both English and Arabic content");
has("migration", /Reports must cite at least one approved review[\s\S]*Bilingual content and approved evidence are required before approval/, "Reports must fail closed without bilingual approved evidence");
has("migration", /revoke all on table public\.video_release_3_training_plans from anon, authenticated/, "Direct Batch 3 client writes must be revoked");
for (const helper of [
  "video_release_3_enabled",
  "can_manage_video_release_3",
  "video_release_3_approved_session",
  "video_release_3_approved_revision",
  "video_release_3_audit",
  "video_release_3_plan_visible",
]) {
  const revokeStatement = new RegExp(
    `revoke\\s+all\\s+on\\s+function\\s+private\\.${helper}\\([^;]+?\\)\\s+from\\s+public,\\s+anon,\\s+authenticated;`,
    "i",
  );
  has("migration", revokeStatement, `${helper} must revoke EXECUTE from public, anon, and authenticated`);
  has("hardeningMigration", revokeStatement, `Forward hardening must revoke EXECUTE from public, anon, and authenticated for ${helper}`);
}
has("migration", /create policy video_release_3_reports_assigned_coach_select/, "Coach report rows require an assigned-Coach RLS policy");
has("rollback", /drop table if exists public\.video_release_3_training_plans/, "Rollback must remove Batch 3 tables");
assert.doesNotMatch(files.rollback, /video_release_2_sessions|video_review_sessions/, "Batch 3 rollback must not remove earlier releases");
has("hook", /get_video_release_3_timeline[\s\S]*save_video_release_3_report[\s\S]*approve_video_release_3_report/, "Client hooks must use guarded Batch 3 RPCs");
assert.doesNotMatch(files.hook, /\.from\("video_release_3_/, "Client must not write Batch 3 tables directly");
has("workspace", /Title \(Arabic\)[\s\S]*Content \(Arabic\)[\s\S]*Cite Approved Evidence/, "Workspace must collect bilingual report content and approved evidence");
has("workspace", /const maxLevel = family === 'show_jumping' \? 5 : 10[\s\S]*max=\{maxLevel\}/, "Show-jumping benchmarks must never exceed level five in the Coach workspace");
has("workspace", /nextFamily === 'show_jumping' \? 5 : 10/, "Changing benchmark families must clamp the selected level to that family's range");
has("workspace", /useWorkspaceLocale[\s\S]*ar-JO/, "Video development dates must follow the active English or Arabic locale.");
assert.doesNotMatch(files.workspace, /formatDate\([^,]+,\s*['"](?:en-US|ar-JO)['"]/, "Video development workspace must not force a fixed date locale.");
const workspaceDateCalls = files.workspace.match(/formatDate\(/g)?.length ?? 0;
const workspaceLocaleDateCalls = files.workspace.match(/formatDate\([^,]+,\s*locale\b/g)?.length ?? 0;
assert.equal(workspaceLocaleDateCalls, workspaceDateCalls, "Every Video Development date formatter must receive the active locale.");
has("page", /useWorkspaceLocale[\s\S]*ar-JO/, "Video Intelligence dates must follow the active English or Arabic locale.");
assert.doesNotMatch(files.page, /formatDate\([^,]+,\s*['"](?:en-US|ar-JO)['"]/, "Video Intelligence must not force a fixed date locale.");
const pageDateCalls = files.page.match(/formatDate\(/g)?.length ?? 0;
const pageLocaleDateCalls = files.page.match(/formatDate\([^,]+,\s*locale\b/g)?.length ?? 0;
assert.equal(pageLocaleDateCalls, pageDateCalls, "Every Video Intelligence date formatter must receive the active locale.");
has("page", /useVideoRelease3Access[\s\S]*developmentAccess\.data\?\.enabled[\s\S]*developmentAccess\.data\.canManage[\s\S]*VideoDevelopmentWorkspace/, "Coach workspace must be server-gated by Batch 3 access");
assert.doesNotMatch(files.persona, /video-intelligence/, "Guardian navigation must not gain Batch 3 access");
has("arabic", /ولي الأمر/, "Arabic Guardian copy must use the established ولي الأمر terminology");

console.log("Verified Batch 3 approved-only development intelligence, Coach-only access, bilingual reports, rollback, and Release 1/2 preservation");