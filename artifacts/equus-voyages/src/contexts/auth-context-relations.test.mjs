import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("./AuthContext.tsx", import.meta.url),
  "utf8",
);

test("organization membership uses the canonical organization foreign key", () => {
  assert.match(
    source,
    /organizations!organization_memberships_organization_id_fkey\(/,
  );
  assert.doesNotMatch(
    source,
    /organization_id, organizations\(id, name, slug, organization_type, active\)/,
  );
});
