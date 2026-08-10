import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { DashboardSummary, QueryState, Role } from "./types";
import { useQuery, requireUserId, cents } from "./_shared";

export function useDashboardSummary(): QueryState<DashboardSummary | null> & {
  refetch: () => void;
} {
  return useQuery<DashboardSummary | null>(async () => {
    const uid = await requireUserId();

    const [
      profileRes,
      lessonsRes,
      membershipRes,
      analysesRes,
      invoicesRes,
      horsesRes,
      trendRes,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", uid)
        .single(),
      supabase
        .from("lessons")
        .select(
          "id, date_time, lesson_type, status, trainer:trainer_id(full_name), horse:horse_id(name)",
        )
        .eq("rider_id", uid)
        .in("status", ["pending", "confirmed"])
        .gte("date_time", new Date().toISOString())
        .order("date_time", { ascending: true })
        .limit(3),
      supabase
        .from("memberships")
        .select(
          "status, renews_at, lessons_used, analyses_used, plan:membership_plans(name, lessons_per_month, analyses_per_month)",
        )
        .eq("user_id", uid)
        .in("status", ["trialing", "active", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("video_analyses")
        .select("id, title, status, score, created_at, horse:horse_id(name)")
        .eq("rider_id", uid)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("invoices")
        .select("total_cents, currency")
        .eq("user_id", uid)
        .in("status", ["open", "overdue"]),
      supabase
        .from("horses")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", uid),
      supabase
        .from("video_analyses")
        .select("session_date, score")
        .eq("rider_id", uid)
        .eq("status", "analyzed")
        .not("score", "is", null)
        .order("session_date", { ascending: true })
        .limit(8),
    ]);

    const outstanding = (invoicesRes.data ?? []).reduce(
      (acc, inv) => ({
        amount: acc.amount + cents(inv.total_cents),
        currency: inv.currency,
        invoiceCount: acc.invoiceCount + 1,
      }),
      { amount: 0, currency: "USD", invoiceCount: 0 },
    );

    const m = membershipRes.data as any;
    return {
      user: {
        name: profileRes.data?.full_name ?? "Rider",
        role: (profileRes.data?.role ?? "rider") as Role,
      },
      upcomingLessons: (lessonsRes.data ?? []).map((l: any) => ({
        id: l.id,
        dateTime: l.date_time,
        trainerName: l.trainer?.full_name ?? "TBD",
        horseName: l.horse?.name ?? null,
        discipline: l.lesson_type,
        status: l.status,
      })),
      activeMembership: m
        ? {
            planName: m.plan?.name ?? "Plan",
            status: m.status,
            renewsAt: m.renews_at,
            lessonsUsed: m.lessons_used,
            lessonsAllowed: m.plan?.lessons_per_month ?? 0,
            analysesUsed: m.analyses_used,
            analysesAllowed: m.plan?.analyses_per_month ?? 0,
          }
        : null,
      recentAnalyses: (analysesRes.data ?? []).map((a: any) => ({
        id: a.id,
        title: a.title,
        horseName: a.horse?.name ?? null,
        score: a.score,
        status: a.status,
        createdAt: a.created_at,
      })),
      outstandingBalance: outstanding,
      horsesCount: horsesRes.count ?? 0,
      progressTrend: (trendRes.data ?? []).map((t: any) => ({
        date: t.session_date,
        score: Number(t.score),
      })),
    };
  });
}
