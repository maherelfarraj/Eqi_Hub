import type { WorkerLogger } from "./types.js";

function write(level: "info" | "error", message: string, context?: Record<string, unknown>): void {
  const entry = JSON.stringify({
    level,
    time: new Date().toISOString(),
    message,
    ...(context ? { context } : {}),
  });
  const stream = level === "error" ? process.stderr : process.stdout;
  stream.write(`${entry}\n`);
}

export const logger: WorkerLogger = {
  info: (message, context) => write("info", message, context),
  error: (message, context) => write("error", message, context),
};
