import { readFile } from "node:fs/promises";
import { evaluateBatch7ReleaseIntegrity, validateBatch7ReleaseIntegrity } from "./batch7-release-integrity.mjs";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scripts/verify-batch7-release-integrity.mjs <evidence.json>");
  process.exit(2);
}

const config = JSON.parse(await readFile(path, "utf8"));
const errors = validateBatch7ReleaseIntegrity(config);
const result = evaluateBatch7ReleaseIntegrity(config);
if (errors.length || result.decision !== "ready-for-review" || result.release_evidence.release_authorized !== false) {
  console.error("Batch 7 release-integrity validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Batch 7 synthetic release-integrity evidence is valid: ${path}`);