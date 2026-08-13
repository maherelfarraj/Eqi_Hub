import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  evaluateProductionPreflight,
  validateProductionPreflight,
} from "./phase1-pilot-preflight.mjs";

const ready = JSON.parse(
  await readFile(
    new URL(
      "../pilot/phase1-production-preflight.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

test("accepts a non-secret ready preflight template", () => {
  assert.deepEqual(validateProductionPreflight(ready, { template: true }), []);
  assert.equal(
    evaluateProductionPreflight(ready, { template: true }).status,
    "ready",
  );
});

test("holds when production has no guardian persona or guardian-rider link", () => {
  const snapshot = structuredClone(ready);
  snapshot.totals.profiles = 3;
  snapshot.totals.active_memberships = 2;
  snapshot.organizations[0].active_members = 2;
  snapshot.organizations[0].distinct_required_role_users = 2;
  snapshot.organizations[0].roles.guardian = 0;
  snapshot.organizations[0].relationships.active_guardian_rider_links = 0;
  const result = evaluateProductionPreflight(snapshot, { template: true });
  assert.equal(result.status, "hold");
  assert.ok(result.blockers.some((blocker) => blocker.includes("profiles")));
  assert.ok(
    result.blockers.some((blocker) => blocker.includes("guardian role")),
  );
  assert.ok(
    result.blockers.some((blocker) =>
      blocker.includes("active_guardian_rider_links"),
    ),
  );
});

test("holds when required roles exist but fewer than four members are active", () => {
  const snapshot = structuredClone(ready);
  snapshot.organizations[0].active_members = 3;
  snapshot.organizations[0].distinct_required_role_users = 3;
  const result = evaluateProductionPreflight(snapshot, { template: true });
  assert.equal(result.status, "hold");
});

test("holds when four members reuse fewer than four persona accounts", () => {
  const snapshot = structuredClone(ready);
  snapshot.organizations[0].distinct_required_role_users = 3;
  const result = evaluateProductionPreflight(snapshot, { template: true });
  assert.equal(result.status, "hold");
  assert.ok(
    result.blockers.some((blocker) => blocker.includes("distinct users")),
  );
});

test("rejects malformed counts and secret-shaped fields", () => {
  const snapshot = structuredClone(ready);
  snapshot.totals.profiles = -1;
  snapshot.api_token = "must-not-be-committed";
  const errors = validateProductionPreflight(snapshot, { template: true });
  assert.ok(errors.some((error) => error.includes("totals.profiles")));
  assert.ok(errors.some((error) => error.includes("must not store secrets")));
});
