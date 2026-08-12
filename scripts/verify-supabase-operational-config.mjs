import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const supabaseRoot = resolve(repositoryRoot, "supabase");
const configText = await readFile(resolve(supabaseRoot, "config.toml"), "utf8");
const seedText = await readFile(resolve(supabaseRoot, "seed.sql"), "utf8");
const inventory = JSON.parse(
  await readFile(
    resolve(supabaseRoot, "canonical-baseline.inventory.json"),
    "utf8",
  ),
);

const expectedBuckets = new Map([
  ["avatars", { public: true }],
  ["documents", { public: false }],
  ["horse-photos", { public: true }],
  [
    "riding-analysis-videos",
    {
      public: false,
      fileSizeLimit: "500MiB",
      mimeTypes: ["video/mp4", "video/quicktime", "video/webm"],
    },
  ],
  [
    "videos",
    {
      public: false,
      fileSizeLimit: "500MiB",
      mimeTypes: ["video/mp4", "video/quicktime", "video/webm"],
    },
  ],
]);

const bucketHeaderPattern =
  /^\[storage\.buckets\.(?:"([^"]+)"|([a-z0-9_-]+))\]$/gm;
const headers = [...configText.matchAll(bucketHeaderPattern)];
const buckets = new Map();

for (const [index, match] of headers.entries()) {
  const name = match[1] ?? match[2];
  const bodyStart = match.index + match[0].length;
  const bodyEnd = headers[index + 1]?.index ?? configText.length;
  const body = configText.slice(bodyStart, bodyEnd);
  const publicMatch = body.match(/^public = (true|false)$/m);
  const fileSizeMatch = body.match(/^file_size_limit = "([^"]+)"$/m);
  const mimeTypesMatch = body.match(/^allowed_mime_types = \[(.+)\]$/m);

  if (!publicMatch) {
    throw new Error(`Bucket ${name} does not declare an explicit public value`);
  }

  buckets.set(name, {
    public: publicMatch[1] === "true",
    fileSizeLimit: fileSizeMatch?.[1],
    mimeTypes: mimeTypesMatch
      ? [...mimeTypesMatch[1].matchAll(/"([^"]+)"/g)].map((item) => item[1])
      : undefined,
  });
}

if (buckets.size !== inventory.counts.storage_buckets) {
  throw new Error(
    `Expected ${inventory.counts.storage_buckets} buckets, found ${buckets.size}`,
  );
}

for (const [name, expected] of expectedBuckets) {
  const actual = buckets.get(name);
  if (!actual) throw new Error(`Missing bucket declaration: ${name}`);

  for (const property of ["public", "fileSizeLimit"]) {
    if (actual[property] !== expected[property]) {
      throw new Error(
        `Bucket ${name} ${property} mismatch: expected ${expected[property]}, got ${actual[property]}`,
      );
    }
  }

  if (JSON.stringify(actual.mimeTypes) !== JSON.stringify(expected.mimeTypes)) {
    throw new Error(`Bucket ${name} allowed_mime_types mismatch`);
  }
}

if (
  !configText.includes(
    '[db.seed]\nenabled = true\nsql_paths = ["./seed.sql"]',
  )
) {
  throw new Error("Supabase seed execution is not enabled for ./seed.sql");
}

const expectedCron = {
  name: "equivista-continuous-controls-daily",
  schedule: "15 2 * * *",
  command: "select private.run_continuous_controls_monitoring('scheduled');",
};

for (const value of Object.values(expectedCron)) {
  if (!seedText.includes(value)) {
    throw new Error(`Seed is missing expected cron value: ${value}`);
  }
}

if (!seedText.includes("cron.unschedule(existing_job_id)")) {
  throw new Error(
    "Cron seed must remove an existing stable-name job before scheduling",
  );
}

if (inventory.counts.cron_jobs !== 1) {
  throw new Error(
    `Canonical inventory expected ${inventory.counts.cron_jobs} cron jobs`,
  );
}

const forbiddenPatterns = [
  /service_role/i,
  /supabase_secret/i,
  /postgres(?:ql)?:\/\//i,
  /password\s*=/i,
  /vault\.secrets/i,
];

for (const pattern of forbiddenPatterns) {
  if (pattern.test(configText) || pattern.test(seedText)) {
    throw new Error(
      `Operational configuration contains forbidden secret material: ${pattern}`,
    );
  }
}

console.log(
  `Verified ${buckets.size} declarative storage buckets and ${inventory.counts.cron_jobs} idempotent non-secret cron job`,
);
