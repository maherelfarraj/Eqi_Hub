import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const migrationPath = resolve(
  root,
  "supabase/migrations/20260815062339_ridersync_dashboard_foundation.sql",
);
const rollbackPath = resolve(
  root,
  "supabase/rollback/20260815062339_ridersync_dashboard_foundation_rollback.sql",
);

const tables = [
  "rider_journey_title_catalog",
  "rider_badge_catalog",
  "rider_sync_score_snapshots",
  "rider_journey_title_unlocks",
  "rider_badge_awards",
];
const indexes = [
  "rider_sync_snapshots_rider_id_idx",
  "rider_sync_snapshots_source_report_id_idx",
  "rider_journey_unlocks_rider_id_idx",
  "rider_journey_unlocks_title_code_idx",
  "rider_journey_unlocks_snapshot_id_idx",
  "rider_badge_awards_rider_id_idx",
  "rider_badge_awards_badge_code_idx",
  "rider_badge_awards_evidence_report_id_idx",
  "rider_badge_awards_proposed_by_idx",
  "rider_badge_awards_approved_by_idx",
];

function transactional(sql) {
  return /^\s*(?:--[^\n]*\n)*begin;/i.test(sql) && /commit;\s*$/i.test(sql);
}

export function validateRiderSyncDashboard(migration, rollback) {
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
    [/safety_welfare_score \* 25/, "safety weight must remain 25"],
    [/rhythm_control_score \* 20/, "rhythm weight must remain 20"],
    [/balance_position_score \* 20/, "balance weight must remain 20"],
    [/partnership_score \* 20/, "partnership weight must remain 20"],
    [/training_consistency_score \* 10/, "consistency weight must remain 10"],
    [/reflection_feedback_score \* 5/, "reflection weight must remain 5"],
    [
      /constraint rider_sync_snapshot_weighted_score/,
      "database must enforce the weighted score",
    ],
    [
      /source_event_key text not null/,
      "snapshots require an idempotent event key",
    ],
    [
      /unique \(organization_id, rider_id, source_event_key\)/,
      "snapshot event key must be unique per rider",
    ],
    [
      /create trigger rider_sync_refresh_report/,
      "report approval must refresh RiderSync",
    ],
    [
      /old\.status = 'draft' and new\.status = 'approved'/,
      "draft reports must not refresh RiderSync",
    ],
    [
      /create trigger rider_sync_refresh_reflection/,
      "reflection must refresh RiderSync",
    ],
    [
      /create function private\.prepare_rider_badge_award/,
      "badge awards require a guarded trigger",
    ],
    [/new\.source := 'coach_approved'/, "badge awards must be coach approved"],
    [
      /private\.can_manage_rider_development\(new\.organization_id, new\.rider_id\)/,
      "badge awards must be assignment scoped",
    ],
    [
      /create policy rider_sync_snapshots_select_scoped[\s\S]*?private\.can_read_rider\(organization_id, rider_id\)/,
      "score reads must be rider scoped",
    ],
    [
      /status = 'approved' and private\.can_read_rider\(organization_id, rider_id\)/,
      "only approved badges may be rider visible",
    ],
    [
      /create function public\.get_rider_sync_dashboard/,
      "dashboard RPC is required",
    ],
    [
      /create function public\.award_rider_badge/,
      "badge award RPC is required",
    ],
    [/security invoker/g, "public RPCs must be security invoker"],
    [
      /grant execute on function public\.get_rider_sync_dashboard\(uuid, uuid\) to authenticated;/,
      "dashboard RPC needs an explicit grant",
    ],
    [
      /grant execute on function public\.award_rider_badge\(uuid, uuid, text, text, uuid\) to authenticated;/,
      "badge RPC needs an explicit grant",
    ],
    [/Arena Explorer/, "journey title seed is missing"],
    [/Equestrian Elite/, "highest journey title seed is missing"],
    [/Horse First/, "badge seed is missing"],
    [/Coach''s Choice/, "coach badge seed is missing"],
  ];
  for (const [guard, message] of guards)
    if (!guard.test(migration)) errors.push(message);

  const invokerCount = (migration.match(/security invoker/gi) ?? []).length;
  if (invokerCount < 2)
    errors.push("both public RPCs must be security invoker");
  const definerFunctions = [
    "refresh_rider_sync_score",
    "refresh_rider_sync_after_report",
    "refresh_rider_sync_after_reflection",
    "prepare_rider_badge_award",
  ];
  for (const fn of definerFunctions) {
    if (
      !new RegExp(
        `create function private\\.${fn}[\\s\\S]*?security definer[\\s\\S]*?set search_path = ''`,
        "i",
      ).test(migration)
    ) {
      errors.push(`${fn} must be security definer with an empty search_path`);
    }
  }
  const dashboardBlock =
    migration.match(
      /create function public\.get_rider_sync_dashboard[\s\S]*?\$\$;/i,
    )?.[0] ?? "";
  if (/lesson_development_private_notes/i.test(dashboardBlock))
    errors.push("dashboard RPC must never reference private notes");
  return errors;
}

if (process.argv[1] === import.meta.filename) {
  const [migration, rollback] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(rollbackPath, "utf8"),
  ]);
  const errors = validateRiderSyncDashboard(migration, rollback);
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Verified RiderSync weights, append-only events, coach badge approval, persona RLS, explicit grants, indexes, and rollback",
  );
}
