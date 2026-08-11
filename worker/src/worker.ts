import { runPipeline } from "./pipeline/index.js";
import type {
  AnalysisJob,
  AnalysisResult,
  JobRepository,
  WorkerLogger,
} from "./types.js";

export interface PollSummary {
  discovered: number;
  claimed: number;
  analyzed: number;
  failed: number;
}

type Analyze = (job: AnalysisJob) => Promise<AnalysisResult>;

export class AnalysisWorker {
  constructor(
    private readonly repository: JobRepository,
    private readonly logger: WorkerLogger,
    private readonly analyze: Analyze = runPipeline,
    private readonly batchSize = 5,
  ) {}

  async poll(): Promise<PollSummary> {
    const candidates = await this.repository.listUploaded(this.batchSize);
    const summary: PollSummary = {
      discovered: candidates.length,
      claimed: 0,
      analyzed: 0,
      failed: 0,
    };

    for (const candidate of candidates) {
      const job = await this.repository.claim(candidate.id);
      if (!job) continue;
      summary.claimed += 1;

      try {
        const result = await this.analyze(job);
        await this.repository.complete(job.id, result);
        summary.analyzed += 1;
        this.logger.info("Analysis completed", { analysisId: job.id, score: result.score });
      } catch (error) {
        summary.failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error("Analysis failed", { analysisId: job.id, error: message });
        try {
          await this.repository.fail(job.id);
        } catch (markFailedError) {
          const markFailedMessage =
            markFailedError instanceof Error ? markFailedError.message : String(markFailedError);
          this.logger.error("Could not mark analysis as failed", {
            analysisId: job.id,
            error: markFailedMessage,
          });
        }
      }
    }

    return summary;
  }
}
