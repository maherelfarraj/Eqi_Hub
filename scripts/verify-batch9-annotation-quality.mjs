import { readFile } from "node:fs/promises";
import { evaluateAnnotation, validateBatch9Config } from "./batch9-annotation-quality.mjs";

const configPath = process.argv[2];
if (!configPath) {
  console.error("Usage: node scripts/verify-batch9-annotation-quality.mjs <config.json>");
  process.exit(1);
}
const config = JSON.parse(await readFile(configPath, "utf8"));
const errors = validateBatch9Config(config);
for (const fixture of config.fixtures ?? []) {
  const result = evaluateAnnotation(fixture.input, config);
  if (result.decision !== fixture.expected_decision) errors.push(`${fixture.fixture_ref} expected ${fixture.expected_decision} but received ${result.decision}`);
}
if (errors.length) {
  console.error("Batch 9 annotation-quality validation failed:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log(`Batch 9 annotation-quality package is valid: ${configPath}`);
