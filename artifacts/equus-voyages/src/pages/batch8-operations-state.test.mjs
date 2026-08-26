import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  app,
  shell,
  persona,
  hook,
  familyPage,
  revenuePage,
  ui,
  english,
  arabic,
] =
  await Promise.all([
    readFile(new URL("../App.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/AppShell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/portal-persona.ts", import.meta.url), "utf8"),
    readFile(new URL("../hooks/use-batch8-operations.ts", import.meta.url), "utf8"),
    readFile(new URL("./FamilyOperationsPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("./RevenueOperationsPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/EquiVistaUI.tsx", import.meta.url), "utf8"),
    readFile(new URL("../i18n/en.json", import.meta.url), "utf8"),
    readFile(new URL("../i18n/ar.json", import.meta.url), "utf8"),
  ]);

test("Batch 8 client adapter is disabled before any RPC and contains no samples", () => {
  assert.match(
    hook,
    /get_batch8_availability/,
  );
  assert.match(
    hook,
    /availability !== true[\s\S]*enabled: false,[\s\S]*loadError: null/,
  );
  assert.match(
    hook,
    /query\.data\?\.organizationId === organizationId/,
  );
  assert.match(
    hook,
    /data: resultMatchesOrganization \? \(query\.data\?\.data \?\? null\) : null/,
  );
  assert.match(hook, /loading: waitingForOrganization \|\| query\.loading/);
  assert.match(
    hook,
    /catch \(error\)[\s\S]*loadError: errorMessage\(error\)/,
  );
  assert.match(
    hook,
    /error: resultMatchesOrganization[\s\S]*query\.data\?\.loadError/,
  );
  assert.match(hook, /get_batch8_family_operations/);
  assert.match(hook, /get_batch8_revenue_operations/);
  assert.match(hook, /balances: z\.array\(financialBalanceSchema\)/);
  assert.match(hook, /summaries: z\.array/);
  assert.doesNotMatch(hook, /\b(mock|setTimeout|Sarah Jenkins|INV-2023)\b/i);
});

test("Batch 8 routes and navigation are feature- and role-gated", () => {
  assert.match(app, /function Batch8RouteGuard/);
  assert.match(app, /allowedRoles=\{\["guardian"\]\}/);
  assert.match(
    app,
    /allowedRoles=\{\["academy_admin", "accountant", "platform_admin"\]\}/,
  );
  assert.match(app, /activeOrganization\?\.roles\.includes\(role\)/);
  assert.match(shell, /activeOrganizationRoles\.includes\("guardian"\)/);
  assert.match(shell, /activeOrganizationRoles\.includes\("accountant"\)/);
  assert.doesNotMatch(
    shell,
    /batch8Enabled && hasRole\("(guardian|academy_admin|accountant)"\)/,
  );
  assert.match(persona, /"\/family-operations"/);
  assert.match(persona, /"\/revenue-operations"/);
});

test("Batch 8 pages are read-only and explain non-processing status", () => {
  assert.doesNotMatch(familyPage, /onClick=|Pay via link|checkout/i);
  assert.doesNotMatch(revenuePage, /onClick=|checkout|capture|refund/i);
  assert.match(familyPage, /nonProcessingNotice/);
  assert.match(familyPage, /familySummary\.balances\.map/);
  assert.match(revenuePage, /summaries\.map/);
});

test("Batch 8 English and Arabic copy has matching namespaces", () => {
  const en = JSON.parse(english).translation;
  const ar = JSON.parse(arabic).translation;
  assert.deepEqual(
    Object.keys(en.familyOperations).sort(),
    Object.keys(ar.familyOperations).sort(),
  );
  assert.deepEqual(
    Object.keys(en.revenueOperations).sort(),
    Object.keys(ar.revenueOperations).sort(),
  );
  assert.ok(en.familyOperations.nonProcessingNotice);
  assert.ok(ar.familyOperations.nonProcessingNotice);
  assert.match(familyPage, /familyOperations\.relationships/);
  assert.match(revenuePage, /revenueOperations\.collections\.statuses/);
  assert.match(ui, /formatCalendarDate[\s\S]*timeZone: "UTC"/);
});