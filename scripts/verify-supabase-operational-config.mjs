import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const supabaseRoot = resolve(repositoryRoot, "supabase");
const configPath = process.env.SUPABASE_CONFIG_PATH ?? resolve(supabaseRoot, "config.toml");
const seedPath = process.env.SUPABASE_SEED_PATH ?? resolve(supabaseRoot, "seed.sql");
const configText = await readFile(configPath, "utf8");
const seedText = await readFile(seedPath, "utf8");
const inventory = JSON.parse(
  await readFile(resolve(supabaseRoot, "canonical-baseline.inventory.json"), "utf8"),
);

function stripSqlComments(sql) {
  let output = "";
  let index = 0;
  let state = "code";
  let dollarTag = null;

  while (index < sql.length) {
    const pair = sql.slice(index, index + 2);

    if (state === "line-comment") {
      if (sql[index] === "\n") {
        output += "\n";
        state = "code";
      }
      index += 1;
      continue;
    }

    if (state === "block-comment") {
      if (pair === "*/") {
        state = "code";
        index += 2;
      } else {
        if (sql[index] === "\n") output += "\n";
        index += 1;
      }
      continue;
    }

    if (state === "single-quote") {
      output += sql[index];
      if (pair === "''") {
        output += sql[index + 1];
        index += 2;
      } else {
        if (sql[index] === "'") state = "code";
        index += 1;
      }
      continue;
    }

    if (state === "dollar-quote") {
      if (sql.startsWith(dollarTag, index)) {
        output += dollarTag;
        index += dollarTag.length;
        state = "code";
      } else {
        output += sql[index];
        index += 1;
      }
      continue;
    }

    if (pair === "--") {
      state = "line-comment";
      index += 2;
      continue;
    }
    if (pair === "/*") {
      state = "block-comment";
      index += 2;
      continue;
    }
    if (sql[index] === "'") {
      output += sql[index];
      state = "single-quote";
      index += 1;
      continue;
    }

    const dollarMatch = sql.slice(index).match(/^\$[a-zA-Z_][a-zA-Z0-9_]*\$|^\$\$/);
    if (dollarMatch) {
      dollarTag = dollarMatch[0];
      output += dollarTag;
      index += dollarTag.length;
      state = "dollar-quote";
      continue;
    }

    output += sql[index];
    index += 1;
  }

  if (state === "block-comment" || state === "single-quote" || state === "dollar-quote") {
    throw new Error(`Unterminated SQL ${state}`);
  }

  return output;
}

function normalizeSql(sql) {
  return stripSqlComments(sql).replace(/\s+/g, " ").trim();
}

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

if (!configText.includes('[storage]\nfile_size_limit = "500MiB"')) {
  throw new Error(
    "Global Storage file_size_limit must be 500MiB so video bucket limits are valid",
  );
}

const bucketHeaderPattern = /^\[storage\.buckets\.(?:"([^"]+)"|([a-z0-9_-]+))\]$/gm;
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

if (!configText.includes('[db.seed]\nenabled = true\nsql_paths = ["./seed.sql"]')) {
  throw new Error("Supabase seed execution is not enabled for ./seed.sql");
}

const normalizedSeed = normalizeSql(seedText);
const expectedCronBlock = normalizeSql(`
  do $seed$
  declare
    existing_job_id bigint;
  begin
    for existing_job_id in
      select jobid
      from cron.job
      where jobname = 'equivista-continuous-controls-daily'
    loop
      perform cron.unschedule(existing_job_id);
    end loop;

    perform cron.schedule(
      'equivista-continuous-controls-daily',
      '15 2 * * *',
      $cron$select private.run_continuous_controls_monitoring('scheduled');$cron$
    );
  end
  $seed$;
`);

if (normalizedSeed !== expectedCronBlock) {
  throw new Error(
    "seed.sql must contain exactly the executable, idempotent Phase 0C.4 cron block",
  );
}

if (inventory.counts.cron_jobs !== 1) {
  throw new Error(`Canonical inventory expected ${inventory.counts.cron_jobs} cron jobs`);
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
    throw new Error(`Operational configuration contains forbidden secret material: ${pattern}`);
  }
}

console.log(
  `Verified ${buckets.size} declarative storage buckets and ${inventory.counts.cron_jobs} idempotent non-secret cron job`,
);
