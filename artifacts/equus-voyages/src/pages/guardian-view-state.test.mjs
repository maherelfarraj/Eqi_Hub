import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, hook, app, shell, english, arabic] = await Promise.all([
  readFile(new URL("./GuardianViewPage.tsx", import.meta.url), "utf8"),
  readFile(new URL("../hooks/use-guardian-view.ts", import.meta.url), "utf8"),
  readFile(new URL("../App.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/AppShell.tsx", import.meta.url), "utf8"),
  readFile(new URL("../i18n/en.json", import.meta.url), "utf8"),
  readFile(new URL("../i18n/ar.json", import.meta.url), "utf8"),
]);

test("guardian view is role-gated and supports multiple linked riders", () => {
  assert.match(app, /path="\/guardian"/);
  assert.match(shell, /isNavigationPathVisible\(/);
  assert.match(shell, /portalRedirect\(portalPersona, location\.pathname\)/);
  assert.match(hook, /\.from\("guardian_riders"\)/);
  assert.match(hook, /\.eq\("guardian_id", guardianId\)/);
  assert.match(page, /setRiderId\(link\.riderId\)/);
});

test("guardian portal uses guarded RPCs and never queries private notes", () => {
  assert.match(hook, /"get_guardian_portal"/);
  assert.match(
    hook,
    /p_organization_id: requireOrganizationId\(organizationId\)/,
  );
  assert.match(hook, /"respond_guardian_approval"/);
  assert.match(hook, /p_decision: decision/);
  assert.doesNotMatch(`${hook}\n${page}`, /lesson_development_private_notes/);
});

test("guardian view is read-only except explicit approval decisions", () => {
  assert.match(page, /approval\.status === "pending"/);
  assert.match(page, /actions\.respond\(approval\.id, "approved"\)/);
  assert.match(page, /actions\.respond\(approval\.id, "declined"\)/);
  assert.match(page, /relationship\.permissions\.viewFinancials/);
  assert.match(page, /accessHistory\.slice\(0, 8\)/);
  assert.doesNotMatch(
    page,
    /update.*RiderSync|award_rider_badge|save_lesson_development/,
  );
});

test("guardian copy is complete in English and Arabic", () => {
  const en = JSON.parse(english).translation.guardianView;
  const ar = JSON.parse(arabic).translation.guardianView;
  assert.equal(en.title, "Guardian View");
  assert.equal(ar.title, "بوابة ولي الأمر");
  for (const copy of [en, ar]) {
    assert.equal(Object.keys(copy.approvalTypes).length, 4);
    assert.equal(Object.keys(copy.relationships).length, 4);
    assert.ok(copy.privateBoundary);
    assert.ok(copy.weeklySummary);
    assert.equal(Object.keys(copy.eventTypes).length, 8);
  }
});
