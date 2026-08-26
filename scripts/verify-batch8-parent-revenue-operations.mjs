import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const [migration, access, hook, app, shell, familyPage, revenuePage, english, arabic] =
  await Promise.all([
    read(
      "supabase/migrations/20260826170000_batch8_parent_membership_revenue_operations.sql",
    ),
    read("artifacts/equus-voyages/src/lib/batch8-access.ts"),
    read("artifacts/equus-voyages/src/hooks/use-batch8-operations.ts"),
    read("artifacts/equus-voyages/src/App.tsx"),
    read("artifacts/equus-voyages/src/components/AppShell.tsx"),
    read("artifacts/equus-voyages/src/pages/FamilyOperationsPage.tsx"),
    read("artifacts/equus-voyages/src/pages/RevenueOperationsPage.tsx"),
    read("artifacts/equus-voyages/src/i18n/en.json"),
    read("artifacts/equus-voyages/src/i18n/ar.json"),
  ]);

const requiredTables = [
  "batch8_feature_readiness",
  "batch8_family_accounts",
  "batch8_family_account_riders",
  "batch8_membership_packages",
  "batch8_membership_events",
  "batch8_attendance_exceptions",
  "batch8_waitlist_entries",
  "batch8_makeup_credits",
  "batch8_payment_link_intents",
  "batch8_collection_cases",
  "batch8_renewal_signals",
  "batch8_revenue_daily",
];
for (const table of requiredTables) {
  assert.match(migration, new RegExp(`create table public\\.${table}\\b`));
  assert.match(
    migration,
    new RegExp(`alter table public\\.${table} enable row level security`),
  );
}

for (const rpc of [
  "apply_batch8_membership_transition",
  "record_batch8_membership_renewal",
  "record_batch8_attendance_exception",
  "review_batch8_attendance_exception",
  "create_batch8_waitlist_entry",
  "apply_batch8_waitlist_transition",
  "issue_batch8_makeup_credit",
  "consume_batch8_makeup_credit",
  "get_batch8_availability",
  "get_batch8_family_operations",
  "get_batch8_revenue_operations",
]) {
  assert.match(migration, new RegExp(`create function public\\.${rpc}\\b`));
  assert.match(
    migration,
    new RegExp(`grant execute on function public\\.${rpc}\\(`),
  );
}

assert.match(
  migration,
  /enabled boolean not null default false[\s\S]*enabled = false or \(/,
);
assert.match(
  migration,
  /processor text not null default 'none'[\s\S]*captured_cents integer not null default 0/,
);
assert.match(migration, /processor = 'none'/);
assert.match(migration, /amount_cents > 0 and captured_cents = 0/);
assert.doesNotMatch(
  migration,
  /\b(payment_url|provider_token|provider_reference|card_number|refund_id)\b/i,
);
assert.match(
  migration,
  /create trigger batch8_membership_events_append_only[\s\S]*before update or delete/,
);
assert.match(
  migration,
  /array\['academy_admin', 'accountant'\]/,
);
assert.match(
  migration,
  /guardian_link\.can_view_financials[\s\S]*paymentLinkStatus/,
);
assert.match(
  migration,
  /batch8_family_account_riders_one_family_unique[\s\S]*unique \(organization_id, guardian_id, rider_id\)/,
);
assert.match(
  migration,
  /group by invoice\.currency[\s\S]*'balances'[\s\S]*order by family_balances\.currency/,
);
assert.match(
  migration,
  /'summaries', summaries/,
);
assert.doesNotMatch(
  migration,
  /create policy[\s\S]{0,120}\bfor (insert|update|delete|all)\b/i,
);

assert.match(
  access,
  /VITE_BATCH8_ENABLED === "true"/,
);
assert.match(hook, /get_batch8_availability/);
assert.match(
  hook,
  /availability !== true[\s\S]*enabled: false,[\s\S]*loadError: null/,
);
assert.match(
  hook,
  /query\.data\?\.organizationId === organizationId[\s\S]*data: resultMatchesOrganization/,
);
assert.match(
  hook,
  /catch \(error\)[\s\S]*loadError: errorMessage\(error\)[\s\S]*query\.data\?\.loadError/,
);
assert.match(hook, /get_batch8_family_operations/);
assert.match(hook, /get_batch8_revenue_operations/);
assert.match(hook, /familyOperationsSchema\.parse\(data\)/);
assert.match(hook, /revenueOperationsSchema\.parse\(data\)/);
assert.match(hook, /summaries: z\.array/);
assert.match(hook, /balances: z\.array\(financialBalanceSchema\)/);
assert.doesNotMatch(hook, /\b(mock|setTimeout|Math\.random)\b/i);

assert.match(
  app,
  /Batch8RouteGuard[\s\S]*surface="family"[\s\S]*fallback="\/guardian"/,
);
assert.match(
  app,
  /surface="revenue"[\s\S]*fallback="\/dashboard"/,
);
assert.match(access, /activeOrganizationRoles\.includes\("guardian"\)/);
assert.match(access, /activeOrganizationRoles\.includes\("accountant"\)/);
assert.match(access, /isPlatformAdmin/);
assert.match(shell, /path !== "\/family-operations" \|\| batch8Access\.family/);
assert.match(shell, /path !== "\/revenue-operations"[\s\S]*batch8Access\.revenue/);
assert.match(
  shell,
  /location\.pathname === "\/revenue-operations" && batch8Access\.revenue[\s\S]*\? null[\s\S]*portalRedirect/,
);
assert.doesNotMatch(
  shell,
  /activeOrganizationRoles\.includes\("(guardian|academy_admin|accountant)"\)/,
);
assert.match(
  migration,
  /case signal\.risk_level[\s\S]*when 'high' then 0[\s\S]*when 'medium' then 1/,
);
assert.match(
  migration,
  /case collection\.risk_level[\s\S]*when 'high' then 0[\s\S]*when 'medium' then 1/,
);
assert.match(familyPage, /defaultValue: rider\.relationship/);
assert.match(familyPage, /defaultValue: rider\.relationshipStatus/);
assert.match(familyPage, /defaultValue: rider\.membershipStatus/);
assert.match(revenuePage, /defaultValue: c\.status/);
assert.doesNotMatch(familyPage, /onClick=|Pay via link|OutlineButton|checkout/i);
assert.match(familyPage, /nonProcessingNotice/);
assert.doesNotMatch(revenuePage, /onClick=|checkout|capture|refund/i);

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

console.log(
  "Verified Batch 8 Parent, Membership & Revenue Operations repository contract.",
);