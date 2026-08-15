import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [progressPage, dashboardPage, component, hook, lessonComponent, lessonHook, english, arabic] =
  await Promise.all([
    readFile(new URL("./ProgressPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("./DashboardPage.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../components/RiderSyncDashboard.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../hooks/use-rider-sync.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/LessonDevelopment.tsx", import.meta.url), "utf8"),
    readFile(new URL("../hooks/use-lessons.ts", import.meta.url), "utf8"),
    readFile(new URL("../i18n/en.json", import.meta.url), "utf8"),
    readFile(new URL("../i18n/ar.json", import.meta.url), "utf8"),
  ]);

test("RiderSync replaces the analysis-derived tier and appears on both rider surfaces", () => {
  assert.match(progressPage, /<RiderSyncDashboard \/>/);
  assert.match(dashboardPage, /<RiderSyncDashboard compact/);
  assert.doesNotMatch(progressPage, /derivedTier|performanceLadder/);
});
test("RiderSync uses the guarded organization-scoped RPC", () => {
  assert.match(hook, /"get_rider_sync_dashboard"/);
  assert.match(hook, /p_organization_id: scopedOrganizationId/);
  assert.match(hook, /p_rider_id: riderId/);
  assert.doesNotMatch(hook, /lesson_development_private_notes/);
});
test("the UI exposes all six approved score weights and motivation boundaries", () => {
  for (const weight of [25, 20, 20, 20, 10, 5])
    assert.match(component, new RegExp(`, ${weight}\\]`));
  assert.match(component, /privateBaseline/);
  assert.match(component, /safetyNote/);
  assert.match(component, /AI may suggest an achievement|badgesHelp/);
});
test("authorized coaches approve evidence-backed badges from lesson closeout", () => {
  assert.match(lessonComponent, /\["coach", "academy_admin", "stable_manager"\]/);
  assert.match(lessonComponent, /report\.status === "approved"/);
  assert.match(lessonComponent, /useRiderBadgeCatalog/);
  assert.match(lessonHook, /"award_rider_badge"/);
  assert.match(lessonHook, /p_evidence_report_id: evidenceReportId/);
});
test("RiderSync copy is complete in English and Arabic", () => {
  const en = JSON.parse(english).translation.riderSync;
  const ar = JSON.parse(arabic).translation.riderSync;
  assert.equal(en.title, "RiderSync Journey");
  assert.equal(ar.title, "رحلة RiderSync");
  for (const copy of [en, ar]) {
    assert.equal(Object.keys(copy.components).length, 6);
    assert.equal(Object.keys(copy.stages).length, 5);
    assert.ok(copy.safetyNote);
    assert.ok(copy.privateBaseline);
  }
});
