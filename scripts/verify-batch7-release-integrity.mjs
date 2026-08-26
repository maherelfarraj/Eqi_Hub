import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { evaluateBatch7ReleaseIntegrity } from "./batch7-release-integrity.mjs";

const path = process.argv[2];
if (!path) {
  console.error(
    "Usage: node scripts/verify-batch7-release-integrity.mjs <evidence.json>",
  );
  process.exit(2);
}

async function readJson(filePath, label) {
  let source;
  try {
    source = await readFile(filePath, "utf8");
  } catch (error) {
    throw new Error(
      `${label} could not be read from ${filePath}: ${error.message}`,
    );
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(
      `${label} is not valid JSON at ${filePath}: ${error.message}`,
    );
  }
}

try {
  const schemaPath = fileURLToPath(
    new URL(
      "../intelligence/batch7-release-integrity.schema.json",
      import.meta.url,
    ),
  );
  const [config, schema] = await Promise.all([
    readJson(path, "Batch 7 evidence"),
    readJson(schemaPath, "Batch 7 evidence schema"),
  ]);
  const validateSchema = new Ajv2020({ allErrors: true, strict: true }).compile(
    schema,
  );
  const schemaValid = validateSchema(config);
  const result = evaluateBatch7ReleaseIntegrity(config);
  const errors = [
    ...(schemaValid
      ? []
      : (validateSchema.errors ?? []).map(
          (error) => `schema ${error.instancePath || "$"} ${error.message}`,
        )),
    ...result.rejection_codes,
  ];

  if (
    errors.length ||
    result.decision !== "ready-for-review" ||
    result.release_evidence.release_authorized !== false
  ) {
    console.error(`Batch 7 release-integrity validation failed for ${path}:`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(
      `Batch 7 synthetic release-integrity evidence is valid: ${path}`,
    );
  }
} catch (error) {
  console.error(
    `Batch 7 release-integrity validation could not evaluate ${path}: ${error.message}`,
  );
  process.exitCode = 1;
}
