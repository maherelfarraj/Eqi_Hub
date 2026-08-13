import assert from "node:assert/strict";
import test from "node:test";

import { getSafeAvatarUrl } from "./avatar-security.ts";

test("allows HTTPS and same-origin HTTP avatar URLs", () => {
  assert.equal(
    getSafeAvatarUrl("https://storage.example.com/avatar.png", "https://equivista.net"),
    "https://storage.example.com/avatar.png",
  );
  assert.equal(
    getSafeAvatarUrl("/avatar.png", "http://localhost:4173"),
    "http://localhost:4173/avatar.png",
  );
});

test("rejects executable and insecure remote URL schemes", () => {
  assert.equal(getSafeAvatarUrl("javascript:alert(1)", "https://equivista.net"), null);
  assert.equal(getSafeAvatarUrl("data:text/html,<script>alert(1)</script>", "https://equivista.net"), null);
  assert.equal(getSafeAvatarUrl("http://storage.example.com/avatar.png", "https://equivista.net"), null);
});
