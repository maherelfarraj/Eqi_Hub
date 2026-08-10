import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Metric, ProgressMetrics, QueryState, SessionRow } from "./types";
import { useQuery, requireUserId, cents } from "./_shared";

export function useProgressMetrics(
  periodDays: 30 | 90 | 365,
): QueryState<ProgressMetrics | null> {
  return useQuery<ProgressMetrics | null>(async () => {
    const uid = await requireUserId();
    const since = new Date(Date.now() - periodDays * 864e5)
      .toISOString()
      .slice(0, 10);

    const { data, error } = await supabase
      .from("video_analyses")
      .select("session_date, score, discipline, metrics")
      .eq("rider_id", uid)
      .eq("status", "analyzed")
      .not("score", "is", null)
      .gte("session_date", since)
      .order("session_date", { ascending: true });
    if (error) throw error;

    const rows = data ?? [];
    const scores = rows.map((r: any) => Number(r.score));
    const averageScore = scores.length
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;

    // Improvement: last score vs first score in period, as %
    const improvementPct =
      scores.length >= 2 && scores[0] !== 0
        ? ((scores[scores.length - 1] - scores[0]) / scores[0]) * 100
        : 0;

    // Top discipline by frequency
    const freq: Record<string, number> = {};
    rows.forEach((r: any) => {
      freq[r.discipline] = (freq[r.discipline] ?? 0) + 1;
    });
    const topDiscipline =
      Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // Aggregate category scores from metrics jsonb
    const catMap: Record<string, { sum: number; n: number }> = {};
    rows.forEach((r: any) =>
      (r.metrics as Metric[] | null)?.forEach((m) => {
        catMap[m.category] ??= { sum: 0, n: 0 };
        catMap[m.category].sum += m.score;
        catMap[m.category].n += 1;
      }),
    );
    const categoryScores = Object.entries(catMap).map(([category, v]) => ({
      category,
      score: Math.round((v.sum / v.n) * 10) / 10,
    }));

    return {
      averageScore: Math.round(averageScore * 10) / 10,
      improvementPct: Math.round(improvementPct * 10) / 10,
      sessionsCount: rows.length,
      topDiscipline,
      scoreOverTime: rows.map((r: any) => ({
        date: r.session_date,
        score: Number(r.score),
      })),
      categoryScores,
    };
  }, [periodDays]);
}

export function useSessionHistory(): QueryState<SessionRow[]> {
  return useQuery<SessionRow[]>(async () => {
    const uid = await requireUserId();
    const { data, error } = await supabase
      .from("video_analyses")
      .select(
        "id, session_date, discipline, score, status, horse:horse_id(name)",
      )
      .eq("rider_id", uid)
      .order("session_date", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      id: r.id,
      date: r.session_date,
      horseName: r.horse?.name ?? null,
      discipline: r.discipline,
      score: r.score,
      status: r.status,
    }));
  });
}
