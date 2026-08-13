import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateLinkedPersonaMigration } from "./verify-phase1-linked-persona-access.mjs";

const migration = await readFile(
  resolve(
    import.meta.dirname,
    "../supabase/migrations/20260813204459_linked_persona_access.sql",
  ),
  "utf8",
);

test("accepts the committed linked-persona migration", () => {
  assert.deepEqual(validateLinkedPersonaMigration(migration), []);
});

test("rejects missing guardian-link activity checks", () => {
  const unsafe = migration.replaceAll("and link.active", "");
  assert.ok(
    validateLinkedPersonaMigration(unsafe).some((error) =>
      error.includes("link\\.active"),
    ),
  );
});

test("rejects missing canonical horse-access activity checks", () => {
  const unsafe = migration.replace("and access.active", "");
  assert.ok(
    validateLinkedPersonaMigration(unsafe).some((error) =>
      error.includes("access\\.active"),
    ),
  );
});

test("rejects deprecated auth.role authorization", () => {
  const unsafe = `${migration}\nselect auth.role();\n`;
  assert.ok(
    validateLinkedPersonaMigration(unsafe).includes(
      "must not use deprecated auth.role()",
    ),
  );
});

test("rejects any Stage 4 write policy", () => {
  const unsafe = `${migration}\ncreate policy guardian_update on public.profiles for update to authenticated using (true);\n`;
  assert.ok(
    validateLinkedPersonaMigration(unsafe).includes(
      "Stage 4 must not create or replace write policies",
    ),
  );
});

test("rejects non-transactional migration text", () => {
  const unsafe = migration.replace(/^begin;/m, "").replace(/commit;\s*$/i, "");
  assert.ok(
    validateLinkedPersonaMigration(unsafe).includes(
      "migration must be transactional",
    ),
  );
});
