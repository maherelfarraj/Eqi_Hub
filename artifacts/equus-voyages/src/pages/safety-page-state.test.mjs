import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, hook, app, shell, persona, english, arabic, migration] =
  await Promise.all([
    readFile(new URL("./SafetyPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../hooks/use-compliance.ts", import.meta.url), "utf8"),
    readFile(new URL("../App.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/AppShell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/portal-persona.ts", import.meta.url), "utf8"),
    readFile(new URL("../i18n/en.json", import.meta.url), "utf8"),
    readFile(new URL("../i18n/ar.json", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../../../../supabase/migrations/20260815135957_batch4_medical_waiver_gate.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

test("safety and waiver route is available to rider, guardian, and academy admin", () => {
  assert.match(app, /path="\/safety"/);
  assert.match(shell, /path: "\/safety", labelKey: "nav\.safety"/);
  assert.match(shell, /path !== "\/safety"[\s\S]*?hasRole\("rider"\)/);
  assert.match(persona, /guardianNavigationPaths[\s\S]*?"\/safety"/);
  assert.match(persona, /academyAdminNavigationPaths[\s\S]*?"\/safety"/);
});

test("digital signature binds typed consent to the exact template hash", () => {
  assert.match(page, /typedName/);
  assert.match(page, /explicitConsent/);
  assert.match(hook, /document\.contentHash\}:equivista-explicit-consent-v1/);
  assert.match(hook, /"sign_compliance_document"/);
  assert.match(migration, /signature\.document_hash = template\.content_hash/);
});

test("minor, medical review, lesson, and renewal gates remain visible", () => {
  assert.match(page, /dateOfBirth/);
  assert.match(page, /medicalAttention/);
  assert.match(page, /reviewMedical/);
  assert.match(page, /lessonReady/);
  assert.match(page, /renewalReady/);
  assert.match(migration, /A verified legal guardian must sign for a minor/);
  assert.match(migration, /create trigger lessons_require_compliance/);
  assert.match(migration, /create trigger memberships_require_compliance/);
});

test("medical answers stay outside Guardian View and bilingual copy is complete", () => {
  const en = JSON.parse(english).translation.safety;
  const ar = JSON.parse(arabic).translation.safety;
  for (const copy of [en, ar]) {
    assert.ok(copy.title);
    assert.ok(copy.medicalAttention);
    assert.ok(copy.explicitConsent);
    assert.ok(copy.admin.reviewRequired);
  }
  assert.doesNotMatch(
    migration,
    /get_guardian_portal[\s\S]*?rider_compliance_submissions/,
  );
});
