import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const migrationPath = resolve(
  root,
  "supabase/migrations/20260815090638_guardian_view_foundation.sql",
);
const rollbackPath = resolve(
  root,
  "supabase/rollback/20260815090638_guardian_view_foundation_rollback.sql",
);

const tables = ["guardian_approval_requests", "guardian_access_events"];
const indexes = [
  "guardian_riders_verified_by_idx",
  "guardian_riders_revoked_by_idx",
  "guardian_approval_requests_requested_by_idx",
  "guardian_approval_requests_responded_by_idx",
  "guardian_access_events_actor_idx",
  "guardian_access_events_approval_idx",
];

function transactional(sql) {
  return /^\s*(?:--[^\n]*\n)*begin;/i.test(sql) && /commit;\s*$/i.test(sql);
}

export function validateGuardianView(migration, rollback) {
  const errors = [];
  if (!transactional(migration)) errors.push("migration must be transactional");
  if (!transactional(rollback)) errors.push("rollback must be transactional");
  if (/auth\.role\s*\(/i.test(`${migration}\n${rollback}`))
    errors.push("must not use deprecated auth.role()");
  if (/using\s*\(\s*true\s*\)|with check\s*\(\s*true\s*\)/i.test(migration))
    errors.push("RLS policies must not be unconditional");

  for (const table of tables) {
    for (const [label, guard, source] of [
      [
        "create",
        new RegExp(`create table public\\.${table}\\s*\\(`, "i"),
        migration,
      ],
      [
        "RLS",
        new RegExp(
          `alter table public\\.${table} enable row level security;`,
          "i",
        ),
        migration,
      ],
      [
        "revoke",
        new RegExp(
          `revoke all on public\\.${table} from anon, authenticated;`,
          "i",
        ),
        migration,
      ],
      [
        "rollback",
        new RegExp(`drop table if exists public\\.${table};`, "i"),
        rollback,
      ],
    ]) {
      if (!guard.test(source)) errors.push(`missing ${table} ${label} guard`);
    }
  }

  for (const index of indexes) {
    if (
      !new RegExp(`create index ${index}\\s+on public\\.`, "i").test(migration)
    )
      errors.push(`missing foreign-key index: ${index}`);
  }

  const guards = [
    [
      /relationship_type text not null/,
      "guardian relationship type is required",
    ],
    [
      /verification_status text not null/,
      "guardian verification state is required",
    ],
    [/adulthood_review_on date/, "adulthood review date is required"],
    [
      /relationship_type <> 'supporter'[\s\S]*?not can_approve_purchases/,
      "supporters must remain approval-free",
    ],
    [
      /private\.can_guardian_access_rider/,
      "verified guardian access helper is required",
    ],
    [
      /private\.guardian_can_approve/,
      "per-permission guardian approval helper is required",
    ],
    [/old\.status <> 'pending'/, "only pending approvals may be answered"],
    [
      /Guardian approval request details are immutable/,
      "approval request details must be immutable",
    ],
    [
      /create trigger guardian_relationship_audit/,
      "relationship changes must be audited",
    ],
    [
      /create trigger guardian_approval_audit/,
      "approval changes must be audited",
    ],
    [/event_type text not null/, "guardian audit events need an event type"],
    [
      /create function public\.get_guardian_portal/,
      "guardian portal RPC is required",
    ],
    [
      /create function public\.respond_guardian_approval/,
      "guardian response RPC is required",
    ],
    [/security invoker/g, "public guardian RPCs must be security invoker"],
    [
      /grant execute on function public\.get_guardian_portal\(uuid, uuid\) to authenticated;/,
      "guardian portal RPC needs an explicit grant",
    ],
    [
      /grant execute on function public\.respond_guardian_approval\(uuid, text, text\) to authenticated;/,
      "guardian response RPC needs an explicit grant",
    ],
    [
      /can_view_financials then/,
      "financial visibility must be permission gated",
    ],
    [
      /create policy invoices_select_own_or_financial_guardian[\s\S]*?link\.can_view_financials/,
      "invoice RLS must require financial permission",
    ],
  ];
  for (const [guard, message] of guards)
    if (!guard.test(migration)) errors.push(message);

  if ((migration.match(/security invoker/gi) ?? []).length < 2)
    errors.push("both public guardian RPCs must be security invoker");

  for (const fn of [
    "can_guardian_access_rider",
    "guardian_can_approve",
    "prepare_guardian_approval_request",
    "prepare_guardian_approval_response",
    "audit_guardian_relationship",
    "audit_guardian_approval",
    "log_guardian_portal_access",
  ]) {
    if (
      !new RegExp(
        `create function private\\.${fn}[\\s\\S]*?security definer[\\s\\S]*?set search_path = ''`,
        "i",
      ).test(migration)
    ) {
      errors.push(`${fn} must be security definer with an empty search_path`);
    }
  }

  const portalBlock =
    migration.match(
      /create function public\.get_guardian_portal[\s\S]*?\$\$;/i,
    )?.[0] ?? "";
  if (
    /lesson_development_private_notes|provider_token|raw_user_meta_data/i.test(
      portalBlock,
    )
  )
    errors.push(
      "guardian portal must not reference private notes or credentials",
    );

  const guardianAccessBlock =
    migration.match(
      /create function private\.can_guardian_access_rider[\s\S]*?\$\$;/i,
    )?.[0] ?? "";
  if (!/and link\.verification_status = 'verified'/i.test(guardianAccessBlock))
    errors.push("guardian access must require verification");
  if (
    !/adulthood_review_on is null or link\.adulthood_review_on > current_date/i.test(
      guardianAccessBlock,
    )
  )
    errors.push("guardian access must stop at adulthood review");

  return errors;
}

if (process.argv[1] === import.meta.filename) {
  const [migration, rollback] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(rollbackPath, "utf8"),
  ]);
  const errors = validateGuardianView(migration, rollback);
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Verified guardian lifecycle, adulthood review, scoped approvals, immutable audit, persona RLS, grants, indexes, and rollback",
  );
}
