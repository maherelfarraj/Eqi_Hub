import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [
  migration,
  access,
  hook,
  app,
  shell,
  persona,
  familyPage,
  revenuePage,
  ui,
  english,
  arabic,
] =
  await Promise.all([
    read(
      "supabase/migrations/20260826170000_batch8_parent_membership_revenue_operations.sql",
    ),
    read("artifacts/equus-voyages/src/lib/batch8-access.ts"),
    read("artifacts/equus-voyages/src/hooks/use-batch8-operations.ts"),
    read("artifacts/equus-voyages/src/App.tsx"),
    read("artifacts/equus-voyages/src/components/AppShell.tsx"),
    read("artifacts/equus-voyages/src/lib/portal-persona.ts"),
    read("artifacts/equus-voyages/src/pages/FamilyOperationsPage.tsx"),
    read("artifacts/equus-voyages/src/pages/RevenueOperationsPage.tsx"),
    read("artifacts/equus-voyages/src/components/EquiVistaUI.tsx"),
    read("artifacts/equus-voyages/src/i18n/en.json"),
    read("artifacts/equus-voyages/src/i18n/ar.json"),
  ]);

function keyPaths(value, prefix = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

test("Batch 8 is default-off in both client and database gates", () => {
  assert.match(access, /VITE_BATCH8_ENABLED === "true"/);
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
    /organizationId: scopedOrganizationId[\s\S]*query\.data\?\.organizationId === organizationId/,
  );
  assert.match(
    migration,
    /enabled boolean not null default false[\s\S]*readiness_status = 'ready'/,
  );
  assert.match(app, /resolveBatch8Access/);
  assert.match(access, /activeOrganizationRoles\.includes\("guardian"\)/);
});

test("membership, attendance, waitlist, and credit transitions are explicit and idempotent", () => {
  for (const functionName of [
    "apply_batch8_membership_transition",
    "record_batch8_membership_renewal",
    "record_batch8_attendance_exception",
    "review_batch8_attendance_exception",
    "create_batch8_waitlist_entry",
    "apply_batch8_waitlist_transition",
    "issue_batch8_makeup_credit",
    "consume_batch8_makeup_credit",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `create function public\\.${functionName}\\([\\s\\S]*?idempotency`,
      ),
    );
  }
  assert.match(
    migration,
    /when 'draft' then p_to_status in \('waitlisted', 'active', 'cancelled'\)/,
  );
  assert.match(
    migration,
    /when 'queued' then p_to_status in \('offered', 'cancelled'\)/,
  );
  assert.match(
    migration,
    /when 'offered' then p_to_status in \('accepted', 'expired', 'cancelled'\)/,
  );
  assert.match(migration, /transition_allowed is not true/);
  assert.match(migration, /remaining_units = remaining_units - 1/);
  assert.match(
    migration,
    /lesson\.rider_id = membership\.rider_id/,
  );
  assert.match(
    migration,
    /p_granted_at < exception_record\.reviewed_at/,
  );
  assert.match(
    migration,
    /credit_row\.granted_at <= p_consumed_at[\s\S]*credit_row\.expires_at > now\(\)/,
  );
});

test("RLS denies direct writes and raw guardian-sensitive records", () => {
  assert.doesNotMatch(
    migration,
    /create policy[\s\S]{0,120}\bfor (insert|update|delete|all)\b/i,
  );
  for (const policy of [
    "batch8_membership_events_staff_select",
    "batch8_attendance_exceptions_staff_select",
    "batch8_waitlist_entries_staff_select",
    "batch8_makeup_credits_staff_select",
    "batch8_payment_link_intents_staff_select",
    "batch8_collection_cases_staff_select",
    "batch8_renewal_signals_staff_select",
    "batch8_revenue_daily_staff_select",
  ]) {
    assert.match(migration, new RegExp(`create policy ${policy}`));
  }
  assert.match(
    migration,
    /private\.can_guardian_access_rider\([\s\S]*guardian_link\.can_view_financials/,
  );
  assert.match(
    migration,
    /where authorized\.can_view_financials[\s\S]*group by invoice\.currency/,
  );
});

test("financial responses preserve currencies and prevent duplicate family links", () => {
  assert.match(
    migration,
    /batch8_family_account_riders_one_family_unique[\s\S]*unique \(organization_id, guardian_id, rider_id\)/,
  );
  assert.match(
    migration,
    /group by invoice\.currency[\s\S]*order by family_balances\.currency/,
  );
  assert.match(migration, /'summaries', summaries/);
  assert.match(hook, /summaries: z\.array/);
  assert.match(hook, /balances: z\.array\(financialBalanceSchema\)/);
});

test("financial foundations cannot process payments", () => {
  assert.match(migration, /processor = 'none'/);
  assert.match(migration, /amount_cents > 0 and captured_cents = 0/);
  assert.doesNotMatch(
    `${migration}\n${hook}\n${familyPage}`,
    /\b(stripe|checkout|payment_intent_secret|card_number|refundPayment)\b/i,
  );
  assert.doesNotMatch(familyPage, /onClick=/);
  assert.match(familyPage, /nonProcessingNotice/);
});

test("route boundaries include guardian, admin, and accountant behavior", () => {
  assert.match(persona, /"\/family-operations"/);
  assert.match(persona, /"\/revenue-operations"/);
  assert.match(
    app,
    /surface="family"[\s\S]*fallback="\/guardian"/,
  );
  assert.match(
    app,
    /surface="revenue"[\s\S]*fallback="\/dashboard"/,
  );
  assert.match(
    access,
    /activeOrganizationRoles\.includes\("accountant"\)/,
  );
  assert.match(
    shell,
    /location\.pathname === "\/revenue-operations" && batch8Access\.revenue[\s\S]*\? null[\s\S]*portalRedirect/,
  );
  assert.doesNotMatch(
    shell,
    /activeOrganizationRoles\.includes\("(guardian|academy_admin|accountant)"\)/,
  );
});

test("organization readiness is resolved before family or revenue data", () => {
  assert.match(
    migration,
    /create function public\.get_batch8_availability\([\s\S]*membership\.status = 'active'/,
  );
  assert.match(
    migration,
    /return private\.batch8_is_enabled\(p_organization_id\)/,
  );
  assert.match(
    hook,
    /get_batch8_availability[\s\S]*availability !== true[\s\S]*const rpcName/,
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
});

test("calendar dates and surfaced enums remain localized", () => {
  const en = JSON.parse(english).translation;
  const ar = JSON.parse(arabic).translation;
  for (const relationship of [
    "parent",
    "legal_guardian",
    "court_guardian",
    "supporter",
  ]) {
    assert.ok(en.familyOperations.relationships[relationship]);
    assert.ok(ar.familyOperations.relationships[relationship]);
  }
  for (const status of [
    "open",
    "contact_ready",
    "link_prepared",
    "paused",
    "resolved",
    "closed",
  ]) {
    assert.ok(en.revenueOperations.collections.statuses[status]);
    assert.ok(ar.revenueOperations.collections.statuses[status]);
  }
  assert.match(familyPage, /familyOperations\.relationships/);
  assert.match(revenuePage, /revenueOperations\.collections\.statuses/);
  assert.match(familyPage, /defaultValue: rider\.relationship/);
  assert.match(familyPage, /defaultValue: rider\.relationshipStatus/);
  assert.match(familyPage, /defaultValue: rider\.membershipStatus/);
  assert.match(revenuePage, /defaultValue: c\.status/);
  assert.match(ui, /formatCalendarDate[\s\S]*timeZone: "UTC"/);
});

test("revenue risks are ordered by explicit severity rank", () => {
  assert.match(
    migration,
    /case signal\.risk_level[\s\S]*when 'high' then 0[\s\S]*when 'medium' then 1[\s\S]*signal\.renewal_on/,
  );
  assert.match(
    migration,
    /case collection\.risk_level[\s\S]*when 'high' then 0[\s\S]*when 'medium' then 1[\s\S]*invoice\.due_date/,
  );
  assert.doesNotMatch(migration, /order by (signal|collection)\.risk_level desc/);
});

test("English and Arabic Batch 8 keys are recursively equivalent", () => {
  const en = JSON.parse(english).translation;
  const ar = JSON.parse(arabic).translation;
  for (const namespace of ["familyOperations", "revenueOperations"]) {
    assert.deepEqual(
      keyPaths(en[namespace]).sort(),
      keyPaths(ar[namespace]).sort(),
    );
  }
  assert.match(app, /document\.documentElement\.dir = language === "ar" \? "rtl" : "ltr"/);
});