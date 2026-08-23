import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [component, hook, english, arabic] = await Promise.all([
  readFile(
    new URL("../components/AcademyOnboarding.tsx", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("../hooks/use-academy-onboarding.ts", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../i18n/en.json", import.meta.url), "utf8"),
  readFile(new URL("../i18n/ar.json", import.meta.url), "utf8"),
]);

test("Batch 22 exposes metrics, lifecycle monitoring, and audit activity", () => {
  for (const rpc of [
    "get_academy_onboarding_metrics",
    "get_academy_onboarding_activity",
    "get_academy_onboarding_invitations",
    "reissue_academy_onboarding_invitation",
    "revoke_academy_onboarding_invitation",
  ]) {
    assert.match(hook, new RegExp(rpc));
  }
  assert.match(component, /metrics\.data\?\.pendingInvitations/);
  assert.match(component, /invitationStatuses\.\$\{invitation\.status\}/);
  assert.match(component, /auditActivity/);
});

test("replacement links are one-time downloads and are not sent by the frontend", () => {
  assert.match(component, /academyInvitationExportCsv\(\s*\[replacement\]/);
  assert.match(component, /equivista-replacement-invitation-/);
  assert.doesNotMatch(
    `${component}\n${hook}`,
    /sendEmail|send_email|pg_net|fetch\([^)]*mail|resend\.emails/i,
  );
});

test("Batch 22 operations copy is complete in English and Arabic", () => {
  const en = JSON.parse(english).translation.organization.onboarding;
  const ar = JSON.parse(arabic).translation.organization.onboarding;
  for (const key of [
    "viewInvitations",
    "invitationMonitor",
    "selectBatch",
    "generateReplacement",
    "revokeInvitation",
    "auditActivity",
    "noActivity",
  ]) {
    assert.equal(typeof en[key], "string");
    assert.equal(typeof ar[key], "string");
    assert.ok(en[key].length > 0);
    assert.ok(ar[key].length > 0);
  }
  assert.deepEqual(
    Object.keys(en.metrics).sort(),
    Object.keys(ar.metrics).sort(),
  );
  assert.deepEqual(
    Object.keys(en.invitationStatuses).sort(),
    Object.keys(ar.invitationStatuses).sort(),
  );
  assert.deepEqual(
    Object.keys(en.actions).sort(),
    Object.keys(ar.actions).sort(),
  );
});
