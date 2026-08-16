import { readFile } from "node:fs/promises";
import { evaluateProgramCloseout, validateBatch20Config } from "./batch20-program-closeout.mjs";

const path = process.argv[2];
if (!path) {
  console.error("usage: node scripts/verify-batch20-program-closeout.mjs <config-path>");
  process.exit(2);
}
const config = JSON.parse(await readFile(path, "utf8"));
const errors = validateBatch20Config(config);
const ready = config.fixtures?.find((fixture) => fixture.fixture_ref === "closeout-ready")?.input;

function materialize(input) {
  if (!input?.source_fixture_ref) return structuredClone(input);
  const candidate = structuredClone(ready);
  if (input.mutation === "attestation") candidate.batch19_attestation.attestation_hash = "0".repeat(64);
  if (input.mutation === "evidence") candidate.closeout.evidence_hashes = [];
  if (input.mutation === "finding") candidate.closeout.unresolved_findings = 1;
  if (input.mutation === "approval") candidate.closeout.approvals = [];
  if (input.mutation === "retention") candidate.closeout.retention_days = 1;
  if (input.mutation === "release") candidate.closeout.release_authorized = true;
  return candidate;
}

for (const fixture of config.fixtures ?? []) {
  const result = evaluateProgramCloseout(materialize(fixture.input), config);
  if (result.decision !== fixture.expected_decision || (fixture.expected_code && !result.rejection_codes.includes(fixture.expected_code))) errors.push(`${fixture.fixture_ref} failed`);
}
if (errors.length) {
  errors.forEach((error) => console.error(error));
  process.exit(1);
}
console.log(`Batch 20 offline program-closeout package is valid: ${path}`);
