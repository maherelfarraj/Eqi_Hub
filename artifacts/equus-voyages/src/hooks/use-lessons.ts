import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { BookLessonInput, Lesson, QueryState, Trainer } from "./types";
import {
  useQuery,
  requireUserId,
  requireOrganizationId,
  scopeByOrganization,
} from "./_shared";

export type LessonFilter = "upcoming" | "past" | "requests";

const mapLesson = (l: any): Lesson => ({
  id: l.id,
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
});

export function useLessons(
  filter: LessonFilter,
): QueryState<Lesson[]> & { refetch: () => void } {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;

  return useQuery<Lesson[]>(async () => {
    const uid = await requireUserId();
    let q = supabase
      .from("lessons")
      .select(
        "*, trainer:trainer_id(full_name, avatar_url), horse:horse_id(name)",
      )
      .eq("rider_id", uid);

    q = scopeByOrganization(q, organizationId);

    if (filter === "upcoming") {
      q = q
        .in("status", ["confirmed"])
        .gte("date_time", new Date().toISOString())
        .order("date_time", { ascending: true });
    } else if (filter === "past") {
      q = q
        .in("status", ["completed", "cancelled"])
        .order("date_time", { ascending: false });
    } else {
      q = q.eq("status", "pending").order("date_time", { ascending: true });
    }

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map(mapLesson);
  }, [filter, organizationId]);
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

  const book = useCallback(async (input: BookLessonInput) => {
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
  }, [organizationId]);

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
