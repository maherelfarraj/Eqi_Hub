import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [persona, shell, dashboard, english, arabic] = await Promise.all([
  readFile(new URL("../lib/portal-persona.ts", import.meta.url), "utf8"),
  readFile(new URL("../components/AppShell.tsx", import.meta.url), "utf8"),
  readFile(new URL("./DashboardPage.tsx", import.meta.url), "utf8"),
  readFile(new URL("../i18n/en.json", import.meta.url), "utf8"),
  readFile(new URL("../i18n/ar.json", import.meta.url), "utf8"),
]);

test("active organization persona gives academy admin precedence", () => {
  assert.match(
    persona,
    /activeOrganizationRoles\.includes\("academy_admin"\)[\s\S]*return "academy_admin"/,
  );
  assert.match(
    persona,
    /activeOrganizationRoles\.includes\("guardian"\)[\s\S]*return "guardian"/,
  );
});

test("guardian navigation allows the private video review list, safe stable availability, and its single-session detail route", () => {
  assert.match(
    persona,
    /guardianNavigationPaths = new Set\(\[\s*"\/guardian",\s*"\/competition-development",\s*"\/safety",\s*"\/video-review",\s*"\/stable-operations",\s*"\/settings",\s*\]\)/,
  );
  assert.ok(
    persona.includes(
      "const guardianVideoReviewDetailPath = /^\\/video-review\\/[^/]+$/;",
    ),
  );
  assert.match(
    persona,
    /return isGuardianPortalPath\(pathname\) \? null : "\/guardian"/,
  );
  assert.match(
    persona,
    /guardianVideoReviewDetailPath\.test\(pathname\)/,
  );
  assert.match(
    shell,
    /if \(redirectPath\) return <Navigate to=\{redirectPath\} replace/,
  );
});

test("academy admin receives operations navigation and dashboard instead of rider content", () => {
  for (const path of [
    "/dashboard",
    "/lessons",
    "/horses",
    "/billing",
    "/organization",
    "/settings",
  ]) {
    assert.match(persona, new RegExp(`"${path}"`));
  }
  assert.match(dashboard, /persona === "academy_admin"/);
  assert.match(dashboard, /<AcademyAdminDashboard \/>/);
  assert.match(dashboard, /useOrganizationMembers\(/);
});

test("role-aware dashboard copy is complete in English and Arabic", () => {
  const en = JSON.parse(english).translation.dashboard.academyAdmin;
  const ar = JSON.parse(arabic).translation.dashboard.academyAdmin;
  for (const copy of [en, ar]) {
    assert.ok(copy.title);
    assert.ok(copy.description);
    assert.ok(copy.manageMembers);
    assert.ok(copy.reviewLessons);
    assert.ok(copy.openAccessControl);
  }
});
