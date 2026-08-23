import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateVideoReviewFoundation } from "./verify-video-review-foundation.mjs";

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

const [migration, rollback, config, hook, page] = await Promise.all([
  readFile(migrationPath, "utf8"),
  readFile(rollbackPath, "utf8"),
  readFile(configPath, "utf8"),
  readFile(hookPath, "utf8"),
  readFile(pagePath, "utf8"),
]);
const fixture = { migration, rollback, config, hook, page };

assert.deepEqual(validateVideoReviewFoundation(fixture), []);

assert.match(
  validateVideoReviewFoundation({
    ...fixture,
    migration: migration.replaceAll(
      "private.video_review_audience_visible(session)",
      "true",
    ),
  }).join("\n"),
  /audience reads must require a coach-approved session/,
);

assert.match(
  validateVideoReviewFoundation({
    ...fixture,
    hook: hook.replace("createSignedUrl(path, 300)", "getPublicUrl(path)"),
  }).join("\n"),
  /must not generate public video URLs/,
);

assert.match(
  validateVideoReviewFoundation({
    ...fixture,
    migration: migration.replace(
      "consent must be granted before coach approval",
      "approval prerequisite removed",
    ),
  }).join("\n"),
  /coach approval must fail closed on consent/,
);

assert.match(
  validateVideoReviewFoundation({
    ...fixture,
    migration: migration.replace(
      "video review rider must have an active rider membership in this organization",
      "rider membership validation removed",
    ),
  }).join("\n"),
  /rider context must be tenant-scoped/,
);

assert.match(
  validateVideoReviewFoundation({
    ...fixture,
    migration: migration.replace(
      "new.consent_status := 'pending';",
      "consent initialization removed;",
    ),
  }).join("\n"),
  /new reviews must start with pending consent/,
);

assert.match(
  validateVideoReviewFoundation({
    ...fixture,
    migration: migration.replace(
      "video review annotation clip must belong to its organization",
      "annotation scope validation removed",
    ),
  }).join("\n"),
  /annotation clip must be tenant-scoped/,
);

assert.match(
  validateVideoReviewFoundation({
    ...fixture,
    migration: migration.replace(
      "perform private.invalidate_video_review_approval(new.session_id);",
      "approval invalidation removed;",
    ),
  }).join("\n"),
  /clip changes must require coach re-approval/,
);

assert.match(
  validateVideoReviewFoundation({
    ...fixture,
    migration: migration.replace(
      "revoke all on function private.invalidate_video_review_approval(uuid) from public, anon, authenticated, service_role;",
      "invalidation revoke removed;",
    ),
  }).join("\n"),
  /internal approval invalidation must not be client-callable/,
);

console.log("Verified video review regression guards reject public and approval-bypass variants");