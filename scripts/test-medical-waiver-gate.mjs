import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { validateMedicalWaiverGate } from "./verify-medical-waiver-gate.mjs";

const root = resolve(import.meta.dirname, "..");
const [migration, rollback, acceptance] = await Promise.all([
  readFile(
    resolve(
      root,
      "supabase/migrations/20260815135957_batch4_medical_waiver_gate.sql",
    ),
    "utf8",
  ),
  readFile(
    resolve(
      root,
      "supabase/rollback/20260815135957_batch4_medical_waiver_gate_rollback.sql",
    ),
    "utf8",
  ),
  readFile(resolve(root, "tests/rls/batch_4_medical_waiver_gate.sql"), "utf8"),
]);

test("accepts the medical, waiver, and consent gate", () => {
  assert.deepEqual(validateMedicalWaiverGate(migration, rollback), []);
});

test("rejects an unversioned signature readiness check", () => {
  const unsafe = migration.replace(
    "and submission.template_version = template.version",
    "",
  );
  assert.ok(
    validateMedicalWaiverGate(unsafe, rollback).includes(
      "readiness must bind the active template version",
    ),
  );
});

test("rejects mutable signature receipts", () => {
  const unsafe = migration.replace(
    /create trigger compliance_signature_immutable[\s\S]*?;\n/,
    "",
  );
  assert.ok(
    validateMedicalWaiverGate(unsafe, rollback).includes(
      "signature receipts must be immutable",
    ),
  );
});

test("acceptance covers adult, minor, isolation, expiry, and gates", () => {
  for (const message of [
    "adult rider did not become lesson ready",
    "minor rider signed without a verified legal guardian",
    "unrelated guardian read restricted medical data",
    "expired waiver satisfied lesson readiness",
    "pending medical review satisfied renewal readiness",
    "lesson booking bypassed compliance readiness",
    "membership renewal bypassed compliance readiness",
    "signature receipt was mutable",
  ])
    assert.match(acceptance, new RegExp(message));
});

test("rejects portal coupling to private notes or payment credentials", () => {
  const unsafe = migration.replace(
    "'rider_id', p_rider_id,",
    "'payment_method', (select payment_method_id from public.invoices limit 1), 'rider_id', p_rider_id,",
  );
  assert.ok(
    validateMedicalWaiverGate(unsafe, rollback).includes(
      "compliance portal must not couple to private coach notes or payment credentials",
    ),
  );
});
