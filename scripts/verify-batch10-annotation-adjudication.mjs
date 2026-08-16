import { readFile } from "node:fs/promises";
import { adjudicateAnnotation, buildDatasetExport, validateBatch10Config } from "./batch10-annotation-adjudication.mjs";

const configPath = process.argv[2];
if (!configPath) {
  console.error("Usage: node scripts/verify-batch10-annotation-adjudication.mjs <config.json>");
  process.exit(1);
}
const config = JSON.parse(await readFile(configPath, "utf8"));
const errors = validateBatch10Config(config);
for (const fixture of config.fixtures ?? []) {
  const result = adjudicateAnnotation(fixture.input, config);
  if (result.decision !== fixture.expected_decision) errors.push(`${fixture.fixture_ref} expected ${fixture.expected_decision} but received ${result.decision}`);
}
for (const fixture of config.export_fixtures ?? []) {
  const result = buildDatasetExport(fixture.items, config);
  if (result.decision !== fixture.expected_decision) errors.push(`${fixture.fixture_ref} expected ${fixture.expected_decision} but received ${result.decision}`);
}
if (errors.length) {
  console.error("Batch 10 annotation-adjudication validation failed:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log(`Batch 10 annotation-adjudication and export package is valid: ${configPath}`);
