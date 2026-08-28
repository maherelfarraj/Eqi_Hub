import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  persona,
  shell,
  dashboard,
  academyOperations,
  billing,
  english,
  arabic,
] = await Promise.all([
  readFile(new URL("../lib/portal-persona.ts", import.meta.url), "utf8"),
  readFile(new URL("../components/AppShell.tsx", import.meta.url), "utf8"),
  readFile(new URL("./DashboardPage.tsx", import.meta.url), "utf8"),
  readFile(new URL("./AcademyOperationsPage.tsx", import.meta.url), "utf8"),
  readFile(new URL("./BillingPage.tsx", import.meta.url), "utf8"),
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
  const guardianPaths =
    persona.match(
      /const guardianNavigationPaths = new Set\(\[[\s\S]*?\]\);/,
    )?.[0] ?? "";
  for (const path of [
    "/guardian",
    "/competition-development",
    "/safety",
    "/video-review",
    "/stable-operations",
    "/family-operations",
    "/settings",
  ]) {
    assert.match(guardianPaths, new RegExp(`"${path}"`));
  }
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

test("coach dashboard uses only coach-authorized data and respects development access", () => {
  assert.match(dashboard, /activeOrganization\?\.roles\.includes\("coach"\)/);
  assert.match(dashboard, /<CoachDashboard \/>/);
  const coachDashboard =
    dashboard.match(
      /function CoachDashboard\(\) \{[\s\S]*?function CoachLessonRow/,
    )?.[0] ?? "";
  assert.match(coachDashboard, /useLessons\("upcoming"\)/);
  assert.match(coachDashboard, /useLessons\("requests"\)/);
  assert.match(coachDashboard, /useProfile\(\)/);
  assert.match(coachDashboard, /useCompetitionDevelopmentAccess\(\)/);
  assert.match(coachDashboard, /competitionAccess\.data\?\.canManage/);
  assert.doesNotMatch(coachDashboard, /useOrganizationMembers\(/);
});

test("platform admin revenue access overrides a guardian persona redirect", () => {
  assert.match(
    shell,
    /location\.pathname === "\/revenue-operations" && batch8Access\.revenue[\s\S]*\? null[\s\S]*portalRedirect/,
  );
  assert.match(
    shell,
    /path === "\/revenue-operations" && batch8Access\.revenue[\s\S]*isNavigationPathVisible/,
  );
});

test("role-aware dashboard copy is complete in English and Arabic", () => {
  const en = JSON.parse(english).translation;
  const ar = JSON.parse(arabic).translation;
  for (const dictionary of [en, ar]) {
    const copy = dictionary.dashboard.academyAdmin;
    assert.ok(copy.title);
    assert.ok(copy.description);
    assert.ok(copy.manageMembers);
    assert.ok(copy.reviewLessons);
    assert.ok(copy.openAccessControl);
    assert.ok(dictionary.dashboard.coach.title);
    assert.ok(dictionary.dashboard.coach.openSchedule);
    assert.ok(dictionary.dashboard.coach.openDevelopment);
    assert.ok(dictionary.app.orientation);
  }
});

test("academy operations copy is complete in English and Arabic", () => {
  const en = JSON.parse(english).translation.academyOperations;
  const ar = JSON.parse(arabic).translation.academyOperations;
  const leafPaths = (value, prefix = "") =>
    Object.entries(value).flatMap(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return child && typeof child === "object"
        ? leafPaths(child, path)
        : [path];
    });

  assert.deepEqual(leafPaths(en).sort(), leafPaths(ar).sort());
  assert.match(academyOperations, /t\("academyOperations\.disabledTitle"\)/);
  assert.match(academyOperations, /t\("academyOperations\.compensation\.reviewNotice"\)/);
  assert.match(academyOperations, /StatusBadge status=\{alert\.severity\} label=/);
  assert.match(academyOperations, /resources\.types\.\$\{resource\.resource_type\}/);
  assert.doesNotMatch(academyOperations, />Academy workspace</);
  assert.doesNotMatch(academyOperations, />Calculation and review only\./);
});

test("billing keeps financial totals separated by currency", () => {
  assert.match(billing, /function sumByCurrency\(invoices: Invoice\[\]\)/);
  assert.match(billing, /count: current\.count \+ 1/);
  assert.match(billing, /openInvoiceCount", \{ count \}/);
  assert.match(billing, /summary\.outstanding\.map/);
  assert.match(billing, /summary\.paidThisMonth\.map/);
  assert.doesNotMatch(billing, /outstandingCurrency|paidCurrency/);
});
