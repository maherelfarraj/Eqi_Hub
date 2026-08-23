import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const migrationPath = resolve(
  root,
  "supabase/migrations/20260816090000_enhanced_video_review_foundation.sql",
);
const rollbackPath = resolve(
  root,
  "supabase/rollback/20260816090000_enhanced_video_review_foundation_rollback.sql",
);
const configPath = resolve(root, "supabase/config.toml");
const hookPath = resolve(
  root,
  "artifacts/equus-voyages/src/hooks/use-video-reviews.ts",
);
const pagePath = resolve(
  root,
  "artifacts/equus-voyages/src/pages/VideoReviewPage.tsx",
);

function transactional(sql) {
  return /^\s*(?:--[^\n]*\n)*begin;/i.test(sql) && /commit;\s*$/i.test(sql);
}

export function validateVideoReviewFoundation({
  migration,
  rollback,
  config,
  hook,
  page,
}) {
  const errors = [];
  if (!transactional(migration)) errors.push("migration must be transactional");
  if (!transactional(rollback)) errors.push("rollback must be transactional");
  if (/auth\.role\s*\(/i.test(`${migration}\n${rollback}`)) {
    errors.push("must not use deprecated auth.role()");
  }
  if (
    /create policy [^\n]+\s*\non [^\n]+\s+for [^\n]+\s+to\s+(?:public|anon)\b/i.test(
      migration,
    )
  ) {
    errors.push("video review policies must not target public or anon");
  }
  if (/using\s*\(\s*true\s*\)|with check\s*\(\s*true\s*\)/i.test(migration)) {
    errors.push("video review RLS policies must not be unconditional");
  }
  if (!/\[storage\.buckets\."video-reviews"\]\s+public = false/m.test(config)) {
    errors.push("video-reviews must be declared as a private bucket");
  }

  for (const table of [
    "video_review_sessions",
    "video_review_clips",
    "video_review_annotations",
    "video_review_activity_events",
  ]) {
    if (!new RegExp(`create table public\\.${table}\\s*\\(`, "i").test(migration)) {
      errors.push(`missing ${table} table`);
    }
    if (
      !new RegExp(
        `alter table public\\.${table} enable row level security;`,
        "i",
      ).test(migration)
    ) {
      errors.push(`${table} must enable RLS`);
    }
    if (!new RegExp(`drop table if exists public\\.${table};`, "i").test(rollback)) {
      errors.push(`${table} rollback is missing`);
    }
  }

  const requiredGuards = [
    [/consent_status text not null default 'pending'/, "explicit consent state is required"],
    [/retention_state text not null default 'active'/, "retention state is required"],
    [/review_status text not null default 'draft'/, "review approval state is required"],
    [/streaming_storage_path text unique/, "streaming derivative metadata is required"],
    [/thumbnail_storage_path text unique/, "thumbnail metadata is required"],
    [/keyframe_timeline jsonb/, "keyframe timeline metadata is required"],
    [/slow_motion_rates jsonb/, "slow-motion playback metadata is required"],
    [/annotation_type in \('tag', 'text', 'voice', 'drawing', 'frame'\)/, "manual annotation types are required"],
    [/action in \('upload', 'view', 'download', 'edit', 'approve', 'share', 'delete'\)/, "complete activity audit actions are required"],
    [/consent must be granted before coach approval/, "coach approval must fail closed on consent"],
    [/new\.consent_status := 'pending';/, "new reviews must start with pending consent"],
    [/only an assigned coach may approve video review output/, "approval must be restricted to assigned coaches"],
    [/create function private\.invalidate_video_review_approval/, "post-approval content must invalidate coach approval"],
    [/perform private\.invalidate_video_review_approval\(new\.session_id\);/, "clip changes must require coach re-approval"],
    [/new\.visibility = 'approved_audience'/, "audience annotation changes must require coach re-approval"],
    [/private\.can_guardian_access_rider/, "guardian reads must use verified-link access"],
    [/private\.can_read_approved_video_review/, "rider/guardian output must be approval-gated"],
    [/private\.video_review_audience_visible\(session\)/, "audience reads must require a coach-approved session"],
    [/video review rider must have an active rider membership in this organization/, "rider context must be tenant-scoped"],
    [/video review horse must belong to this organization/, "horse context must be tenant-scoped"],
    [/video review lesson must belong to this organization, rider, and horse context/, "lesson context must be tenant-scoped"],
    [/grant execute on function private\.can_manage_video_review\(uuid, uuid\) to authenticated;/, "RLS helper execution grant is required"],
    [/revoke all on function private\.invalidate_video_review_approval\(uuid\) from public, anon, authenticated, service_role;/, "internal approval invalidation must not be client-callable"],
    [/v_actor_id := coalesce\(\(select auth\.uid\(\)/, "audit events must attribute the current actor"],
    [/private\.can_manage_video_review_storage_path/, "private storage path authorization is required"],
    [/video_review_storage_read_approved_derivatives/, "approved derivative storage policy is required"],
    [/record_video_review_activity/, "view/download/share activity RPC is required"],
    [/create trigger video_review_session_audit/, "session audit trigger is required"],
    [/create trigger video_review_clip_audit/, "clip audit trigger is required"],
    [/create trigger video_review_annotation_audit/, "annotation audit trigger is required"],
    [/create trigger video_review_annotation_prepare/, "annotation tenant-consistency trigger is required"],
    [/video review annotation clip must belong to its organization/, "annotation clip must be tenant-scoped"],
  ];
  for (const [pattern, message] of requiredGuards) {
    if (!pattern.test(migration)) errors.push(message);
  }

  if (/create policy video_review_activity_\w+[\s\S]*?for\s+(?:insert|update|delete)/i.test(migration)) {
    errors.push("activity audit must be append-only to clients");
  }
  if (/getPublicUrl|publicUrl/i.test(hook)) {
    errors.push("client must not generate public video URLs");
  }
  if (!/createSignedUrl\(path, 300\)/.test(hook)) {
    errors.push("client must use short-lived signed playback URLs");
  }
  if (!/processing_status: "failed"/.test(hook)) {
    errors.push("failed uploads must enter an explicit failure state");
  }
  if (
    !/No public links or public analytics/.test(page) ||
    !/does not run AI, gait, YOLO, soundness, medical, or safety analysis/.test(page)
  ) {
    errors.push("UI must communicate the private, non-AI release boundary");
  }
  if (!/Record consent/.test(page) || !/Coach approve output/.test(page)) {
    errors.push("UI must expose consent and coach approval states");
  }
  return errors;
}

const [migration, rollback, config, hook, page] = await Promise.all([
  readFile(migrationPath, "utf8"),
  readFile(rollbackPath, "utf8"),
  readFile(configPath, "utf8"),
  readFile(hookPath, "utf8"),
  readFile(pagePath, "utf8"),
]);
const errors = validateVideoReviewFoundation({
  migration,
  rollback,
  config,
  hook,
  page,
});
if (errors.length) {
  throw new Error(`Video review foundation validation failed:\n- ${errors.join("\n- ")}`);
}
console.log("Verified private video review schema, RLS, storage, audit, and UI boundaries");