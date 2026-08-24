import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, previewHook, app, shell, persona, en, ar] = await Promise.all([
  readFile(new URL("./StableOperationsPage.tsx", import.meta.url), "utf8"),
  readFile(new URL("../hooks/use-stable-operations-preview.ts", import.meta.url), "utf8"),
  readFile(new URL("../App.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/AppShell.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/portal-persona.ts", import.meta.url), "utf8"),
  readFile(new URL("../i18n/en.json", import.meta.url), "utf8"),
  readFile(new URL("../i18n/ar.json", import.meta.url), "utf8"),
]);

test("stable operations route is registered", () => {
  assert.match(app, /<Route[\s\S]*path="\/stable-operations"[\s\S]*StableOperationsPage/);
});

test("stable operations page uses persona-scoped safe hooks and read-only notice", () => {
  assert.match(page, /useStableOperationsPreview/);
  assert.doesNotMatch(page, /useHorses/);
  assert.match(
    previewHook,
    /if \(canViewStaffPreview\) \{[\s\S]*?get_stable_operations_roster/,
  );
  assert.match(previewHook, /get_stable_operations_roster/);
  assert.match(previewHook, /get_safe_horse_availability/);
  assert.doesNotMatch(previewHook, /\.from\("horses"\)/);
  assert.doesNotMatch(page, /useMutation/);
  assert.doesNotMatch(page, /useUpsertHorse/);
  assert.doesNotMatch(page, /\.(?:insert|update|delete|upsert)\s*\(/);
  assert.match(page, /preview/i);
});

test("translations exist", () => {
  const enTranslations = JSON.parse(en).translation;
  const arTranslations = JSON.parse(ar).translation;
  assert.ok(enTranslations.stableOperations);
  assert.ok(enTranslations.nav.stableOperations);
  assert.ok(arTranslations.stableOperations);
  assert.ok(arTranslations.nav.stableOperations);
});

test("navigation includes stable operations", () => {
  assert.match(shell, /path: "\/stable-operations"/);
  assert.match(persona, /guardianNavigationPaths[\s\S]*?"\/stable-operations"/);
});
