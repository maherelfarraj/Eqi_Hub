import { readFile } from "node:fs/promises";
import { logger } from "../logger.js";
import type { AnalysisJob } from "../types.js";
import type { PipelineConfig } from "./config-llm.js";
import type { RealFrame } from "./ffmpeg.js";
import {
  isExplicitNonRidingOutput,
  RUBRIC_JSON_SCHEMA,
  rubricSystemPrompt,
  rubricUserPrompt,
  validateRubric,
  type RubricOutput,
} from "./rubric.js";
import { PipelineValidationError } from "./storage.js";

export class LLMUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMUnavailableError";
  }
}

interface LLMUsage {
  promptTokens: number | null;
  completionTokens: number | null;
}

interface ProviderResponse {
  text: string;
  usage: LLMUsage;
}

export interface AnalyzeOptions {
  fetchImpl?: typeof fetch;
  sleepImpl?: (milliseconds: number) => Promise<void>;
  logAnalysis?: (context: Record<string, unknown>) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function framesToBase64(frames: RealFrame[]): Promise<string[]> {
  return Promise.all(
    frames.map(async (frame) => (await readFile(frame.filePath)).toString("base64")),
  );
}

async function checkedJson(response: Response, provider: string): Promise<unknown> {
  if (!response.ok) {
    throw new LLMUnavailableError(`${provider}_http_${response.status}`);
  }
  try {
    return await response.json();
  } catch {
    throw new LLMUnavailableError(`${provider}_response_not_json`);
  }
}

function requireText(text: unknown, provider: string): string {
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new LLMUnavailableError(`${provider}_empty_response`);
  }
  return text;
}

async function callOpenAI(
  cfg: PipelineConfig,
  system: string,
  user: string,
  imagesB64: string[],
  signal: AbortSignal,
  fetchImpl: typeof fetch,
): Promise<ProviderResponse> {
  const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.apiKey ?? ""}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "equivista_riding_analysis",
          strict: true,
          schema: RUBRIC_JSON_SCHEMA,
        },
      },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: user },
            ...imagesB64.map((base64) => ({
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64}`,
                detail: "low",
              },
            })),
          ],
        },
      ],
    }),
  });
  const json = await checkedJson(response, "openai");
  const root = isRecord(json) ? json : {};
  const choices = Array.isArray(root.choices) ? root.choices : [];
  const first = isRecord(choices[0]) ? choices[0] : {};
  const message = isRecord(first.message) ? first.message : {};
  const usage = isRecord(root.usage) ? root.usage : {};
  return {
    text: requireText(message.content, "openai"),
    usage: {
      promptTokens: numberOrNull(usage.prompt_tokens),
      completionTokens: numberOrNull(usage.completion_tokens),
    },
  };
}

async function callAnthropic(
  cfg: PipelineConfig,
  system: string,
  user: string,
  imagesB64: string[],
  signal: AbortSignal,
  fetchImpl: typeof fetch,
): Promise<ProviderResponse> {
  const response = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      "x-api-key": cfg.apiKey ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 1_500,
      system,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: user },
            ...imagesB64.map((base64) => ({
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: base64,
              },
            })),
          ],
        },
      ],
    }),
  });
  const json = await checkedJson(response, "anthropic");
  const root = isRecord(json) ? json : {};
  const blocks = Array.isArray(root.content) ? root.content : [];
  const text = blocks
    .filter(isRecord)
    .filter((block) => block.type === "text")
    .map((block) => (typeof block.text === "string" ? block.text : ""))
    .join("");
  const usage = isRecord(root.usage) ? root.usage : {};
  return {
    text: requireText(text, "anthropic"),
    usage: {
      promptTokens: numberOrNull(usage.input_tokens),
      completionTokens: numberOrNull(usage.output_tokens),
    },
  };
}

async function callGemini(
  cfg: PipelineConfig,
  system: string,
  user: string,
  imagesB64: string[],
  signal: AbortSignal,
  fetchImpl: typeof fetch,
): Promise<ProviderResponse> {
  const model = encodeURIComponent(cfg.model);
  const response = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": cfg.apiKey ?? "",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [
          {
            role: "user",
            parts: [
              { text: user },
              ...imagesB64.map((base64) => ({
                inline_data: { mime_type: "image/jpeg", data: base64 },
              })),
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RUBRIC_JSON_SCHEMA,
        },
      }),
    },
  );
  const json = await checkedJson(response, "gemini");
  const root = isRecord(json) ? json : {};
  const candidates = Array.isArray(root.candidates) ? root.candidates : [];
  const first = isRecord(candidates[0]) ? candidates[0] : {};
  const content = isRecord(first.content) ? first.content : {};
  const parts = Array.isArray(content.parts) ? content.parts : [];
  const text = parts
    .filter(isRecord)
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("");
  const usage = isRecord(root.usageMetadata) ? root.usageMetadata : {};
  return {
    text: requireText(text, "gemini"),
    usage: {
      promptTokens: numberOrNull(usage.promptTokenCount),
      completionTokens: numberOrNull(usage.candidatesTokenCount),
    },
  };
}

async function callProvider(
  cfg: PipelineConfig,
  job: AnalysisJob,
  imagesB64: string[],
  fetchImpl: typeof fetch,
): Promise<ProviderResponse> {
  const system = rubricSystemPrompt();
  const user = rubricUserPrompt(job.discipline, imagesB64.length, job.createdAt);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    if (cfg.provider === "openai") {
      return await callOpenAI(
        cfg,
        system,
        user,
        imagesB64,
        controller.signal,
        fetchImpl,
      );
    }
    if (cfg.provider === "anthropic") {
      return await callAnthropic(
        cfg,
        system,
        user,
        imagesB64,
        controller.signal,
        fetchImpl,
      );
    }
    return await callGemini(
      cfg,
      system,
      user,
      imagesB64,
      controller.signal,
      fetchImpl,
    );
  } catch (error) {
    if (error instanceof LLMUnavailableError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new LLMUnavailableError(`llm_request_failed:${message}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Uses published GPT-4o mini text-token rates; unknown provider/model stays null. */
export function estimateCostUsd(
  cfg: PipelineConfig,
  usage: LLMUsage,
): number | null {
  if (
    cfg.provider !== "openai" ||
    !cfg.model.startsWith("gpt-4o-mini") ||
    usage.promptTokens === null ||
    usage.completionTokens === null
  ) {
    return null;
  }
  const cost =
    (usage.promptTokens / 1_000_000) * 0.15 +
    (usage.completionTokens / 1_000_000) * 0.6;
  return Number(cost.toFixed(6));
}

/** Runs the discipline-aware rubric against frames and retries transient failures. */
export async function analyzeWithLLM(
  job: AnalysisJob,
  frames: RealFrame[],
  cfg: PipelineConfig,
  options: AnalyzeOptions = {},
): Promise<RubricOutput> {
  if (frames.length === 0) throw new PipelineValidationError("no_frames");
  if (!cfg.apiKey) throw new LLMUnavailableError("llm_api_key_missing");

  const fetchImpl = options.fetchImpl ?? fetch;
  const sleepImpl = options.sleepImpl ?? sleep;
  const logAnalysis = options.logAnalysis ?? ((context) => logger.info("llm_analysis", context));
  const imagesB64 = await framesToBase64(frames);
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt += 1) {
    if (attempt > 0) {
      await sleepImpl(2_000 * 4 ** (attempt - 1));
    }
    const started = Date.now();
    try {
      const response = await callProvider(cfg, job, imagesB64, fetchImpl);
      let parsed: unknown;
      try {
        parsed = JSON.parse(response.text);
      } catch {
        throw new LLMUnavailableError("llm_bad_json");
      }

      if (isExplicitNonRidingOutput(parsed)) {
        throw new PipelineValidationError("not_riding_content");
      }
      const errors = validateRubric(parsed, frames.length);
      if (errors.length > 0) {
        throw new LLMUnavailableError(`llm_invalid_output:${errors.join(",")}`);
      }

      const output = parsed as RubricOutput;
      logAnalysis({
        analysisId: job.id,
        provider: cfg.provider,
        model: cfg.model,
        latencyMs: Date.now() - started,
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
        estimatedCostUsd: estimateCostUsd(cfg, response.usage),
        evidence: output.metrics.map((metric) => ({
          category: metric.category,
          evidence: metric.evidence,
        })),
        overallComment: output.overallComment,
      });
      return output;
    } catch (error) {
      if (error instanceof PipelineValidationError) throw error;
      lastError = error;
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new LLMUnavailableError(`llm_failed_after_retries:${message}`);
}
