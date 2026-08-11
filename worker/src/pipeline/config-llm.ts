export type LLMProvider = "openai" | "anthropic" | "gemini";

export interface PipelineConfig {
  mode: "stub" | "llm";
  provider: LLMProvider;
  apiKey: string | null;
  model: string;
  maxRetries: number;
  timeoutMs: number;
  maxVideoBytes: number;
}

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-5",
  gemini: "gemini-2.0-flash",
};

function positiveInteger(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
): number {
  const raw = env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function nonNegativeInteger(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
): number {
  const raw = env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

export function loadPipelineConfig(
  env: NodeJS.ProcessEnv = process.env,
): PipelineConfig {
  const providerValue = env.LLM_PROVIDER?.trim() || "openai";
  if (!(["openai", "anthropic", "gemini"] as const).some(
    (provider) => provider === providerValue,
  )) {
    throw new Error(
      `LLM_PROVIDER must be openai|anthropic|gemini, got "${providerValue}"`,
    );
  }
  const provider = providerValue as LLMProvider;

  const modeValue = env.PIPELINE_MODE?.trim() || "llm";
  if (modeValue !== "stub" && modeValue !== "llm") {
    throw new Error(`PIPELINE_MODE must be stub|llm, got "${modeValue}"`);
  }

  return {
    mode: modeValue,
    provider,
    apiKey: env.LLM_API_KEY?.trim() || null,
    model: env.LLM_MODEL?.trim() || DEFAULT_MODELS[provider],
    maxRetries: nonNegativeInteger(env, "LLM_MAX_RETRIES", 2),
    timeoutMs: positiveInteger(env, "LLM_TIMEOUT_MS", 120_000),
    maxVideoBytes:
      positiveInteger(env, "MAX_VIDEO_MB", 300) * 1024 * 1024,
  };
}
