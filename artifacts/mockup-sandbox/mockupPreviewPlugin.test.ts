import assert from "node:assert/strict";
import test from "node:test";

import { isSafeMockupModulePath } from "./mockupPreviewPlugin.ts";

test("accepts repository-controlled TypeScript mockup paths", () => {
  assert.equal(isSafeMockupModulePath("src/components/mockups/RideCard.tsx"), true);
  assert.equal(isSafeMockupModulePath("src/components/mockups/v2/ride-card_2.tsx"), true);
});

test("rejects traversal, hidden, absolute, and injectable paths", () => {
  for (const candidate of [
    "../escape.tsx",
    "/absolute.tsx",
    "src/components/mockups/_internal/Secret.tsx",
    "src/components/mockups/Bad\"Path.tsx",
    "src/components/mockups/Bad\nPath.tsx",
    "src/components/mockups/not-typescript.js",
  ]) {
    assert.equal(isSafeMockupModulePath(candidate), false, candidate);
  }
});
