import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const scriptsRoot = import.meta.dirname;
const result = spawnSync(
  process.execPath,
  [resolve(scriptsRoot, "verify-supabase-operational-config.mjs")],
  {
    encoding: "utf8",
    env: {
      ...process.env,
      SUPABASE_SEED_PATH: resolve(
        scriptsRoot,
        "fixtures/commented-cron-seed.sql",
      ),
    },
  },
);

assert.notEqual(
  result.status,
  0,
  "Verifier accepted a cron block that exists only in SQL comments",
);
assert.match(
  result.stderr,
  /must contain exactly the executable, idempotent Phase 0C\.4 cron block/,
);

console.log("Verified commented-out cron SQL is rejected");
