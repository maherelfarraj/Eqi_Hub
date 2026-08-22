import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [organization, onboarding, auth, app, hook, english, arabic] =
  await Promise.all([
    readFile(new URL("./OrganizationPage.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../components/AcademyOnboarding.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("./AuthPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../App.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../hooks/use-academy-onboarding.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../i18n/en.json", import.meta.url), "utf8"),
    readFile(new URL("../i18n/ar.json", import.meta.url), "utf8"),
  ]);

test("academy onboarding is restricted to organization managers", () => {
  assert.match(organization, /\{canManage \? \([\s\S]*?<AcademyOnboarding/);
  assert.match(onboarding, /preview\(organizationId, entries\)/);
  assert.match(hook, /preview_academy_onboarding/);
  assert.match(hook, /create_academy_onboarding_batch/);
});

test("invitation creation requires a successful dry run", () => {
  assert.match(onboarding, /!preview\?\.valid/);
  assert.match(onboarding, /localErrors\.length > 0/);
  assert.match(onboarding, /academyInvitationExportCsv/);
  assert.doesNotMatch(onboarding, /academy_admin/);
});

test("authentication preserves the one-time invitation claim", () => {
  assert.match(auth, /\/onboarding\/accept\?invite=/);
  assert.match(app, /path="\/onboarding\/accept"/);
  assert.match(hook, /claim_academy_onboarding_invitation/);
});

test("onboarding copy is complete in English and Arabic", () => {
  const en = JSON.parse(english).translation.organization.onboarding;
  const ar = JSON.parse(arabic).translation.organization.onboarding;
  for (const key of [
    "title",
    "description",
    "dryRun",
    "createInvitations",
    "secretWarning",
    "acceptTitle",
    "invalidInvite",
  ]) {
    assert.equal(typeof en[key], "string");
    assert.equal(typeof ar[key], "string");
    assert.ok(en[key].length > 0);
    assert.ok(ar[key].length > 0);
  }
});
