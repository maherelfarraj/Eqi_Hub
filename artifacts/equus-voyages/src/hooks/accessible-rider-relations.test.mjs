import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./_shared.ts", import.meta.url), "utf8");

test("accessible rider resolution includes active guardian and coach links", () => {
  assert.match(source, /\.from\("guardian_riders"\)/);
  assert.match(source, /\.eq\("guardian_id", userId\)/);
  assert.match(source, /\.from\("coach_rider_assignments"\)/);
  assert.match(source, /\.eq\("coach_id", userId\)/);
  assert.equal(source.match(/\.eq\("active", true\)/g)?.length, 2);
});

test("accessible rider resolution preserves the signed-in rider", () => {
  assert.match(source, /new Set\(\[\s*userId,/);
});
