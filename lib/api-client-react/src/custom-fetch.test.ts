import assert from "node:assert/strict";
import test from "node:test";

import { normalizeBaseUrl } from "./custom-fetch.ts";

test("normalizeBaseUrl removes every trailing slash", () => {
  assert.equal(normalizeBaseUrl("https://api.example.com///"), "https://api.example.com");
  assert.equal(normalizeBaseUrl("/"), "");
});

test("normalizeBaseUrl leaves embedded slashes unchanged", () => {
  assert.equal(normalizeBaseUrl("https://api.example.com/v1"), "https://api.example.com/v1");
});

test("normalizeBaseUrl handles a large adversarial value in linear work", () => {
  const value = `${"a/".repeat(100_000)}endpoint${"/".repeat(100_000)}`;
  assert.equal(normalizeBaseUrl(value), `${"a/".repeat(100_000)}endpoint`);
});
