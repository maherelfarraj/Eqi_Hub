import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

import { createStaticServer, SECURITY_HEADERS } from "./serve.mjs";

let origin;
let publicDir;
let server;

before(async () => {
  publicDir = await mkdtemp(join(tmpdir(), "equivista-static-server-"));
  await mkdir(join(publicDir, "assets"));
  await writeFile(
    join(publicDir, "index.html"),
    "<!doctype html><title>EquiVista test</title>",
  );
  await writeFile(join(publicDir, "assets", "app-abc123.js"), "export {};\n");

  server = await createStaticServer({ publicDir });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  origin = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (publicDir) await rm(publicDir, { recursive: true, force: true });
});

function assertSecurityHeaders(response) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    assert.equal(response.headers.get(name), value, `${name} must be present`);
  }
}

test("serves the application shell with every security header", async () => {
  const response = await fetch(`${origin}/`, {
    headers: { accept: "text/html" },
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/html/);
  assert.equal(response.headers.get("cache-control"), "no-cache");
  assertSecurityHeaders(response);
  assert.match(await response.text(), /EquiVista test/);
});

test("supports HEAD without sending a response body", async () => {
  const response = await fetch(`${origin}/`, {
    method: "HEAD",
    headers: { accept: "text/html" },
  });

  assert.equal(response.status, 200);
  assertSecurityHeaders(response);
  assert.equal(await response.text(), "");
});

test("serves hashed assets with a long-lived cache policy", async () => {
  const response = await fetch(`${origin}/assets/app-abc123.js`);

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/javascript/);
  assert.equal(
    response.headers.get("cache-control"),
    "public, max-age=31536000, immutable",
  );
  assertSecurityHeaders(response);
});

test("falls back to index.html for an extensionless SPA route", async () => {
  const response = await fetch(`${origin}/analysis/example`, {
    headers: { accept: "text/html" },
  });

  assert.equal(response.status, 200);
  assertSecurityHeaders(response);
  assert.match(await response.text(), /EquiVista test/);
});

test("returns 404 for a missing asset instead of the SPA shell", async () => {
  const response = await fetch(`${origin}/assets/missing.js`);

  assert.equal(response.status, 404);
  assertSecurityHeaders(response);
  assert.equal(await response.text(), "Not Found");
});

test("rejects unsupported methods and still supplies security headers", async () => {
  const response = await fetch(`${origin}/`, { method: "POST" });

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET, HEAD");
  assertSecurityHeaders(response);
});

test("does not serve encoded traversal paths", async () => {
  const response = await fetch(`${origin}/%2e%2e%2foutside.txt`);

  assert.ok(response.status === 400 || response.status === 404);
  assertSecurityHeaders(response);
});
