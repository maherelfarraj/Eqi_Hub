import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadConfig } from "../config.js";
import type { PipelineConfig } from "./config-llm.js";

export class PipelineValidationError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = "PipelineValidationError";
    this.reason = reason;
  }
}

function safeExtension(storagePath: string): string {
  const candidate = storagePath.split(".").at(-1)?.toLowerCase() ?? "mp4";
  return /^[a-z0-9]{1,5}$/.test(candidate) ? candidate : "mp4";
}

function safeAnalysisId(analysisId: string): string {
  return analysisId.replace(/[^a-zA-Z0-9-]/g, "_");
}

/** Downloads the job's video from the private `videos` bucket to OS temp storage. */
export async function downloadVideo(
  analysisId: string,
  storagePath: string | null,
  cfg: PipelineConfig,
): Promise<string> {
  if (!storagePath) throw new PipelineValidationError("video_missing");

  const app = loadConfig();
  const supabase = createClient(app.supabaseUrl, app.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.storage
    .from("videos")
    .download(storagePath);
  if (error || !data) {
    throw new PipelineValidationError(
      `video_download_failed:${error?.message ?? "empty"}`,
    );
  }
  if (data.size > cfg.maxVideoBytes) {
    throw new PipelineValidationError("video_too_large");
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  const localPath = join(
    tmpdir(),
    `equivista-${safeAnalysisId(analysisId)}.${safeExtension(storagePath)}`,
  );
  await writeFile(localPath, buffer, { mode: 0o600 });
  return localPath;
}
