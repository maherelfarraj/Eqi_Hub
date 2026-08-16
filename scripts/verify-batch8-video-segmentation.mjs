import { readFile } from "node:fs/promises";
import { evaluateVideoSegmentation, planDatasetSplits, validateBatch8Config } from "./batch8-video-segmentation.mjs";

const configPath = process.argv[2];
if (!configPath) {
  console.error("Usage: node scripts/verify-batch8-video-segmentation.mjs <config.json>");
  process.exit(1);
}

const config = JSON.parse(await readFile(configPath, "utf8"));
const errors = validateBatch8Config(config);
for (const fixture of config.fixtures ?? []) {
  const result = evaluateVideoSegmentation(fixture.input, config);
  if (result.decision !== fixture.expected_decision) errors.push(`${fixture.fixture_ref} expected ${fixture.expected_decision} but received ${result.decision}`);
}
const accepted = (config.fixtures ?? []).filter((fixture) => fixture.expected_decision === "accepted").map((fixture) => fixture.input);
if (accepted.length > 1 && planDatasetSplits(accepted, config).decision !== "accepted") errors.push("accepted fixtures must produce a dataset split plan");

if (errors.length) {
  console.error("Batch 8 video-segmentation validation failed:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log(`Batch 8 video-segmentation and lineage package is valid: ${configPath}`);
