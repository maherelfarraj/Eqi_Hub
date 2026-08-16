import { readFile } from "node:fs/promises";
import { evaluateExperimentEvidence, validateBatch13Config } from "./batch13-experiment-evaluation.mjs";

const path = process.argv[2];
if (!path) { console.error("Usage: node scripts/verify-batch13-experiment-evaluation.mjs <config.json>"); process.exit(1); }
const config = JSON.parse(await readFile(path, "utf8")); const errors = validateBatch13Config(config);
const source = config.fixtures.find((fixture) => fixture.fixture_ref === "evaluation-synthetic-ready")?.input;
function materialize(raw) {
  if (!raw?.source_fixture_ref) return structuredClone(raw);
  const input = structuredClone(source);
  if (raw.mutation === "preflight") input.batch12_preflight.reproducibility_hash = "0".repeat(64);
  if (raw.mutation === "provenance") input.run.artifact_hash = null;
  if (raw.mutation === "holdout") input.run.model_selection_splits.push("test");
  if (raw.mutation === "quality") input.run.metrics.test.pck = 0.1;
  if (raw.mutation === "overfit") input.run.metrics.validation.pck = 0.99;
  if (raw.mutation === "execution") input.run.model_inference = true;
  return input;
}
for (const fixture of config.fixtures ?? []) {
  const result = evaluateExperimentEvidence(materialize(fixture.input), config);
  if (result.decision !== fixture.expected_decision || (fixture.expected_code && !result.rejection_codes.includes(fixture.expected_code))) errors.push(`${fixture.fixture_ref} did not produce ${fixture.expected_decision}/${fixture.expected_code ?? "none"}`);
}
if (errors.length) { console.error("Batch 13 experiment-evaluation validation failed:"); errors.forEach((error) => console.error(`- ${error}`)); process.exit(1); }
console.log(`Batch 13 offline experiment-evaluation package is valid: ${path}`);
