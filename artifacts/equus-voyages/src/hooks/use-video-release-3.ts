import { useCallback, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { requireOrganizationId, useQuery } from "./_shared";

type Row = Record<string, any>;

export type VideoRelease3Access = {
  enabled: boolean;
  canManage: boolean;
  pilotScope: "coach" | "not_enrolled";
};

export type DevelopmentTimelinePoint = {
  sessionId: string;
  approvedAt: string;
  title: string;
  exerciseContext: string | null;
  horseId: string | null;
  category: string;
  score: number;
};

export type TrainingPlan = {
  id: string;
  horseId: string | null;
  title: string;
  cycleType: "monthly" | "term" | "yearly";
  periodStart: string;
  periodEnd: string;
  targetText: string;
  status: "draft" | "active" | "completed" | "archived";
  evidenceCount: number;
  createdAt: string;
  updatedAt: string;
};

export type Benchmark = {
  id: string;
  horseId: string | null;
  family: "foundation" | "show_jumping";
  level: number;
  evidenceRevisionId: string;
  coachNote: string | null;
  confirmedAt: string;
};

export type Milestone = {
  id: string;
  horseId: string | null;
  title: string;
  milestoneDate: string;
  detail: string | null;
  evidenceRevisionId: string | null;
  confirmedAt: string;
};

export type DevelopmentComparison = {
  id: string;
  horseId: string | null;
  firstSessionId: string;
  secondSessionId: string;
  summary: string;
  createdAt: string;
};

export type CoachReport = {
  id: string;
  horseId: string | null;
  periodStart: string;
  periodEnd: string;
  titleEn: string;
  titleAr: string;
  contentEn: string;
  contentAr: string;
  status: "draft" | "approved";
  approvedAt: string | null;
  sourceCount: number;
  updatedAt: string;
};

const mapAccess = (row: Row | null): VideoRelease3Access => ({
  enabled: Boolean(row?.enabled),
  canManage: Boolean(row?.can_manage),
  pilotScope: row?.pilot_scope === "coach" ? "coach" : "not_enrolled",
});

export function useVideoRelease3Access() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;
  return useQuery<VideoRelease3Access>(async () => {
    if (!organizationId) return mapAccess(null);
    const { data, error } = await supabase
      .rpc("get_video_release_3_access", { p_organization_id: organizationId })
      .maybeSingle();
    if (error) throw error;
    return mapAccess(data as Row | null);
  }, [organizationId]);
}

export function useVideoRelease3Development(riderId: string | null, horseId: string | null) {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;
  return useQuery(async () => {
    if (!organizationId || !riderId) {
      return {
        timeline: [] as DevelopmentTimelinePoint[],
        plans: [] as TrainingPlan[],
        benchmarks: [] as Benchmark[],
        milestones: [] as Milestone[],
        comparisons: [] as DevelopmentComparison[],
        reports: [] as CoachReport[],
      };
    }
    const args = { p_organization_id: organizationId, p_rider_id: riderId };
    const [timelineResult, plansResult, benchmarksResult, milestonesResult, comparisonsResult, reportsResult] =
      await Promise.all([
        supabase.rpc("get_video_release_3_timeline", { ...args, p_horse_id: horseId }),
        supabase.rpc("get_video_release_3_plans", args),
        supabase.rpc("get_video_release_3_benchmarks", args),
        supabase.rpc("get_video_release_3_milestones", args),
        supabase.rpc("get_video_release_3_comparisons", args),
        supabase.rpc("get_video_release_3_reports", args),
      ]);
    for (const result of [
      timelineResult,
      plansResult,
      benchmarksResult,
      milestonesResult,
      comparisonsResult,
      reportsResult,
    ]) {
      if (result.error) throw result.error;
    }
    return {
      timeline: (timelineResult.data ?? []).map((row: Row): DevelopmentTimelinePoint => ({
        sessionId: row.session_id,
        approvedAt: row.approved_at,
        title: row.title,
        exerciseContext: row.exercise_context ?? null,
        horseId: row.horse_id ?? null,
        category: row.category,
        score: Number(row.score),
      })),
      plans: (plansResult.data ?? []).map((row: Row): TrainingPlan => ({
        id: row.id,
        horseId: row.horse_id ?? null,
        title: row.title,
        cycleType: row.cycle_type,
        periodStart: row.period_start,
        periodEnd: row.period_end,
        targetText: row.target_text,
        status: row.status,
        evidenceCount: Number(row.evidence_count ?? 0),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      benchmarks: (benchmarksResult.data ?? []).map((row: Row): Benchmark => ({
        id: row.id,
        horseId: row.horse_id ?? null,
        family: row.benchmark_family,
        level: Number(row.level),
        evidenceRevisionId: row.evidence_revision_id,
        coachNote: row.coach_note ?? null,
        confirmedAt: row.confirmed_at,
      })),
      milestones: (milestonesResult.data ?? []).map((row: Row): Milestone => ({
        id: row.id,
        horseId: row.horse_id ?? null,
        title: row.title,
        milestoneDate: row.milestone_date,
        detail: row.detail ?? null,
        evidenceRevisionId: row.evidence_revision_id ?? null,
        confirmedAt: row.confirmed_at,
      })),
      comparisons: (comparisonsResult.data ?? []).map((row: Row): DevelopmentComparison => ({
        id: row.id,
        horseId: row.horse_id ?? null,
        firstSessionId: row.first_session_id,
        secondSessionId: row.second_session_id,
        summary: row.summary,
        createdAt: row.created_at,
      })),
      reports: (reportsResult.data ?? []).map((row: Row): CoachReport => ({
        id: row.id,
        horseId: row.horse_id ?? null,
        periodStart: row.period_start,
        periodEnd: row.period_end,
        titleEn: row.title_en,
        titleAr: row.title_ar,
        contentEn: row.content_en,
        contentAr: row.content_ar,
        status: row.status,
        approvedAt: row.approved_at ?? null,
        sourceCount: Number(row.source_count ?? 0),
        updatedAt: row.updated_at,
      })),
    };
  }, [organizationId, riderId, horseId]);
}

export function useVideoRelease3Actions() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T,>(action: () => Promise<T>) => {
    setSubmitting(true);
    setError(null);
    try {
      return await action();
    } catch (cause: any) {
      setError(cause?.message ?? "We could not update the development workspace.");
      return null;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const savePlan = useCallback(
    (input: {
      riderId: string;
      title: string;
      cycleType: "monthly" | "term" | "yearly";
      periodStart: string;
      periodEnd: string;
      targetText: string;
      horseId?: string | null;
      planId?: string;
      status?: TrainingPlan["status"];
    }) =>
      run(async () => {
        const { data, error: rpcError } = await supabase.rpc("save_video_release_3_training_plan", {
          p_organization_id: requireOrganizationId(organizationId),
          p_rider_id: input.riderId,
          p_title: input.title.trim(),
          p_cycle_type: input.cycleType,
          p_period_start: input.periodStart,
          p_period_end: input.periodEnd,
          p_target_text: input.targetText.trim(),
          p_horse_id: input.horseId ?? null,
          p_plan_id: input.planId ?? null,
          p_status: input.status ?? "draft",
        });
        if (rpcError) throw rpcError;
        return data as string;
      }),
    [organizationId, run],
  );

  const linkPlanEvidence = useCallback(
    (planId: string, sessionId: string, note?: string) =>
      run(async () => {
        const { error: rpcError } = await supabase.rpc("link_video_release_3_plan_evidence", {
          p_plan_id: planId,
          p_session_id: sessionId,
          p_evidence_note: note?.trim() || null,
        });
        if (rpcError) throw rpcError;
      }),
    [run],
  );

  const confirmBenchmark = useCallback(
    (input: {
      riderId: string;
      family: Benchmark["family"];
      level: number;
      evidenceSessionId: string;
      horseId?: string | null;
      coachNote?: string;
    }) =>
      run(async () => {
        const { error: rpcError } = await supabase.rpc("confirm_video_release_3_benchmark", {
          p_organization_id: requireOrganizationId(organizationId),
          p_rider_id: input.riderId,
          p_benchmark_family: input.family,
          p_level: input.level,
          p_evidence_session_id: input.evidenceSessionId,
          p_horse_id: input.horseId ?? null,
          p_coach_note: input.coachNote?.trim() || null,
        });
        if (rpcError) throw rpcError;
      }),
    [organizationId, run],
  );

  const createMilestone = useCallback(
    (input: {
      riderId: string;
      title: string;
      milestoneDate: string;
      detail?: string;
      horseId?: string | null;
      evidenceSessionId?: string | null;
    }) =>
      run(async () => {
        const { error: rpcError } = await supabase.rpc("create_video_release_3_milestone", {
          p_organization_id: requireOrganizationId(organizationId),
          p_rider_id: input.riderId,
          p_title: input.title.trim(),
          p_milestone_date: input.milestoneDate,
          p_detail: input.detail?.trim() || null,
          p_horse_id: input.horseId ?? null,
          p_evidence_session_id: input.evidenceSessionId ?? null,
        });
        if (rpcError) throw rpcError;
      }),
    [organizationId, run],
  );

  const createComparison = useCallback(
    (input: {
      riderId: string;
      firstSessionId: string;
      secondSessionId: string;
      summary: string;
      horseId?: string | null;
    }) =>
      run(async () => {
        const { error: rpcError } = await supabase.rpc("create_video_release_3_comparison", {
          p_organization_id: requireOrganizationId(organizationId),
          p_rider_id: input.riderId,
          p_first_session_id: input.firstSessionId,
          p_second_session_id: input.secondSessionId,
          p_summary: input.summary.trim(),
          p_horse_id: input.horseId ?? null,
        });
        if (rpcError) throw rpcError;
      }),
    [organizationId, run],
  );

  const saveReport = useCallback(
    (input: {
      riderId: string;
      periodStart: string;
      periodEnd: string;
      titleEn: string;
      titleAr: string;
      contentEn: string;
      contentAr: string;
      sourceSessionIds: string[];
      reportId?: string;
    }) =>
      run(async () => {
        const { data, error: rpcError } = await supabase.rpc("save_video_release_3_report", {
          p_organization_id: requireOrganizationId(organizationId),
          p_rider_id: input.riderId,
          p_period_start: input.periodStart,
          p_period_end: input.periodEnd,
          p_title_en: input.titleEn.trim(),
          p_title_ar: input.titleAr.trim(),
          p_content_en: input.contentEn.trim(),
          p_content_ar: input.contentAr.trim(),
          p_source_session_ids: input.sourceSessionIds,
          p_report_id: input.reportId ?? null,
        });
        if (rpcError) throw rpcError;
        return data as string;
      }),
    [organizationId, run],
  );

  const approveReport = useCallback(
    (reportId: string) =>
      run(async () => {
        const { error: rpcError } = await supabase.rpc("approve_video_release_3_report", {
          p_report_id: reportId,
        });
        if (rpcError) throw rpcError;
      }),
    [run],
  );

  return {
    submitting,
    error,
    savePlan,
    linkPlanEvidence,
    confirmBenchmark,
    createMilestone,
    createComparison,
    saveReport,
    approveReport,
  };
}