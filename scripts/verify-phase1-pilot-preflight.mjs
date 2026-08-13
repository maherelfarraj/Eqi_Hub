import { readFile } from "node:fs/promises";
import process from "node:process";
import { evaluateProductionPreflight } from "./phase1-pilot-preflight.mjs";

const args = process.argv.slice(2);
const template = args[0] === "--template";
const snapshotPath = template ? args[1] : args[0];

if (!snapshotPath) {
  console.error(
    "Usage: node scripts/verify-phase1-pilot-preflight.mjs [--template] <snapshot.json>",
  );
  process.exit(2);
}

let snapshot;
try {
  snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
} catch (error) {
  console.error(
    `Unable to read ${snapshotPath}: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(2);
}

const result = evaluateProductionPreflight(snapshot, { template });
if (result.status === "invalid") {
  console.error("Production pilot preflight snapshot is invalid:");
  result.errors.forEach((error) => console.error(`- ${error}`));
  process.exit(2);
}
if (result.status === "hold") {
  console.error("Production pilot activation is on HOLD:");
  result.blockers.forEach((blocker) => console.error(`- ${blocker}`));
  process.exit(1);
}

if (template) {
  console.log(`Production pilot preflight template is valid: ${snapshotPath}`);
} else {
  console.log(
    `Production pilot preflight is READY for: ${result.candidate_organization_refs.join(", ")}`,
  );
}
