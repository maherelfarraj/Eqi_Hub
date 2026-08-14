import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type {
  BookLessonInput,
  CompetencyDefinition,
  CompetencyEvidence,
  Lesson,
  LessonDevelopmentInput,
  LessonDevelopmentReport,
  QueryState,
  RiderReflection,
  Trainer,
} from "./types";
import {
  useQuery,
  requireUserId,
  requireOrganizationId,
  resolveAccessibleRiderIds,
  scopeByOrganization,
} from "./_shared";

export type LessonFilter = "upcoming" | "past" | "requests";

const mapLesson = (l: any): Lesson => ({
  id: l.id,
  riderId: l.rider_id,
  riderName: l.rider?.full_name ?? "Rider",
  dateTime: l.date_time,
  durationMin: l.duration_min,
  trainerName: l.trainer?.full_name ?? "TBD",
  trainerAvatar: l.trainer?.avatar_url ?? null,
  horseName: l.horse?.name ?? null,
  type: l.lesson_type,
  status: l.status,
  notes: l.notes,
  feedback: l.feedback_text
    ? { text: l.feedback_text, homework: l.homework }
    : null,
  analysisId: l.analysis_id,
  developmentReport: l.developmentReport ?? null,
});

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function mapReflection(row: any): RiderReflection {
  return {
    id: row.id,
    reflection: row.reflection,
    question: row.question,
    visibleToGuardian: row.visible_to_guardian,
    acknowledgedAt: row.acknowledged_at,
  };
}

function mapDevelopmentReport(
  row: any,
  evidence: CompetencyEvidence[],
  reflection: RiderReflection | null,
): LessonDevelopmentReport {
  return {
    id: row.id,
    status: row.status,
    objectives: row.objectives ?? [],
    summary: row.summary ?? "",
    strengths: row.strengths ?? [],
    focusAreas: row.focus_areas ?? [],
    horseObservations: row.horse_observations,
    interactionObservations: row.interaction_observations,
    homework: row.homework,
    homeworkDueAt: row.homework_due_at,
    nextFocus: row.next_focus ?? "",
    effortScore: row.effort_score,
    riderConfidenceScore: row.rider_confidence_score,
    lessonDifficultyScore: row.lesson_difficulty_score,
    approvedAt: row.approved_at,
    competencies: evidence,
    reflection,
  };
}

export function useLessons(
  filter: LessonFilter,
): QueryState<Lesson[]> & { refetch: () => void } {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;

  return useQuery<Lesson[]>(async () => {
    const uid = await requireUserId();
    const riderIds = await resolveAccessibleRiderIds(uid, organizationId);
    let q = supabase
      .from("lessons")
      .select(
        "*, rider:rider_id(full_name), trainer:trainer_id(full_name, avatar_url), horse:horse_id(name)",
      )
      .in("rider_id", riderIds);

    q = scopeByOrganization(q, organizationId);

    if (filter === "upcoming") {
      q = q
        .in("status", ["confirmed"])
        .gte("date_time", new Date().toISOString())
        .order("date_time", { ascending: true });
    } else if (filter === "past") {
      q = q
        .in("status", ["confirmed", "completed", "cancelled"])
        .lt("date_time", new Date().toISOString())
        .order("date_time", { ascending: false });
    } else {
      q = q.eq("status", "pending").order("date_time", { ascending: true });
    }

    const { data, error } = await q;
    if (error) throw error;

    const lessonRows = data ?? [];
    const lessonIds = lessonRows.map((lesson: any) => lesson.id);
    if (!lessonIds.length) return [];

    let reportQuery = supabase
      .from("lesson_development_reports")
      .select("*")
      .in("lesson_id", lessonIds)
      .in("rider_id", riderIds);
    reportQuery = scopeByOrganization(reportQuery, organizationId);

    const { data: reportRows, error: reportError } = await reportQuery;
    if (reportError) throw reportError;

    const reports = reportRows ?? [];
    const reportIds = reports.map((report: any) => report.id);
    const competencyIds = new Set<string>();
    const evidenceRows: any[] = [];
    const reflectionRows: any[] = [];

    if (reportIds.length) {
      const [evidenceResult, reflectionResult] = await Promise.all([
        supabase
          .from("rider_competency_evidence")
          .select("report_id, competency_id, stage, evidence_note")
          .in("report_id", reportIds),
        supabase
          .from("lesson_development_reflections")
          .select(
            "id, report_id, reflection, question, visible_to_guardian, acknowledged_at",
          )
          .in("report_id", reportIds),
      ]);
      if (evidenceResult.error) throw evidenceResult.error;
      if (reflectionResult.error) throw reflectionResult.error;
      evidenceRows.push(...(evidenceResult.data ?? []));
      reflectionRows.push(...(reflectionResult.data ?? []));
      evidenceRows.forEach((row) => competencyIds.add(row.competency_id));
    }

    const competencyNames = new Map<string, string>();
    if (competencyIds.size) {
      const { data: definitions, error: competencyError } = await supabase
        .from("rider_competency_catalog")
        .select("id, name")
        .in("id", Array.from(competencyIds));
      if (competencyError) throw competencyError;
      (definitions ?? []).forEach((definition) =>
        competencyNames.set(definition.id, definition.name),
      );
    }

    const reportByLesson = new Map<string, LessonDevelopmentReport>();
    reports.forEach((report: any) => {
      const evidence = evidenceRows
        .filter((row) => row.report_id === report.id)
        .map((row) => ({
          competencyId: row.competency_id,
          competencyName:
            competencyNames.get(row.competency_id) ?? "Competency",
          stage: row.stage,
          note: row.evidence_note,
        }));
      const reflectionRow = firstRelation(
        reflectionRows.filter((row) => row.report_id === report.id),
      );
      reportByLesson.set(
        report.lesson_id,
        mapDevelopmentReport(
          report,
          evidence,
          reflectionRow ? mapReflection(reflectionRow) : null,
        ),
      );
    });

    return lessonRows.map((lesson: any) =>
      mapLesson({
        ...lesson,
        developmentReport: reportByLesson.get(lesson.id) ?? null,
      }),
    );
  }, [filter, organizationId]);
}

export function useCompetencyCatalog(): QueryState<CompetencyDefinition[]> {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;

  return useQuery<CompetencyDefinition[]>(async () => {
    let query = supabase
      .from("rider_competency_catalog")
      .select("id, code, name, category, description")
      .eq("active", true)
      .order("sort_order");
    if (organizationId) {
      query = query.or(
        `organization_id.is.null,organization_id.eq.${organizationId}`,
      );
    } else {
      query = query.is("organization_id", null);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }, [organizationId]);
}

export function useLessonDevelopmentActions() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(async (input: LessonDevelopmentInput) => {
    setSubmitting(true);
    setError(null);
    try {
      const { data, error: saveError } = await supabase.rpc(
        "save_lesson_development_report",
        {
          p_lesson_id: input.lessonId,
          p_objectives: input.objectives,
          p_summary: input.summary,
          p_strengths: input.strengths,
          p_focus_areas: input.focusAreas,
          p_horse_observations: input.horseObservations || null,
          p_interaction_observations: input.interactionObservations || null,
          p_homework: input.homework || null,
          p_homework_due_at: input.homeworkDueAt || null,
          p_next_focus: input.nextFocus,
          p_effort_score: input.effortScore,
          p_rider_confidence_score: input.riderConfidenceScore ?? null,
          p_lesson_difficulty_score: input.lessonDifficultyScore ?? null,
          p_competencies: input.competencies.map((competency) => ({
            competency_id: competency.competencyId,
            stage: competency.stage,
            evidence_note: competency.evidenceNote || null,
          })),
          p_private_note: input.privateNote || null,
        },
      );
      if (saveError) throw saveError;
      return data as string;
    } catch (cause: any) {
      setError(cause?.message ?? "Could not save the lesson report");
      return null;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const approve = useCallback(async (reportId: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const { error: approveError } = await supabase.rpc(
        "approve_lesson_development_report",
        { p_report_id: reportId },
      );
      if (approveError) throw approveError;
      return true;
    } catch (cause: any) {
      setError(cause?.message ?? "Could not approve the lesson report");
      return false;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const saveReflection = useCallback(
    async (
      reportId: string,
      organizationId: string,
      riderId: string,
      reflection: string,
      question: string,
      visibleToGuardian: boolean,
    ) => {
      setSubmitting(true);
      setError(null);
      try {
        const { error: reflectionError } = await supabase
          .from("lesson_development_reflections")
          .upsert(
            {
              report_id: reportId,
              organization_id: organizationId,
              rider_id: riderId,
              reflection: reflection.trim() || null,
              question: question.trim() || null,
              visible_to_guardian: visibleToGuardian,
            },
            { onConflict: "report_id,rider_id" },
          );
        if (reflectionError) throw reflectionError;
        return true;
      } catch (cause: any) {
        setError(cause?.message ?? "Could not save the reflection");
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  return { save, approve, saveReflection, submitting, error };
}

export function useTrainers(): QueryState<Trainer[]> {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;

  return useQuery<Trainer[]>(async () => {
    if (organizationId) {
      const { data, error } = await supabase
        .from("organization_memberships")
        .select(
          "user:profiles(id, full_name, avatar_url), organization_member_roles!inner(role)",
        )
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .eq("organization_member_roles.role", "coach");
      if (error) throw error;
      return (data ?? []).map((membership: any) => ({
        id: membership.user?.id,
        name: membership.user?.full_name ?? "Trainer",
        avatarUrl: membership.user?.avatar_url ?? null,
      }));
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("role", "trainer")
      .order("full_name");
    if (error) throw error;
    return (data ?? []).map((t: any) => ({
      id: t.id,
      name: t.full_name ?? "Trainer",
      avatarUrl: t.avatar_url,
    }));
  }, [organizationId]);
}

export function useBookLesson() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const book = useCallback(
    async (input: BookLessonInput) => {
      setSubmitting(true);
      setError(null);
      try {
        const uid = await requireUserId();
        const tenantId = requireOrganizationId(organizationId);
        const { error: err } = await supabase.from("lessons").insert({
          organization_id: tenantId,
          rider_id: uid,
          trainer_id: input.trainerId,
          horse_id: input.horseId,
          lesson_type: input.type,
          date_time: input.dateTime,
          duration_min: input.durationMin,
          notes: input.notes ?? null,
          status: "pending",
        });
        if (err) throw err;
        return true;
      } catch (e: any) {
        setError(e?.message ?? "Booking failed");
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [organizationId],
  );

  return { book, submitting, error };
}

/** Trainer-side: log feedback on a completed lesson */
export function useLogLesson() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;
  const [submitting, setSubmitting] = useState(false);

  const log = useCallback(
    async (
      lessonId: string,
      feedbackText: string,
      homework: string | null,
      analysisId?: string,
    ) => {
      setSubmitting(true);
      try {
        const tenantId = requireOrganizationId(organizationId);
        const { error } = await scopeByOrganization(
          supabase
            .from("lessons")
            .update({
              feedback_text: feedbackText,
              homework,
              analysis_id: analysisId ?? null,
              status: "completed",
            })
            .eq("id", lessonId),
          tenantId,
        );
        if (error) throw error;
        return true;
      } finally {
        setSubmitting(false);
      }
    },
    [organizationId],
  );

  return { log, submitting };
}
