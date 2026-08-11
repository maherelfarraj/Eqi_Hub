export interface WorkerConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
  pollIntervalMs: number;
  port: number;
}

function required(name: string, env: NodeJS.ProcessEnv): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function positiveInteger(name: string, raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const supabaseUrl = required("SUPABASE_URL", env);
  try {
    new URL(supabaseUrl);
  } catch {
    throw new Error("SUPABASE_URL must be a valid URL");
  }

  return {
    supabaseUrl,
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY", env),
    pollIntervalMs: positiveInteger("POLL_INTERVAL_MS", env.POLL_INTERVAL_MS, 30_000),
    port: positiveInteger("PORT", env.PORT, 3_000),
  };
}
