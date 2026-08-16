import { readFile } from "node:fs/promises";
import process from "node:process";
import { validateBatch6Feasibility } from "./batch6-feasibility.mjs";

const manifestPath = process.argv[2];
if (!manifestPath) {
  console.error("Usage: node scripts/verify-batch6-feasibility.mjs <manifest.json>");
  process.exit(2);
}

let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch (error) {
  console.error(`Unable to read ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}

const errors = validateBatch6Feasibility(manifest);
if (errors.length) {
  console.error("Batch 6 feasibility validation failed:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log(`Batch 6 feasibility package is valid: ${manifestPath}`);
