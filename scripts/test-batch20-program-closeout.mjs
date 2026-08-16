import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildBatch19AttestationHash, evaluateProgramCloseout, validateBatch20Config } from "./batch20-program-closeout.mjs";

const config = JSON.parse(await readFile(new URL("../intelligence/batch20-program-closeout.example.json", import.meta.url), "utf8"));
const source = config.fixtures.find((fixture) => fixture.fixture_ref === "closeout-ready").input;
const input = () => structuredClone(source);

test("accepts the Batch 20 config", () => assert.deepEqual(validateBatch20Config(config), []));
test("requires documentation evidence", () => {
  const candidate = structuredClone(config);
  delete candidate.evidence_ref;
  assert.ok(validateBatch20Config(candidate).some((error) => error.includes("evidence_ref")));
});
test("requires the complete fixture matrix", () => {
  const candidate = structuredClone(config);
  candidate.fixtures.pop();
  assert.ok(validateBatch20Config(candidate).some((error) => error.includes("fixtures")));
});
test("closes complete evidence", () => assert.equal(evaluateProgramCloseout(input(), config).decision, "closed"));
test("keeps release unauthorized", () => assert.equal(evaluateProgramCloseout(input(), config).closeout_manifest.release_authorized, false));
test("recomputes Batch 19 lineage", () => assert.equal(buildBatch19AttestationHash(input().batch19_attestation), config.approved_batch19_attestation_hash));
test("rejects a substituted attestation", () => {
  const candidate = input();
  candidate.batch19_attestation.attestation.next_drill_days++;
  candidate.batch19_attestation.attestation_hash = buildBatch19AttestationHash(candidate.batch19_attestation);
  assert.ok(evaluateProgramCloseout(candidate, config).rejection_codes.includes("attestation-unpinned"));
});
test("requires unique evidence", () => {
  const candidate = input();
  candidate.closeout.evidence_hashes[2] = candidate.closeout.evidence_hashes[0];
  assert.ok(evaluateProgramCloseout(candidate, config).rejection_codes.includes("evidence-incomplete"));
});
test("requires zero findings", () => {
  const candidate = input();
  candidate.closeout.unresolved_findings = 1;
  assert.ok(evaluateProgramCloseout(candidate, config).rejection_codes.includes("findings-open"));
});
test("requires independent approval", () => {
  const candidate = input();
  candidate.closeout.approvals[1].approver_ref = candidate.closeout.approvals[0].approver_ref;
  assert.ok(evaluateProgramCloseout(candidate, config).rejection_codes.includes("approval-incomplete"));
});
test("requires approval evidence", () => {
  const candidate = input();
  delete candidate.closeout.approvals[0].evidence_ref;
  assert.ok(evaluateProgramCloseout(candidate, config).rejection_codes.includes("approval-incomplete"));
});
test("fails closed for malformed approvals", () => {
  const candidate = input();
  candidate.closeout.approvals = {};
  assert.ok(evaluateProgramCloseout(candidate, config).rejection_codes.includes("approval-incomplete"));
});
test("bounds retention", () => {
  const candidate = input();
  candidate.closeout.retention_days = 1;
  assert.ok(evaluateProgramCloseout(candidate, config).rejection_codes.includes("retention-invalid"));
});
test("allows only archived-not-released", () => {
  const candidate = input();
  candidate.closeout.disposition = "released";
  assert.ok(evaluateProgramCloseout(candidate, config).rejection_codes.includes("release-enabled"));
});
test("produces a deterministic hash", () => assert.equal(evaluateProgramCloseout(input(), config).closeout_manifest.closeout_hash, evaluateProgramCloseout(input(), config).closeout_manifest.closeout_hash));
test("hash changes with closeout evidence", () => {
  const first = evaluateProgramCloseout(input(), config).closeout_manifest.closeout_hash;
  const candidate = input();
  candidate.closeout.retention_days = 366;
  const second = evaluateProgramCloseout(candidate, config).closeout_manifest.closeout_hash;
  assert.notEqual(first, second);
});
test("isolates the emitted manifest", () => {
  const candidate = input();
  const result = evaluateProgramCloseout(candidate, config);
  candidate.closeout.retention_days = 400;
  assert.equal(result.closeout_manifest.closeout.retention_days, 365);
});
test("rejects sensitive fields", () => {
  const candidate = input();
  candidate.closeout.api_token = "unsafe";
  assert.ok(evaluateProgramCloseout(candidate, config).rejection_codes.includes("invalid-input"));
});
test("keeps Supabase and cohort changes disabled", () => {
  const candidate = structuredClone(config);
  candidate.safety.database_changes = true;
  candidate.safety.cohort_changes = true;
  const errors = validateBatch20Config(candidate);
  assert.ok(errors.some((error) => error.includes("database_changes")) && errors.some((error) => error.includes("cohort_changes")));
});
