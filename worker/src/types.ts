export interface AnalysisJob {
  id: string;
  title: string;
  discipline: string;
  videoUrl: string | null;
  createdAt: string;
}

export interface FrameSample {
  index: number;
  timestampMs: number;
  source: string | null;
}

export interface NormalizedPoint {
  x: number;
  y: number;
  confidence: number;
}

export interface PoseSample {
  timestampMs: number;
  points: {
    shoulder: NormalizedPoint;
    hip: NormalizedPoint;
    knee: NormalizedPoint;
    heel: NormalizedPoint;
  };
}

export interface AnalysisMetric {
  category: "Position" | "Balance" | "Timing" | "Impulsion";
  score: number;
}

export interface AnalysisResult {
  score: number;
  metrics: AnalysisMetric[];
  aiFeedback: {
    strengths: string[];
    improvements: string[];
  };
}

export interface JobRepository {
  listUploaded(limit: number): Promise<AnalysisJob[]>;
  claim(id: string): Promise<AnalysisJob | null>;
  complete(id: string, result: AnalysisResult): Promise<void>;
  fail(id: string): Promise<void>;
}

export interface WorkerLogger {
  info(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}
