import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [migration, hook, app, shell, persona, familyPage, english, arabic] =
  await Promise.all([
    read(
      "supabase/migrations/20260826170000_batch8_parent_membership_revenue_operations.sql",
    ),
    read("artifacts/equus-voyages/src/hooks/use-batch8-operations.ts"),
    read("artifacts/equus-voyages/src/App.tsx"),
    read("artifacts/equus-voyages/src/components/AppShell.tsx"),
    read("artifacts/equus-voyages/src/lib/portal-persona.ts"),
    read("artifacts/equus-voyages/src/pages/FamilyOperationsPage.tsx"),
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
  assert.match(hook, /VITE_BATCH8_ENABLED === "true"/);
  assert.match(
    hook,
    /if \(!batch8ClientEnabled \|\| !organizationId\) return null/,
  );
  assert.match(
    migration,
    /enabled boolean not null default false[\s\S]*readiness_status = 'ready'/,
  );
  assert.match(app, /if \(!enabled \|\| !allowedRoles\.some/);
  assert.match(shell, /batch8Enabled && hasRole\("guardian"\)/);
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
    /allowedRoles=\{\["guardian"\]\}[\s\S]*fallback="\/guardian"/,
  );
  assert.match(
    app,
    /allowedRoles=\{\["academy_admin", "accountant", "platform_admin"\]\}/,
  );
  assert.match(
    shell,
    /path !== "\/revenue-operations"[\s\S]*hasRole\("accountant"\)/,
  );
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