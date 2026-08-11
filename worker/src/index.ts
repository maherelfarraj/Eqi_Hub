import { createServer } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { loadConfig } from "./config.js";
import { logger } from "./logger.js";
import { SupabaseJobRepository } from "./repository.js";
import { AnalysisWorker } from "./worker.js";

const config = loadConfig();
const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const worker = new AnalysisWorker(new SupabaseJobRepository(supabase), logger);

let closing = false;
let polling = false;

async function poll(): Promise<void> {
  if (closing || polling) return;
  polling = true;
  try {
    const summary = await worker.poll();
    if (summary.discovered === 0) {
      logger.info("[worker] heartbeat — queue empty");
    } else {
      logger.info("[worker] poll completed", { ...summary });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Poll failed", { error: message });
  } finally {
    polling = false;
  }
}

const server = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok", polling, closing }));
    return;
  }
  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "not_found" }));
});

server.listen(config.port, "0.0.0.0", () => {
  logger.info(`[worker] health endpoint on :${config.port}`);
  logger.info(
    `[worker] polling video_analyses every ${config.pollIntervalMs / 1_000}s`,
    { pollIntervalMs: config.pollIntervalMs },
  );
});

void poll();
const pollTimer = setInterval(() => void poll(), config.pollIntervalMs);

function shutdown(signal: NodeJS.Signals): void {
  if (closing) return;
  closing = true;
  clearInterval(pollTimer);
  logger.info("Worker shutting down", { signal });
  server.close((error) => {
    if (error) {
      logger.error("Health server shutdown failed", { error: error.message });
      process.exitCode = 1;
    }
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
