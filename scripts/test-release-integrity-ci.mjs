import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [
  repositoryVerify,
  workerCi,
  supabaseReplay,
  packageJson,
  releaseDoc,
  schemaJson,
  releaseEvidenceJson,
  previewVerifier,
  welfare,
  academy,
  medical,
  guardian,
] = await Promise.all([
  read(".github/workflows/repository-verify.yml"),
  read(".github/workflows/worker-ci.yml"),
  read(".github/workflows/verify-supabase-replay.yml"),
  read("package.json"),
  read("docs/BATCH_7_RELEASE_INTEGRITY.md"),
  read("intelligence/batch7-release-integrity.schema.json"),
  read("intelligence/batch7-release-integrity.example.json"),
  read("scripts/supabase-preview-check.mjs"),
  read("scripts/test-horse-welfare-stable-operations.mjs"),
  read("scripts/test-staff-arena-academy-operations.mjs"),
  read("scripts/test-medical-waiver-gate.mjs"),
  read("scripts/test-guardian-view.mjs"),
]);
const releaseEvidence = JSON.parse(releaseEvidenceJson);

test("repository verify provides an always-present protected context", () => {
  assert.match(repositoryVerify, /^  pull_request:\s*$/m);
  assert.match(repositoryVerify, /^  push:\n    branches: \[main\]$/m);
  assert.match(repositoryVerify, /\n  verify:\n    name: verify/);
  assert.match(repositoryVerify, /supabase-preview-gate:/);
  assert.match(repositoryVerify, /needs: supabase-preview-gate/);
  assert.match(
    repositoryVerify,
    /check-runs\?filter=all&per_page=100&page=\$page/,
  );
  assert.match(repositoryVerify, /trusted_evaluator_ref="\$BASE_SHA"/);
  assert.doesNotMatch(repositoryVerify, /TRUSTED_PREVIEW_EVALUATOR_REF/);
  assert.doesNotMatch(
    repositoryVerify,
    /bootstrap evaluator|pinned bootstrap/i,
  );
  assert.doesNotMatch(repositoryVerify, /git cat-file -e/);
  assert.match(
    repositoryVerify,
    /git show "\$trusted_evaluator_ref:scripts\/verify-supabase-preview-check\.mjs"/,
  );
  assert.match(
    repositoryVerify,
    /node "\$trusted_evaluator_dir\/verify-supabase-preview-check\.mjs"/,
  );
  assert.doesNotMatch(
    repositoryVerify,
    /node scripts\/verify-supabase-preview-check\.mjs/,
  );
  assert.match(repositoryVerify, /preview_status=\$\{PIPESTATUS\[1\]\}/);
  assert.match(
    repositoryVerify,
    /Supabase Preview check-run pagination exceeded the safe limit/,
  );
  assert.match(repositoryVerify, /PORT: "4173"/);
  assert.match(repositoryVerify, /run: pnpm verify/);
  assert.match(repositoryVerify, /run: pnpm typecheck/);
  assert.match(repositoryVerify, /run: pnpm build/);
  assert.match(workerCi, /worker-verify:\n    name: worker-verify/);
  assert.doesNotMatch(workerCi, /\n  verify:\n    name: verify/);
});

test("Supabase replay covers schema and validation-contract changes", () => {
  for (const path of [
    "supabase/**",
    "scripts/**",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
  ]) {
    assert.match(
      supabaseReplay,
      new RegExp(`"${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`),
    );
  }
  const pullRequestPaths =
    supabaseReplay.match(/  pull_request:[\s\S]*?(?=\n  push:)/)?.[0] ?? "";
  const pushPaths =
    supabaseReplay.match(/  push:[\s\S]*?(?=\n\npermissions:)/)?.[0] ?? "";
  assert.match(
    pullRequestPaths,
    /"\.github\/workflows\/verify-supabase-replay\.yml"/,
  );
  assert.match(pushPaths, /"\.github\/workflows\/verify-supabase-replay\.yml"/);
  assert.match(
    supabaseReplay,
    /Activate pinned pnpm[\s\S]*corepack enable[\s\S]*corepack prepare pnpm@11\.16\.0 --activate[\s\S]*npm run verify:supabase/,
  );
  assert.match(supabaseReplay, /npm run verify:supabase/);
});

test("release policy defines required and pre-poll non-Supabase outcomes", () => {
  assert.match(
    releaseDoc,
    /supabase\/\*\*[\s\S]*Supabase[\s\S]*Preview[\s\S]*required/i,
  );
  assert.match(
    releaseDoc,
    /non-Supabase[\s\S]*supabase-preview-gate[\s\S]*exits successfully[\s\S]*before polling external check-runs/i,
  );
  assert.doesNotMatch(releaseDoc, /Supabase Preview[\s\S]*skipped/i);
  assert.match(releaseDoc, /missing, pending, cancelled, or failed.*fail/is);
  assert.match(releaseDoc, /supabase-replay[\s\S]*must[\s\S]*pass/i);
});

test("release evidence schema is sealed and validates exact approved coverage", () => {
  const schema = JSON.parse(schemaJson);
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(
    schema,
  );
  assert.equal(
    validate(releaseEvidence),
    true,
    JSON.stringify(validate.errors),
  );
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.safety.additionalProperties, false);
  assert.equal(schema.properties.role_matrix.items.additionalProperties, false);
  assert.equal(schema.properties.batches.maxItems, 4);
  assert.equal(schema.properties.batches.allOf.length, 4);
  assert.equal(schema.properties.role_matrix.maxItems, 7);
  assert.equal(schema.properties.role_matrix.allOf.length, 7);
  assert.equal(
    schema.properties.role_matrix.items.properties.stage_results.uniqueItems,
    true,
  );
  assert.equal(
    schema.properties.role_matrix.items.properties.stage_results.maxItems,
    3,
  );
  assert.match(previewVerifier, /SUPABASE_GITHUB_APP_ID = 330661/);
});

test("combined root verification executes approved evidence without duplicate suites", () => {
  const scripts = JSON.parse(packageJson).scripts;
  const releaseCommand = scripts["verify:release-integrity"];
  const supabaseCommand = scripts["verify:supabase"];
  const combinedCommand = `${scripts.verify} ${releaseCommand} ${supabaseCommand}`;
  assert.equal(
    scripts.verify,
    "pnpm verify:supabase && pnpm verify:release-integrity",
  );
  assert.match(releaseCommand, /test-batch7-release-integrity/);
  assert.match(releaseCommand, /test-release-integrity-ci/);
  assert.match(releaseCommand, /test-supabase-preview-check/);
  for (const duplicate of [
    "verify-guardian-view",
    "test-guardian-view",
    "verify-medical-waiver-gate",
    "test-medical-waiver-gate",
    "test-horse-welfare-stable-operations",
    "test-staff-arena-academy-operations",
    "test-academy-operations-migration-apply",
  ]) {
    assert.doesNotMatch(releaseCommand, new RegExp(duplicate));
    assert.match(supabaseCommand, new RegExp(duplicate));
  }
  const commandAliases = {
    "pnpm test:academy-operations": [
      "node scripts/test-staff-arena-academy-operations.mjs",
      "node scripts/test-academy-operations-migration-apply.mjs",
    ],
  };
  for (const batch of releaseEvidence.batches) {
    for (const expected of batch.commands) {
      const covered =
        combinedCommand.includes(expected) ||
        (commandAliases[expected]?.every((command) =>
          combinedCommand.includes(command),
        ) ??
          false);
      assert.ok(
        covered,
        `combined verification must execute Batch ${batch.batch} command: ${expected}`,
      );
    }
  }
});

test("root verify keeps focused payroll, welfare, medical, guardian, and private-boundary regressions", () => {
  const scripts = JSON.parse(packageJson).scripts;
  assert.match(scripts.verify, /verify:supabase/);
  assert.match(scripts.verify, /verify:release-integrity/);
  assert.match(welfare, /default-off|default off/i);
  assert.match(welfare, /private staff page must fail closed/i);
  assert.match(academy, /Payroll approval must be explicitly gated/);
  assert.match(academy, /private_note/);
  assert.match(medical, /unrelated guardian read restricted medical data/);
  assert.match(guardian, /guardian portal exposed private coach notes/);
});
