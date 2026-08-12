import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const supabaseRoot = resolve(repositoryRoot, "supabase");
const activeMigrationsRoot = resolve(supabaseRoot, "migrations");
const historyRoot = resolve(supabaseRoot, "migration-history");
const historyManifestPath = resolve(supabaseRoot, "migration-ledger.sha256");
const baselineManifestPath = resolve(supabaseRoot, "canonical-baseline.sha256");
const inventoryPath = resolve(
  supabaseRoot,
  "canonical-baseline.inventory.json",
);

const migrationNamePattern = /^\d{14}_[a-z0-9_]+\.sql$/;
const historyManifestLinePattern =
  /^([a-f0-9]{64})  migration-history\/(.+\.sql)$/;
const baselineManifestLinePattern = /^([a-f0-9]{64})  migrations\/(.+\.sql)$/;
const canonicalBaselineName =
  "20260812101436_canonical_live_schema_baseline.sql";

const activeMigrationFiles = (await readdir(activeMigrationsRoot))
  .filter((file) => file.endsWith(".sql"))
  .sort();

if (
  activeMigrationFiles.length !== 1 ||
  activeMigrationFiles[0] !== canonicalBaselineName
) {
  throw new Error(
    `Active replay path must contain only ${canonicalBaselineName}; found: ${activeMigrationFiles.join(", ") || "(none)"}`,
  );
}

if (!migrationNamePattern.test(canonicalBaselineName)) {
  throw new Error(
    `Invalid canonical migration filename: ${canonicalBaselineName}`,
  );
}

const historyFiles = (await readdir(historyRoot))
  .filter((file) => file.endsWith(".sql"))
  .sort();

const invalidHistoryNames = historyFiles.filter(
  (file) => !migrationNamePattern.test(file),
);
if (invalidHistoryNames.length > 0) {
  throw new Error(
    `Invalid forensic-history filename(s): ${invalidHistoryNames.join(", ")}`,
  );
}

const historyVersions = historyFiles.map((file) => file.slice(0, 14));
const duplicateHistoryVersions = historyVersions.filter(
  (version, index) => historyVersions.indexOf(version) !== index,
);
if (duplicateHistoryVersions.length > 0) {
  throw new Error(
    `Duplicate forensic-history version(s): ${[...new Set(duplicateHistoryVersions)].join(", ")}`,
  );
}

const historyManifestText = await readFile(historyManifestPath, "utf8");
const historyManifestEntries = new Map();

for (const line of historyManifestText.trim().split("\n")) {
  const match = line.match(historyManifestLinePattern);
  if (!match) {
    throw new Error(`Malformed forensic-history manifest line: ${line}`);
  }

  const [, expectedHash, file] = match;
  if (historyManifestEntries.has(file)) {
    throw new Error(`Duplicate forensic-history manifest entry: ${file}`);
  }
  historyManifestEntries.set(file, expectedHash);
}

const missingFromHistoryManifest = historyFiles.filter(
  (file) => !historyManifestEntries.has(file),
);
const missingFromHistoryDirectory = [...historyManifestEntries.keys()].filter(
  (file) => !historyFiles.includes(file),
);

if (
  missingFromHistoryManifest.length > 0 ||
  missingFromHistoryDirectory.length > 0
) {
  throw new Error(
    [
      missingFromHistoryManifest.length > 0
        ? `Missing from forensic manifest: ${missingFromHistoryManifest.join(", ")}`
        : null,
      missingFromHistoryDirectory.length > 0
        ? `Missing from forensic directory: ${missingFromHistoryDirectory.join(", ")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

const historyHashMismatches = [];
for (const file of historyFiles) {
  const contents = await readFile(resolve(historyRoot, file));
  const actualHash = createHash("sha256").update(contents).digest("hex");
  const withoutTerminalNewline =
    contents.at(-1) === 0x0a ? contents.subarray(0, -1) : contents;
  const normalizedHash = createHash("sha256")
    .update(withoutTerminalNewline)
    .digest("hex");
  const expectedHash = historyManifestEntries.get(file);
  if (actualHash !== expectedHash && normalizedHash !== expectedHash) {
    historyHashMismatches.push(
      `${file}: expected ${expectedHash}, got ${actualHash}`,
    );
  }
}

if (historyHashMismatches.length > 0) {
  throw new Error(
    `Forensic-history hash mismatch:\n${historyHashMismatches.join("\n")}`,
  );
}

const baselineManifestText = (
  await readFile(baselineManifestPath, "utf8")
).trim();
const baselineManifestMatch = baselineManifestText.match(
  baselineManifestLinePattern,
);
if (!baselineManifestMatch) {
  throw new Error(
    `Malformed canonical-baseline manifest line: ${baselineManifestText}`,
  );
}

const [, expectedBaselineHash, baselineManifestName] = baselineManifestMatch;
if (baselineManifestName !== canonicalBaselineName) {
  throw new Error(
    `Canonical manifest names ${baselineManifestName}, expected ${canonicalBaselineName}`,
  );
}

const baselineText = await readFile(
  resolve(activeMigrationsRoot, canonicalBaselineName),
  "utf8",
);
const actualBaselineHash = createHash("sha256")
  .update(baselineText)
  .digest("hex");
if (actualBaselineHash !== expectedBaselineHash) {
  throw new Error(
    `Canonical baseline hash mismatch: expected ${expectedBaselineHash}, got ${actualBaselineHash}`,
  );
}

const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const staticCounts = {
  tables: (baselineText.match(/^create table (?:public|private)\./gm) ?? [])
    .length,
  constraints: (
    baselineText.match(/^alter table only .* add constraint /gm) ?? []
  ).length,
  indexes_secondary: (baselineText.match(/^CREATE (?:UNIQUE )?INDEX /gm) ?? [])
    .length,
  functions: (
    baselineText.match(/^CREATE OR REPLACE FUNCTION (?:public|private)\./gm) ??
    []
  ).length,
  triggers: (baselineText.match(/^CREATE TRIGGER /gm) ?? []).length,
  rls_tables: (
    baselineText.match(
      /^alter table (?:public|private)\..* enable row level security;/gm,
    ) ?? []
  ).length,
  policies: (baselineText.match(/^create policy /gm) ?? []).length,
};

const expectedStaticCounts = {
  tables: inventory.counts.tables,
  constraints: inventory.counts.constraints,
  indexes_secondary: inventory.counts.indexes_secondary,
  functions: inventory.counts.functions,
  triggers: inventory.counts.triggers,
  rls_tables: inventory.counts.rls_tables,
  policies:
    inventory.counts.policies_application + inventory.counts.policies_storage,
};

for (const [category, expected] of Object.entries(expectedStaticCounts)) {
  const actual = staticCounts[category];
  if (actual !== expected) {
    throw new Error(
      `Canonical baseline ${category} count mismatch: expected ${expected}, got ${actual}`,
    );
  }
}

const terminatedFunctionBodies = (baselineText.match(/\$function\$;/g) ?? [])
  .length;
if (terminatedFunctionBodies !== inventory.counts.functions) {
  throw new Error(
    `Canonical baseline function terminator count mismatch: expected ${inventory.counts.functions}, got ${terminatedFunctionBodies}`,
  );
}

if (baselineText.includes('"unknown (OID=0)"')) {
  throw new Error(
    "Canonical baseline contains an unnormalized ACL grantee OID 0",
  );
}

for (const schema of ["public", "private"]) {
  if (!baselineText.includes(`alter schema ${schema} owner to postgres;`)) {
    throw new Error(
      `Canonical baseline does not preserve the live owner for schema ${schema}`,
    );
  }
}

if (inventory.counts.vault_secrets !== 0) {
  throw new Error("Canonical inventory unexpectedly includes Vault secrets");
}

console.log(
  [
    `Verified active canonical baseline ${canonicalBaselineName}`,
    `Verified ${historyFiles.length} live-equivalent forensic migrations (terminal-newline normalization only)`,
    `Verified live inventory counts and replay guards for ${Object.keys(staticCounts).length} schema categories`,
  ].join("\n"),
);
