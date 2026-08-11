import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type {
  AIFeedback,
  Metric,
  QueryState,
  TrainerComment,
  UploadVideoInput,
  VideoAnalysisDetail,
  VideoAnalysisListItem,
} from "./types";
import { useQuery, requireUserId, cents } from "./_shared";

export const mapAnalysis = (a: any): VideoAnalysisListItem => ({
  id: a.id,
  title: a.title,
  horseName: a.horse?.name ?? null,
  discipline: a.discipline,
  status: a.status,
  score: a.score,
  createdAt: a.created_at,
  thumbnailUrl: a.thumbnail_url,
});

function normalizeMetrics(value: unknown): Metric[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];

    const metric = entry as Partial<Metric>;
    if (
      typeof metric.category !== "string" ||
      typeof metric.score !== "number" ||
      !Number.isFinite(metric.score)
    ) {
      return [];
    }

    return [{ category: metric.category, score: metric.score }];
  });
}

function normalizeFeedback(value: unknown): AIFeedback {
  const raw =
    value && typeof value === "object" ? (value as Partial<AIFeedback>) : {};

  return {
    strengths: Array.isArray(raw.strengths)
      ? raw.strengths.filter(
          (strength): strength is string => typeof strength === "string",
        )
      : [],
    improvements: Array.isArray(raw.improvements)
      ? raw.improvements.filter(
          (improvement): improvement is string =>
            typeof improvement === "string",
        )
      : [],
  };
}

export function useVideoAnalyses(): QueryState<VideoAnalysisListItem[]> & {
  refetch: () => void;
} {
  return useQuery<VideoAnalysisListItem[]>(async () => {
    const uid = await requireUserId();
    const { data, error } = await supabase
      .from("video_analyses")
      .select(
        "id, title, discipline, status, score, thumbnail_url, created_at, horse:horse_id(name)",
      )
      .eq("rider_id", uid)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapAnalysis);
  });
}

export function useVideoAnalysis(
  id: string | undefined,
): QueryState<VideoAnalysisDetail | null> {
  return useQuery<VideoAnalysisDetail | null>(async () => {
    if (!id) return null;
    const { data: a, error } = await supabase
      .from("video_analyses")
      .select("*, horse:horse_id(name)")
      .eq("id", id)
      .single();
    if (error) throw error;

    // Signed URL for the private 'videos' bucket (valid 1 hour)
    let videoUrl: string | null = null;
    if (a.video_url) {
      const { data: signed } = await supabase.storage
        .from("videos")
        .createSignedUrl(a.video_url, 3600);
      videoUrl = signed?.signedUrl ?? null;
    }

    return {
      ...mapAnalysis(a),
      videoUrl,
      metrics: normalizeMetrics(a.metrics),
      aiFeedback: normalizeFeedback(a.ai_feedback),
      trainerComment: (a.trainer_comment as TrainerComment) ?? null,
    };
  }, [id]);
}

export function useUploadVideo() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (input: UploadVideoInput) => {
    setUploading(true);
    setProgress(0);
    setError(null);
    try {
      const uid = await requireUserId();
      const ext = input.file.name.split(".").pop() ?? "mp4";
      const path = `${uid}/${crypto.randomUUID()}.${ext}`;

      setProgress(30);
      const { error: upErr } = await supabase.storage
        .from("videos")
        .upload(path, input.file, { contentType: input.file.type });
      if (upErr) throw upErr;

      setProgress(70);
      const { data, error: insErr } = await supabase
        .from("video_analyses")
        .insert({
          rider_id: uid,
          horse_id: input.horseId,
          title: input.title,
          discipline: input.discipline,
          session_date: input.sessionDate,
          video_url: path,
          status: "uploaded",
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      // Kick off AI processing (Edge Function — deploy separately)
      supabase.functions
        .invoke("process-video", { body: { analysisId: data.id } })
        .catch(() => {});

      setProgress(100);
      return data.id as string;
    } catch (e: any) {
      setError(e?.message ?? "Upload failed");
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  return { upload, uploading, progress, error };
}
