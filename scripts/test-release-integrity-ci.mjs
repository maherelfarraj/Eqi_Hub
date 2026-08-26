import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [repositoryVerify, workerCi, supabaseReplay, packageJson, releaseDoc, schemaJson, previewVerifier, welfare, academy, medical, guardian] = await Promise.all([
  read(".github/workflows/repository-verify.yml"),
  read(".github/workflows/worker-ci.yml"),
  read(".github/workflows/verify-supabase-replay.yml"),
  read("package.json"),
  read("docs/BATCH_7_RELEASE_INTEGRITY.md"),
  read("intelligence/batch7-release-integrity.schema.json"),
  read("scripts/supabase-preview-check.mjs"),
  read("scripts/test-horse-welfare-stable-operations.mjs"),
  read("scripts/test-staff-arena-academy-operations.mjs"),
  read("scripts/test-medical-waiver-gate.mjs"),
  read("scripts/test-guardian-view.mjs"),
]);

test("repository verify provides an always-present protected context", () => {
  assert.match(repositoryVerify, /^  pull_request:\s*$/m);
  assert.match(repositoryVerify, /^  push:\n    branches: \[main\]$/m);
  assert.match(repositoryVerify, /\n  verify:\n    name: verify/);
  assert.match(repositoryVerify, /supabase-preview-gate:/);
  assert.match(repositoryVerify, /needs: supabase-preview-gate/);
  assert.match(repositoryVerify, /check-runs\?filter=all&per_page=100&page=\$page/);
  assert.match(repositoryVerify, /verify-supabase-preview-check/);
  assert.match(repositoryVerify, /preview_status=\$\{PIPESTATUS\[1\]\}/);
  assert.match(repositoryVerify, /Supabase Preview check-run pagination exceeded the safe limit/);
  assert.match(repositoryVerify, /PORT: "4173"/);
  assert.match(repositoryVerify, /run: pnpm verify/);
  assert.match(repositoryVerify, /run: pnpm typecheck/);
  assert.match(repositoryVerify, /run: pnpm build/);
  assert.match(workerCi, /worker-verify:\n    name: worker-verify/);
  assert.doesNotMatch(workerCi, /\n  verify:\n    name: verify/);
});

test("Supabase replay covers schema and validation-contract changes", () => {
  for (const path of ["supabase/**", "scripts/**", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"]) {
    assert.match(supabaseReplay, new RegExp(`"${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  }
  assert.match(supabaseReplay, /npm run verify:supabase/);
});

test("release policy defines required and intentional-skip Supabase Preview outcomes", () => {
  assert.match(releaseDoc, /supabase\/\*\*[\s\S]*Supabase[\s\S]*Preview[\s\S]*required/i);
  assert.match(releaseDoc, /non-Supabase[\s\S]*Supabase Preview[\s\S]*skipped/i);
  assert.match(releaseDoc, /missing, pending, cancelled, or failed.*fail/is);
  assert.match(releaseDoc, /supabase-replay[\s\S]*must[\s\S]*pass/i);
});

test("release evidence schema is sealed and the runtime contract executes its approved suites", () => {
  const schema = JSON.parse(schemaJson);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.safety.additionalProperties, false);
  assert.equal(schema.properties.role_matrix.items.additionalProperties, false);
  const command = JSON.parse(packageJson).scripts["verify:release-integrity"];
  assert.match(command, /test-supabase-preview-check/);
  assert.match(previewVerifier, /SUPABASE_GITHUB_APP_ID = 330661/);
  for (const expected of [
    "verify-guardian-view",
    "test-guardian-view",
    "verify-medical-waiver-gate",
    "test-medical-waiver-gate",
    "test-horse-welfare-stable-operations",
    "test-staff-arena-academy-operations",
  ]) assert.match(command, new RegExp(expected));
});

test("root verify keeps focused payroll, welfare, medical, guardian, and private-boundary regressions", () => {
  const scripts = JSON.parse(packageJson).scripts;
  assert.match(scripts.verify, /verify:supabase/);
  assert.match(scripts.verify, /verify:release-integrity/);
  assert.match(scripts["verify:release-integrity"], /test-batch7-release-integrity/);
  assert.match(welfare, /default-off|default off/i);
  assert.match(welfare, /private staff page must fail closed/i);
  assert.match(academy, /Payroll approval must be explicitly gated/);
  assert.match(academy, /private_note/);
  assert.match(medical, /unrelated guardian read restricted medical data/);
  assert.match(guardian, /guardian portal exposed private coach notes/);
});