import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./_shared.ts", import.meta.url), "utf8");

test("accessible rider resolution includes active guardian and coach links", () => {
  assert.match(source, /\.from\("guardian_riders"\)/);
  assert.match(source, /\.eq\("guardian_id", userId\)/);
  assert.match(source, /\.eq\("verification_status", "verified"\)/);
  assert.match(source, /adulthood_review_on/);
  assert.match(source, /access_expires_at/);
  assert.match(source, /\.from\("coach_rider_assignments"\)/);
  assert.match(source, /\.eq\("coach_id", userId\)/);
  assert.equal(source.match(/\.eq\("active", true\)/g)?.length, 2);
});

test("accessible rider resolution preserves the signed-in rider", () => {
  assert.match(source, /new Set\(\[\s*userId,/);
});

test("academy administrators resolve active organization riders", () => {
  assert.match(source, /\.from\("organization_memberships"\)/);
  assert.match(source, /\.eq\("user_id", userId\)/);
  assert.match(
    source,
    /\.eq\("organization_member_roles\.role", "academy_admin"\)/,
  );
  assert.match(
    source,
    /if \(\(academyAdminMemberships\.data \?\? \[\]\)\.length > 0\)/,
  );
  assert.match(source, /\.eq\("organization_member_roles\.role", "rider"\)/);
  assert.match(source, /\(membership\) => membership\.user_id/);
  assert.match(source, /\.\.\.organizationRiderIds/);
});
