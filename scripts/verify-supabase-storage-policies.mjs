import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const migrationsRoot =
  process.env.SUPABASE_MIGRATIONS_PATH ??
  resolve(repositoryRoot, "supabase", "migrations");
const migrationSuffix = "_replace_deprecated_storage_auth_role_policies.sql";
const migrationNames = (await readdir(migrationsRoot)).filter((name) =>
  name.endsWith(migrationSuffix),
);

if (migrationNames.length !== 1) {
  throw new Error(
    `Expected exactly one ${migrationSuffix} migration, found ${migrationNames.length}`,
  );
}

const migrationText = await readFile(
  resolve(migrationsRoot, migrationNames[0]),
  "utf8",
);

function normalizeSql(sql) {
  return sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*([(),;])\s*/g, "$1")
    .trim()
    .toLowerCase();
}

const ownershipPredicate =
  "(storage.foldername(name))[1] = (select auth.uid())::text";
const expectedMigration = normalizeSql(`
  begin;

  alter policy storage_user_delete_own
  on storage.objects
  to authenticated
  using (${ownershipPredicate});

  alter policy storage_user_read_own
  on storage.objects
  to authenticated
  using (${ownershipPredicate});

  alter policy storage_user_update_own
  on storage.objects
  to authenticated
  using (${ownershipPredicate})
  with check (${ownershipPredicate});

  alter policy storage_user_upload
  on storage.objects
  to authenticated
  with check (${ownershipPredicate});

  commit;
`);

const actualMigration = normalizeSql(migrationText);

if (/auth\.role\s*\(/i.test(migrationText)) {
  throw new Error("Storage policy migration must not use deprecated auth.role()");
}

if (/\bto\s+(?:public|anon)\b/i.test(migrationText)) {
  throw new Error("Storage ownership policies must not target public or anon");
}

if (actualMigration !== expectedMigration) {
  throw new Error(
    "Storage policy migration must atomically target authenticated users, preserve folder ownership, and give UPDATE both USING and WITH CHECK",
  );
}

console.log(
  `Verified ${migrationNames[0]} replaces four deprecated Storage policy role checks without widening access`,
);
