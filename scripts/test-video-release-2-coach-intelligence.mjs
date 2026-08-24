import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const migrationPath = resolve(
  root,
  "supabase/migrations/20260824103000_video_release_2_coach_intelligence.sql",
);
const rollbackPath = resolve(
  root,
  "supabase/rollback/20260824103000_video_release_2_coach_intelligence_rollback.sql",
);
const hookPath = resolve(
  root,
  "artifacts/equus-voyages/src/hooks/use-video-release-2.ts",
);
const pagePath = resolve(
  root,
  "artifacts/equus-voyages/src/pages/VideoIntelligencePage.tsx",
);
const shellPath = resolve(
  root,
  "artifacts/equus-voyages/src/components/AppShell.tsx",
);
const personaPath = resolve(
  root,
  "artifacts/equus-voyages/src/lib/portal-persona.ts",
);

const [migration, rollback, hook, page, shell, persona] = await Promise.all([
  readFile(migrationPath, "utf8"),
  readFile(rollbackPath, "utf8"),
  readFile(hookPath, "utf8"),
  readFile(pagePath, "utf8"),
  readFile(shellPath, "utf8"),
  readFile(personaPath, "utf8"),
]);

const mustContain = (text, pattern, description) => {
  assert.match(text, pattern, description);
};

mustContain(
  migration,
  /create table public\.video_release_2_feature_flags[\s\S]*enabled boolean not null default false/,
  "Release 2 must default to disabled per organization",
);
mustContain(
  migration,
  /create table public\.video_release_2_pilot_participants[\s\S]*adult_verified boolean not null default false/,
  "adult-rider pilot enrollment must be explicit",
);
mustContain(
  migration,
  /private\.video_release_2_adult_rider[\s\S]*participant_role = 'rider'[\s\S]*participant\.adult_verified/,
  "Rider reads must require adult pilot enrollment",
);
mustContain(
  migration,
  /private\.can_manage_video_release_2[\s\S]*member_role\.role = 'coach'[\s\S]*participant\.participant_role = 'coach'/,
  "coach access must require an enrolled active coach participant",
);
mustContain(
  migration,
  /private\.can_manage_video_release_2_session[\s\S]*p_session\.coach_id = p_user_id[\s\S]*private\.can_coach_video_release_2_rider/,
  "private session workspaces must be limited to the assigned coach",
);
assert.doesNotMatch(
  migration,
  /create policy video_release_2_sessions_staff_update|create policy video_release_2_revisions_staff_update|create policy video_release_2_clips_staff_update/,
  "direct client table updates must not bypass guarded Release 2 RPCs",
);
mustContain(
  migration,
  /private\.can_read_approved_video_release_2[\s\S]*p_user_id = p_rider_id/,
  "approved feedback must be restricted to the rider themself",
);
mustContain(
  migration,
  /review_status = 'approved'[\s\S]*consent_status = 'granted'[\s\S]*retention_state = 'active'/,
  "Rider-visible sessions must be approved, consented, and retained",
);
mustContain(
  migration,
  /unique \(organization_id, checksum_sha256\)/,
  "private clips must deduplicate checksums per tenant",
);
mustContain(
  migration,
  /mime_type in \('video\/mp4', 'video\/quicktime', 'video\/webm'\)[\s\S]*byte_size > 0 and byte_size <= 524288000[\s\S]*duration_ms > 0 and duration_ms <= 28800000/,
  "clip metadata limits must be enforced in the database",
);
mustContain(
  migration,
  /Private storage metadata must match the registered clip/,
  "a clip cannot be confirmed unless private object metadata matches registration",
);
mustContain(
  migration,
  /record_video_release_2_consent[\s\S]*retention_state = case when p_granted then retention_state else 'deleted' end[\s\S]*delete from storage\.objects[\s\S]*set upload_state = 'deleted'/,
  "consent withdrawal must delete private objects and retire clip records",
);
mustContain(
  migration,
  /p_granted and v_session\.retention_state <> 'active'[\s\S]*cannot be reactivated[\s\S]*v_session\.consent_status <> 'granted' or v_session\.retention_state <> 'active'/,
  "deleted sessions must not be re-consented or accept new uploads",
);
mustContain(
  migration,
  /video_release_2_revision_visible[\s\S]*session\.consent_status = 'granted'[\s\S]*session\.retention_state = 'active'[\s\S]*Active adult-rider consent is required before a review draft can be created[\s\S]*Not allowed to edit this review revision/,
  "withdrawn sessions must not expose, create, or mutate coach drafts",
);
mustContain(
  migration,
  /can_manage_video_release_2_storage_path[\s\S]*session\.consent_status = 'granted'[\s\S]*session\.retention_state = 'active'/,
  "private storage reads must stop immediately when consent or retention is inactive",
);
mustContain(
  migration,
  /\(object\.metadata ->> 'size'\)::bigint[\s\S]*object\.metadata ->> 'mimetype'[\s\S]*v_object_size <> v_clip\.byte_size[\s\S]*v_object_mime_type <> v_clip\.mime_type/,
  "storage confirmation must verify server-held file size and MIME metadata",
);
mustContain(
  migration,
  /'video-release-2', 'video-release-2', false, 524288000/,
  "Release 2 storage must remain private",
);
mustContain(
  migration,
  /create policy video_release_2_storage_authorized_upload[\s\S]*private\.can_upload_video_release_2_storage_path/,
  "storage upload policy must use the private path guard",
);
mustContain(
  migration,
  /Only the assigned coach can approve this draft[\s\S]*Consent and active retention are required before coach approval/,
  "approval must require the assigned coach and consent",
);
mustContain(
  migration,
  /v_session\.rider_id <> auth\.uid\(\)[\s\S]*Not allowed to record consent/,
  "only the adult rider can grant or withdraw their session consent",
);
mustContain(
  migration,
  /p_first_session_id[\s\S]*review_status = 'approved'[\s\S]*consent_status = 'granted'[\s\S]*retention_state = 'active'[\s\S]*p_second_session_id[\s\S]*review_status = 'approved'[\s\S]*consent_status = 'granted'[\s\S]*retention_state = 'active'/,
  "both comparison sessions must stay approved, consented, and retained",
);
mustContain(
  migration,
  /p_first_session_id[\s\S]*private\.can_manage_video_release_2_session\(session\)[\s\S]*p_second_session_id[\s\S]*private\.can_manage_video_release_2_session\(session\)/,
  "coach comparison access must be scoped to both assigned sessions",
);
mustContain(
  migration,
  /get_video_release_2_trend[\s\S]*private\.can_manage_video_release_2_session\(session\)/,
  "coach trend output must be scoped to their own assigned sessions",
);
mustContain(
  migration,
  /Course tags must reference a clip in the same review session[\s\S]*Stride observations must reference a clip in the same review session/,
  "draft annotations must not reference clips from another session",
);
mustContain(
  migration,
  /All five coach scorecard domains are required before approval/,
  "approval must fail closed until the complete scorecard is present",
);
mustContain(
  migration,
  /get_video_release_2_approved_feedback[\s\S]*Approved feedback is only available to enrolled adult riders/,
  "approved-feedback RPC must deny parents and non-pilot users",
);
mustContain(
  migration,
  /get_video_release_2_comparison[\s\S]*Approved same-rider comparison is not available/,
  "comparison must be an approved same-rider output",
);
mustContain(
  migration,
  /get_video_release_2_trend[\s\S]*Approved trend is not available/,
  "trend output must remain approval gated",
);
mustContain(
  rollback,
  /drop table if exists public\.video_release_2_sessions/,
  "the paired rollback must remove Release 2 tables",
);
assert.doesNotMatch(
  rollback,
  /video_review_sessions|video_review_clips|video_review_annotations/,
  "the Release 2 rollback must not disturb Release 1",
);
mustContain(
  hook,
  /crypto\.subtle\.digest\("SHA-256"/,
  "the client must calculate a checksum before registration",
);
mustContain(
  hook,
  /from\("video-release-2"\)\s*\.upload/,
  "the client must upload only to the private Release 2 bucket",
);
assert.doesNotMatch(
  hook,
  /getPublicUrl\(/,
  "the client must not produce public clip URLs",
);
mustContain(
  page,
  /const domains = \[[\s\S]*"approach"[\s\S]*"between_fences"/,
  "the coaching UI must cover all server-defined scorecard domains",
);
mustContain(
  page,
  /Explicitly Approve & Release/,
  "the UI must make the approval action explicit",
);
mustContain(
  page,
  /const consentRecorded = await actions\.recordConsent\(sessionId, true\);[\s\S]*if \(!consentRecorded\) return;/,
  "Rider upload must stop if recording consent fails",
);
mustContain(
  hook,
  /\.createSignedUrl\(storagePath, 300\)/,
  "coach playback must use a short-lived private signed URL",
);
mustContain(
  page,
  /Play private clip[\s\S]*<video[^>]+controls/,
  "the coach workspace must provide private clip playback before review",
);
mustContain(
  rollback,
  /can_upload_video_release_2_session\(public\.video_release_2_sessions, uuid\)[\s\S]*can_manage_video_release_2_session\(public\.video_release_2_sessions, uuid\)[\s\S]*can_coach_video_release_2_rider/,
  "rollback must remove the actual session-scoped helper dependencies before tables",
);
mustContain(
  shell,
  /path !== "\/video-intelligence"[\s\S]*videoRelease2Access\.data\?\.canManage/,
  "navigation must hide Release 2 unless server-derived access permits it",
);
mustContain(
  persona,
  /guardianNavigationPaths = new Set\(\[[\s\S]*"\/video-review"[\s\S]*\]\)/,
  "Guardian navigation remains unchanged and does not include Release 2",
);

console.log(
  "Verified Video Release 2 pilot flag, adult-only approval boundary, tenant isolation, private storage, and Release 1 preservation",
);