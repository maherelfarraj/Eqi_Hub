import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { validateRiderSyncDashboard } from "./verify-ridersync-dashboard.mjs";

const root = resolve(import.meta.dirname, "..");
const [migration, rollback, acceptance] = await Promise.all([
  readFile(
    resolve(
      root,
      "supabase/migrations/20260815062339_ridersync_dashboard_foundation.sql",
    ),
    "utf8",
  ),
  readFile(
    resolve(
      root,
      "supabase/rollback/20260815062339_ridersync_dashboard_foundation_rollback.sql",
    ),
    "utf8",
  ),
  readFile(resolve(root, "tests/rls/batch_2_ridersync_dashboard.sql"), "utf8"),
]);

test("accepts the RiderSync dashboard foundation", () => {
  assert.deepEqual(validateRiderSyncDashboard(migration, rollback), []);
});
test("acceptance covers the weighted baseline and reflection uplift", () => {
  assert.match(acceptance, /weighted score after approval was not 21/);
  assert.match(acceptance, /reflection did not lift RiderSync from 21 to 26/);
  assert.match(acceptance, /rider self-awarded badge/);
  assert.match(acceptance, /guardian cannot read linked score history/);
  assert.match(acceptance, /unrelated user can read RiderSync scores/);
});
test("rejects weight drift", () => {
  const unsafe = migration.replace(
    "safety_welfare_score * 25",
    "safety_welfare_score * 20",
  );
  assert.ok(
    validateRiderSyncDashboard(unsafe, rollback).includes(
      "safety weight must remain 25",
    ),
  );
});
test("rejects missing RLS and foreign-key indexes", () => {
  const noRls = migration.replace(
    "alter table public.rider_sync_score_snapshots enable row level security;",
    "",
  );
  const noIndex = migration.replace(
    /create index rider_badge_awards_approved_by_idx[^;]+;/i,
    "",
  );
  assert.ok(
    validateRiderSyncDashboard(noRls, rollback).includes(
      "missing rider_sync_score_snapshots RLS guard",
    ),
  );
  assert.ok(
    validateRiderSyncDashboard(noIndex, rollback).includes(
      "missing foreign-key index: rider_badge_awards_approved_by_idx",
    ),
  );
});
test("rejects rider-visible unapproved badges", () => {
  const unsafe = migration.replace(
    "status = 'approved' and private.can_read_rider(organization_id, rider_id)",
    "private.can_read_rider(organization_id, rider_id)",
  );
  assert.ok(
    validateRiderSyncDashboard(unsafe, rollback).includes(
      "only approved badges may be rider visible",
    ),
  );
});
test("rejects private-note coupling", () => {
  const unsafe = migration.replace(
    "'snapshot',",
    "'privateNotes', (select jsonb_agg(note) from public.lesson_development_private_notes), 'snapshot',",
  );
  assert.ok(
    validateRiderSyncDashboard(unsafe, rollback).includes(
      "dashboard RPC must never reference private notes",
    ),
  );
});
