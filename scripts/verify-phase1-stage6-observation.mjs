import { readFile } from "node:fs/promises";
import process from "node:process";
import {
  evaluateStage6Exit,
  validateStage6Observation,
} from "./phase1-stage6-observation.mjs";

const args = process.argv.slice(2);
const template = args[0] === "--template";
const manifestPath = template ? args[1] : args[0];

if (!manifestPath) {
  console.error(
    "Usage: node scripts/verify-phase1-stage6-observation.mjs [--template] <manifest.json>",
  );
  process.exit(2);
}

let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch (error) {
  console.error(
    `Unable to read ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(2);
}

const errors = validateStage6Observation(manifest, { template });
if (errors.length > 0) {
  console.error("Batch 5 observation validation failed:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

if (template) {
  console.log(`Batch 5 observation template is valid: ${manifestPath}`);
  process.exit(0);
}

const result = evaluateStage6Exit(manifest);
console.log(JSON.stringify(result, null, 2));
if (manifest.status === "complete" && !result.ready) process.exit(1);
