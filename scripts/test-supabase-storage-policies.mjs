import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const migrationPath = resolve(
  repositoryRoot,
  "supabase",
  "migrations",
  "20260812172840_replace_deprecated_storage_auth_role_policies.sql",
);
const verifierPath = resolve(
  repositoryRoot,
  "scripts",
  "verify-supabase-storage-policies.mjs",
);
const migrationText = await readFile(migrationPath, "utf8");

async function expectRejected(name, sql, messagePattern) {
  const fixtureRoot = await mkdtemp(resolve(tmpdir(), "eqi-storage-policy-"));

  try {
    await writeFile(resolve(fixtureRoot, basename(migrationPath)), sql);
    const result = spawnSync(process.execPath, [verifierPath], {
      encoding: "utf8",
      env: { ...process.env, SUPABASE_MIGRATIONS_PATH: fixtureRoot },
    });

    assert.notEqual(result.status, 0, `${name} fixture was accepted`);
    assert.match(result.stderr, messagePattern);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}

await expectRejected(
  "public target",
  migrationText.replace("to authenticated", "to public"),
  /must not target public or anon/,
);

await expectRejected(
  "deprecated auth.role()",
  migrationText.replace(
    "(storage.foldername(name))[1] = (select auth.uid())::text",
    "auth.role() = 'authenticated'",
  ),
  /must not use deprecated auth\.role\(\)/,
);

await expectRejected(
  "UPDATE without WITH CHECK",
  migrationText.replace(
    /\nwith check \(\n  \(storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text\n\);/,
    ";",
  ),
  /give UPDATE both USING and WITH CHECK/,
);

console.log("Verified unsafe Storage policy migration variants are rejected");
