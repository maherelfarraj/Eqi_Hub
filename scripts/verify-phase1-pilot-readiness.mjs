import { readFile } from "node:fs/promises";
import process from "node:process";
import { validatePilotManifest } from "./phase1-pilot-readiness.mjs";

const args = process.argv.slice(2);
const template = args[0] === "--template";
const manifestPath = template ? args[1] : args[0];

if (!manifestPath) {
  console.error(
    "Usage: node scripts/verify-phase1-pilot-readiness.mjs [--template] <manifest.json>",
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

const errors = validatePilotManifest(manifest, { template });
if (errors.length > 0) {
  console.error("Controlled-pilot readiness validation failed:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(
  `${template ? "Pilot template" : "Pilot activation manifest"} is valid: ${manifestPath}`,
);
