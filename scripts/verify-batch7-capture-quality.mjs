import { readFile } from "node:fs/promises";
import process from "node:process";
import { validateBatch7Config } from "./batch7-capture-quality.mjs";

const configPath = process.argv[2];
if (!configPath) {
  console.error("Usage: node scripts/verify-batch7-capture-quality.mjs <config.json>");
  process.exit(2);
}

let config;
try {
  config = JSON.parse(await readFile(configPath, "utf8"));
} catch (error) {
  console.error(`Unable to read ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}

const errors = validateBatch7Config(config);
if (errors.length) {
  console.error("Batch 7 capture-quality validation failed:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log(`Batch 7 capture-quality package is valid: ${configPath}`);
