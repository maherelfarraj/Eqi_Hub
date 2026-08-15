import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { validateGuardianView } from "./verify-guardian-view.mjs";

const root = resolve(import.meta.dirname, "..");
const [migration, rollback, acceptance, indexFix, indexRollback] =
  await Promise.all([
    readFile(
      resolve(
        root,
        "supabase/migrations/20260815090638_guardian_view_foundation.sql",
      ),
      "utf8",
    ),
    readFile(
      resolve(
        root,
        "supabase/rollback/20260815090638_guardian_view_foundation_rollback.sql",
      ),
      "utf8",
    ),
    readFile(resolve(root, "tests/rls/batch_3_guardian_view.sql"), "utf8"),
    readFile(
      resolve(
        root,
        "supabase/migrations/20260815093048_guardian_view_relationship_indexes.sql",
      ),
      "utf8",
    ),
    readFile(
      resolve(
        root,
        "supabase/rollback/20260815093048_guardian_view_relationship_indexes_rollback.sql",
      ),
      "utf8",
    ),
  ]);

test("accepts the guardian view foundation", () => {
  assert.deepEqual(
    validateGuardianView(migration, rollback, indexFix, indexRollback),
    [],
  );
});

test("rejects a missing composite relationship index", () => {
  const unsafe = indexFix.replace(
    /create index guardian_access_events_relationship_idx[\s\S]*?;\n/,
    "",
  );
  assert.ok(
    validateGuardianView(migration, rollback, unsafe, indexRollback).includes(
      "missing composite relationship index: guardian_access_events_relationship_idx",
    ),
  );
});

test("acceptance covers relationship, approval, and isolation boundaries", () => {
  for (const message of [
    "verified guardian cannot open linked rider portal",
    "guardian approved a permission they were not granted",
    "supporter approved a legal decision",
    "adulthood-review-due guardian retained rider access",
    "guardian can read an unrelated minor",
    "guardian portal exposed private coach notes",
    "guardian audit event was mutable",
  ])
    assert.match(acceptance, new RegExp(message));
});

test("rejects verification and adulthood-review bypasses", () => {
  const noVerification = migration.replace(
    "and link.verification_status = 'verified'",
    "and link.verification_status <> 'revoked'",
  );
  assert.ok(
    validateGuardianView(
      noVerification,
      rollback,
      indexFix,
      indexRollback,
    ).includes("guardian access must require verification"),
  );

  const noReview = migration.replace(
    "and (link.adulthood_review_on is null or link.adulthood_review_on > current_date)",
    "",
  );
  assert.ok(
    validateGuardianView(noReview, rollback, indexFix, indexRollback).includes(
      "guardian access must stop at adulthood review",
    ),
  );
});

test("rejects supporter approval widening", () => {
  const unsafe = migration.replace(
    "relationship_type <> 'supporter'",
    "relationship_type = 'supporter'",
  );
  assert.ok(
    validateGuardianView(unsafe, rollback, indexFix, indexRollback).includes(
      "supporters must remain approval-free",
    ),
  );
});

test("rejects private-note or payment-secret coupling", () => {
  const unsafe = migration.replace(
    "'relationship', jsonb_build_object(",
    "'privateNotes', (select jsonb_agg(note) from public.lesson_development_private_notes), 'relationship', jsonb_build_object(",
  );
  assert.ok(
    validateGuardianView(unsafe, rollback, indexFix, indexRollback).includes(
      "guardian portal must not reference private notes or credentials",
    ),
  );
});
