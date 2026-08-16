import { readFile } from "node:fs/promises";
import { buildBatch10Manifest, evaluateDatasetRelease, validateBatch11Config } from "./batch11-dataset-release-readiness.mjs";

const path = process.argv[2];
if (!path) { console.error("Usage: node scripts/verify-batch11-dataset-release-readiness.mjs <config.json>"); process.exit(1); }
const config = JSON.parse(await readFile(path, "utf8"));
const errors = validateBatch11Config(config);
const source = config.fixtures.find((fixture) => fixture.fixture_ref === "release-synthetic-ready")?.input;
function materialize(raw) {
  if (!raw?.source_fixture_ref) return structuredClone(raw);
  const input = structuredClone(source);
  if (raw.mutation === "remove-approval") input.release_approval = null;
  if (raw.mutation === "duplicate-content") input.rows[1].content_hash = input.rows[0].content_hash;
  if (raw.mutation === "partition-drift") input.rows[1].groups.horse_group_ref = input.rows[0].groups.horse_group_ref;
  return input;
}
for (const fixture of config.fixtures ?? []) {
  const input = materialize(fixture.input);
  if (input.batch10_manifest_hash === "GENERATE") input.batch10_manifest_hash = buildBatch10Manifest(input.rows);
  const result = evaluateDatasetRelease(input, config);
  if (result.decision !== fixture.expected_decision) errors.push(`${fixture.fixture_ref} expected ${fixture.expected_decision} but received ${result.decision}: ${result.rejection_codes.join(", ")}`);
}
if (errors.length) { console.error("Batch 11 dataset-release validation failed:"); errors.forEach((error) => console.error(`- ${error}`)); process.exit(1); }
console.log(`Batch 11 dataset-release readiness package is valid: ${path}`);
