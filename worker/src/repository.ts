import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalysisJob, AnalysisResult, JobRepository } from "./types.js";

interface AnalysisRow {
  id: string;
  title: string;
  discipline: string;
  video_url: string | null;
  created_at: string;
}

function mapJob(row: AnalysisRow): AnalysisJob {
  return {
    id: row.id,
    title: row.title,
    discipline: row.discipline,
    videoUrl: row.video_url,
    createdAt: row.created_at,
  };
}

export class SupabaseJobRepository implements JobRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listUploaded(limit: number): Promise<AnalysisJob[]> {
    const { data, error } = await this.client
      .from("video_analyses")
      .select("id,title,discipline,video_url,created_at")
      .eq("status", "uploaded")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) throw error;
    return ((data ?? []) as AnalysisRow[]).map(mapJob);
  }

  async claim(id: string): Promise<AnalysisJob | null> {
    const { data, error } = await this.client
      .from("video_analyses")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "uploaded")
      .select("id,title,discipline,video_url,created_at")
      .maybeSingle();

    if (error) throw error;
    return data ? mapJob(data as AnalysisRow) : null;
  }

  async complete(id: string, result: AnalysisResult): Promise<void> {
    const { data, error } = await this.client
      .from("video_analyses")
      .update({
        status: "analyzed",
        score: result.score,
        metrics: result.metrics,
        ai_feedback: result.aiFeedback,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "processing")
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error(`Analysis ${id} was no longer processing`);
  }

  async fail(id: string): Promise<void> {
    const { error } = await this.client
      .from("video_analyses")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "processing");

    if (error) throw error;
  }
}
