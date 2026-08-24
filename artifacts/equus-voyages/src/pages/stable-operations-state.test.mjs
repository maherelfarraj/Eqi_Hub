import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, previewHook, consoleHook, app, shell, persona, en, ar] = await Promise.all([
  readFile(new URL("./StableOperationsPage.tsx", import.meta.url), "utf8"),
  readFile(new URL("../hooks/use-stable-operations-preview.ts", import.meta.url), "utf8"),
  readFile(new URL("../hooks/use-stable-operations-console.ts", import.meta.url), "utf8"),
  readFile(new URL("../App.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/AppShell.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/portal-persona.ts", import.meta.url), "utf8"),
  readFile(new URL("../i18n/en.json", import.meta.url), "utf8"),
  readFile(new URL("../i18n/ar.json", import.meta.url), "utf8"),
]);

test("stable operations route is registered", () => {
  assert.match(app, /<Route[\s\S]*path="\/stable-operations"[\s\S]*StableOperationsPage/);
});

test("staff console uses guarded workflow RPCs while audiences remain on safe availability", () => {
  assert.match(page, /useStableOperationsPreview/);
  assert.match(page, /useStableOperationsConsole/);
  assert.doesNotMatch(page, /useHorses/);
  assert.match(
    previewHook,
    /if \(canViewStaffPreview\) \{[\s\S]*?get_stable_operations_roster/,
  );
  assert.match(previewHook, /get_stable_operations_roster/);
  assert.match(previewHook, /get_safe_horse_availability/);
  assert.doesNotMatch(previewHook, /\.from\("horses"\)/);
  assert.match(page, /if \(!canManage\)/);
  assert.match(page, /safeAvailability/);
  assert.match(page, /releaseHold/);
  assert.match(page, /checkAssignmentEligibility/);
  for (const rpc of [
    "update_horse_operation_profile",
    "create_horse_operation_hold",
    "release_horse_operation_hold",
    "upsert_horse_care_schedule",
    "complete_horse_care_schedule",
    "create_stable_task",
    "update_stable_task_workflow",
    "check_horse_assignment_eligibility",
  ]) {
    assert.match(consoleHook, new RegExp(rpc));
  }
  assert.doesNotMatch(page, /\.(?:insert|update|delete|upsert)\s*\(/);
});

test("translations exist", () => {
  const enTranslations = JSON.parse(en).translation;
  const arTranslations = JSON.parse(ar).translation;
  assert.ok(enTranslations.stableOperations);
  assert.ok(enTranslations.stableOperations.tabs.audit);
  assert.ok(enTranslations.stableOperations.actions.releaseHold);
  assert.ok(enTranslations.stableOperations.options.tack_equipment);
  assert.ok(enTranslations.nav.stableOperations);
  assert.ok(arTranslations.stableOperations);
  assert.ok(arTranslations.stableOperations.tabs.audit);
  assert.ok(arTranslations.stableOperations.actions.releaseHold);
  assert.ok(arTranslations.stableOperations.options.tack_equipment);
  assert.ok(arTranslations.nav.stableOperations);
});

test("navigation includes stable operations", () => {
  assert.match(shell, /path: "\/stable-operations"/);
  assert.match(persona, /guardianNavigationPaths[\s\S]*?"\/stable-operations"/);
});
