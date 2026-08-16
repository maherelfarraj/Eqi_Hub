import { readFile } from "node:fs/promises";
import { evaluateTrainingPreflight, validateBatch12Config } from "./batch12-training-preflight.mjs";

const path = process.argv[2];
if (!path) { console.error("Usage: node scripts/verify-batch12-training-preflight.mjs <config.json>"); process.exit(1); }
const config = JSON.parse(await readFile(path, "utf8"));
const errors = validateBatch12Config(config);
const source = config.fixtures.find((fixture) => fixture.fixture_ref === "preflight-synthetic-ready")?.input;
function materialize(raw) {
  if (!raw?.source_fixture_ref) return structuredClone(raw);
  const input = structuredClone(source);
  if (raw.mutation === "release-hash") input.batch11_release.release_manifest_hash = "0".repeat(64);
  if (raw.mutation === "split-leakage") input.plan.training_splits.push("golden");
  if (raw.mutation === "nondeterministic") input.plan.seed = null;
  if (raw.mutation === "resource-limit") input.plan.resources.gpu_hours = config.resource_limits.maximum_gpu_hours + 1;
  if (raw.mutation === "execution") input.plan.execution_enabled = true;
  return input;
}
for (const fixture of config.fixtures ?? []) {
  const result = evaluateTrainingPreflight(materialize(fixture.input), config);
  if (result.decision !== fixture.expected_decision || (fixture.expected_code && !result.rejection_codes.includes(fixture.expected_code))) errors.push(`${fixture.fixture_ref} did not produce ${fixture.expected_decision}/${fixture.expected_code ?? "none"}`);
}
if (errors.length) { console.error("Batch 12 training-preflight validation failed:"); errors.forEach((error) => console.error(`- ${error}`)); process.exit(1); }
console.log(`Batch 12 offline training-preflight package is valid: ${path}`);
