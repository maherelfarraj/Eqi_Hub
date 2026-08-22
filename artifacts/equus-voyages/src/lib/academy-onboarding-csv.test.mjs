import assert from "node:assert/strict";
import test from "node:test";
import {
  academyInvitationExportCsv,
  academyOnboardingTemplateCsv,
  parseAcademyOnboardingCsv,
} from "./academy-onboarding-csv.mjs";

test("parses quoted academy onboarding CSV and normalizes roles", () => {
  const result = parseAcademyOnboardingCsv(
    'email,full_name,roles\nRIDER@example.com,"Rider, One",guardian|rider|rider',
  );
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.entries, [
    {
      email: "rider@example.com",
      fullName: "Rider, One",
      roles: ["guardian", "rider"],
    },
  ]);
});

test("rejects duplicate emails and privilege-escalating roles", () => {
  const result = parseAcademyOnboardingCsv(
    "email,full_name,roles\na@example.com,First Rider,rider\nA@example.com,Second Rider,academy_admin",
  );
  assert.equal(result.entries.length, 2);
  assert.match(
    result.errors.map((error) => error.message).join("\n"),
    /duplicated[\s\S]*Unsupported role/,
  );
});

test("template round-trips and generated exports contain one-time links", () => {
  const parsed = parseAcademyOnboardingCsv(academyOnboardingTemplateCsv());
  assert.equal(parsed.entries.length, 3);
  assert.deepEqual(parsed.errors, []);

  const csv = academyInvitationExportCsv(
    [
      {
        email: "rider@example.com",
        fullName: "Example Rider",
        roles: ["rider"],
        inviteToken: "a".repeat(64),
        expiresAt: "2026-08-29T00:00:00Z",
      },
    ],
    "https://www.equivista.net/",
  );
  assert.match(csv, /https:\/\/www\.equivista\.net\/auth\?invite=a{64}/);
});
