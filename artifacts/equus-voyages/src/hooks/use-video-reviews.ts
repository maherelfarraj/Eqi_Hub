import { useCallback, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  requireOrganizationId,
  requireUserId,
  resolveAccessibleRiderIds,
  useQuery,
} from "./_shared";
import type {
  CreateVideoReviewSessionInput,
  QueryState,
  VideoReviewActivity,
  VideoReviewAnnotation,
  VideoReviewAnnotationType,
  VideoReviewClip,
  VideoReviewSession,
} from "./types";

type SessionRow = Record<string, any>;

function profileName(value: unknown): string | null {
  const profile = Array.isArray(value) ? value[0] : value;
  return profile && typeof profile.full_name === "string"
    ? profile.full_name
    : null;
}

function mapSession(row: SessionRow): VideoReviewSession {
  const horse = Array.isArray(row.horse) ? row.horse[0] : row.horse;
  return {
    id: row.id,
    organizationId: row.organization_id,
    riderId: row.rider_id,
    riderName: profileName(row.rider),
    horseName: horse?.name ?? null,
    coachName: profileName(row.coach),
    title: row.title,
    lessonId: row.lesson_id ?? null,
    trainingObjective: row.training_objective ?? null,
    competitionReference: row.competition_reference ?? null,
    consentStatus: row.consent_status,
    reviewStatus: row.review_status,
    retentionState: row.retention_state,
    retentionDeleteAfter: row.retention_delete_after ?? null,
    coachApprovedAt: row.coach_approved_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function numberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is number => typeof entry === "number")
    : [];
}

function mapClip(row: SessionRow): VideoReviewClip {
  return {
    id: row.id,
    sessionId: row.session_id,
    originalFilename: row.original_filename,
    originalContentType: row.original_content_type,
    originalSizeBytes: row.original_size_bytes,
    durationMs: row.duration_ms ?? null,
    processingStatus: row.processing_status,
    streamingReady: Boolean(row.streaming_storage_path),
    thumbnailReady: Boolean(row.thumbnail_storage_path),
    keyframeTimeline: Array.isArray(row.keyframe_timeline)
      ? row.keyframe_timeline
      : [],
    slowMotionRates: numberArray(row.slow_motion_rates),
    createdAt: row.created_at,
  };
}

function mapAnnotation(row: SessionRow): VideoReviewAnnotation {
  return {
    id: row.id,
    clipId: row.clip_id,
    type: row.annotation_type,
    visibility: row.visibility,
    timecodeMs: row.timecode_ms ?? null,
    payload:
      row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? row.payload
        : {},
    createdAt: row.created_at,
  };
}

export function useVideoReviewSessions(): QueryState<VideoReviewSession[]> & {
  refetch: () => void;
} {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;

  return useQuery(async () => {
    if (!organizationId) return [];
    const { data, error } = await supabase
      .from("video_review_sessions")
      .select(
        "id, organization_id, rider_id, horse_id, coach_id, lesson_id, title, training_objective, competition_reference, consent_status, review_status, retention_state, retention_delete_after, coach_approved_at, created_at, updated_at, rider:profiles!video_review_sessions_rider_id_fkey(full_name), coach:profiles!video_review_sessions_coach_id_fkey(full_name), horse:horses(name)",
      )
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapSession);
  }, [organizationId]);
}

export function useVideoReviewRiders(): QueryState<
  Array<{ id: string; name: string }>
> & { refetch: () => void } {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;

  return useQuery(async () => {
    if (!organizationId) return [];
    const userId = await requireUserId();
    const riderIds = await resolveAccessibleRiderIds(userId, organizationId);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", riderIds)
      .order("full_name");
    if (error) throw error;
    return (data ?? []).map((profile: SessionRow) => ({
      id: profile.id,
      name: profile.full_name || "Unnamed rider",
    }));
  }, [organizationId]);
}

export function useVideoReviewCoaches(
  riderId: string,
): QueryState<Array<{ id: string; name: string }>> & { refetch: () => void } {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;

  return useQuery(async () => {
    if (!organizationId || !riderId) return [];
    const { data, error } = await supabase
      .from("coach_rider_assignments")
      .select("coach_id, coach:profiles!coach_rider_assignments_coach_id_fkey(full_name)")
      .eq("organization_id", organizationId)
      .eq("rider_id", riderId)
      .eq("active", true);
    if (error) throw error;
    return (data ?? []).map((assignment: SessionRow) => ({
      id: assignment.coach_id,
      name: profileName(assignment.coach) || "Assigned coach",
    }));
  }, [organizationId, riderId]);
}

export function useVideoReviewSession(
  sessionId: string | undefined,
): QueryState<VideoReviewSession | null> & { refetch: () => void } {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;

  return useQuery(async () => {
    if (!organizationId || !sessionId) return null;
    const { data, error } = await supabase
      .from("video_review_sessions")
      .select(
        "id, organization_id, rider_id, horse_id, coach_id, lesson_id, title, training_objective, competition_reference, consent_status, review_status, retention_state, retention_delete_after, coach_approved_at, created_at, updated_at, rider:profiles!video_review_sessions_rider_id_fkey(full_name), coach:profiles!video_review_sessions_coach_id_fkey(full_name), horse:horses(name)",
      )
      .eq("organization_id", organizationId)
      .eq("id", sessionId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapSession(data) : null;
  }, [organizationId, sessionId]);
}

export function useVideoReviewClips(
  sessionId: string | undefined,
): QueryState<VideoReviewClip[]> & { refetch: () => void } {
  return useQuery(async () => {
    if (!sessionId) return [];
    const { data, error } = await supabase
      .from("video_review_clips")
      .select(
        "id, session_id, original_filename, original_content_type, original_size_bytes, duration_ms, processing_status, streaming_storage_path, thumbnail_storage_path, keyframe_timeline, slow_motion_rates, created_at",
      )
      .eq("session_id", sessionId)
      .order("created_at");
    if (error) throw error;
    return (data ?? []).map(mapClip);
  }, [sessionId]);
}

export function useVideoReviewAnnotations(
  clipId: string | undefined,
): QueryState<VideoReviewAnnotation[]> & { refetch: () => void } {
  return useQuery(async () => {
    if (!clipId) return [];
    const { data, error } = await supabase
      .from("video_review_annotations")
      .select(
        "id, clip_id, annotation_type, visibility, timecode_ms, payload, created_at",
      )
      .eq("clip_id", clipId)
      .order("created_at");
    if (error) throw error;
    return (data ?? []).map(mapAnnotation);
  }, [clipId]);
}

export function useVideoReviewActivity(
  sessionId: string | undefined,
): QueryState<VideoReviewActivity[]> & { refetch: () => void } {
  return useQuery(async () => {
    if (!sessionId) return [];
    const { data, error } = await supabase
      .from("video_review_activity_events")
      .select("id, clip_id, action, occurred_at")
      .eq("session_id", sessionId)
      .order("occurred_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return (data ?? []).map((row: SessionRow) => ({
      id: row.id,
      clipId: row.clip_id ?? null,
      action: row.action,
      occurredAt: row.occurred_at,
    }));
  }, [sessionId]);
}

export function useVideoReviewActions() {
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
      setError(cause?.message ?? "We could not complete the video review request.");
      return null;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const createSession = useCallback(
    (input: CreateVideoReviewSessionInput) =>
      run(async () => {
        const userId = await requireUserId();
        const tenantId = requireOrganizationId(organizationId);
        const { data, error: createError } = await supabase
          .from("video_review_sessions")
          .insert({
            organization_id: tenantId,
            rider_id: input.riderId,
            horse_id: input.horseId ?? null,
            coach_id: input.coachId,
            lesson_id: input.lessonId ?? null,
            training_objective: input.trainingObjective?.trim() || null,
            competition_reference: input.competitionReference?.trim() || null,
            title: input.title.trim(),
            created_by: userId,
          })
          .select("id")
          .single();
        if (createError) throw createError;
        return data.id as string;
      }),
    [organizationId, run],
  );

  const updateSession = useCallback(
    (
      sessionId: string,
      patch: {
        consent_status?: string;
        review_status?: string;
        retention_state?: string;
      },
    ) =>
      run(async () => {
        const { error: updateError } = await supabase
          .from("video_review_sessions")
          .update(patch)
          .eq("id", sessionId);
        if (updateError) throw updateError;
      }),
    [run],
  );

  const uploadClip = useCallback(
    (sessionId: string, file: File) =>
      run(async () => {
        const userId = await requireUserId();
        const tenantId = requireOrganizationId(organizationId);
        if (!["video/mp4", "video/quicktime", "video/webm"].includes(file.type)) {
          throw new Error("Use an MP4, MOV, or WebM video file.");
        }
        if (file.size > 524288000) {
          throw new Error("Video files must be 500 MB or smaller.");
        }
        const clipId = crypto.randomUUID();
        const extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "mp4";
        const path = `${tenantId}/${sessionId}/${clipId}/original.${extension}`;
        const { error: createError } = await supabase
          .from("video_review_clips")
          .insert({
            id: clipId,
            organization_id: tenantId,
            session_id: sessionId,
            original_filename: file.name,
            original_storage_path: path,
            original_content_type: file.type,
            original_size_bytes: file.size,
            created_by: userId,
          });
        if (createError) throw createError;

        const { error: storageError } = await supabase.storage
          .from("video-reviews")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (storageError) {
          await supabase
            .from("video_review_clips")
            .update({ processing_status: "failed" })
            .eq("id", clipId);
          throw storageError;
        }
        return clipId;
      }),
    [organizationId, run],
  );

  const addAnnotation = useCallback(
    (
      clipId: string,
      annotationType: VideoReviewAnnotationType,
      text: string,
      audienceVisible: boolean,
    ) =>
      run(async () => {
        const userId = await requireUserId();
        const tenantId = requireOrganizationId(organizationId);
        const { error: annotationError } = await supabase
          .from("video_review_annotations")
          .insert({
            organization_id: tenantId,
            clip_id: clipId,
            annotation_type: annotationType,
            visibility: audienceVisible ? "approved_audience" : "coach_only",
            payload: { text: text.trim(), capture_state: "manual_interface_only" },
            created_by: userId,
          });
        if (annotationError) throw annotationError;
      }),
    [organizationId, run],
  );

  const getPlaybackUrl = useCallback(
    (clipId: string, staffAccess: boolean) =>
      run(async () => {
        const { data: clip, error: clipError } = await supabase
          .from("video_review_clips")
          .select("original_storage_path, streaming_storage_path")
          .eq("id", clipId)
          .single();
        if (clipError) throw clipError;
        const path = clip.streaming_storage_path || (staffAccess ? clip.original_storage_path : null);
        if (!path) {
          throw new Error("A secure streaming derivative is not ready yet.");
        }
        const { data, error: signedError } = await supabase.storage
          .from("video-reviews")
          .createSignedUrl(path, 300);
        if (signedError) throw signedError;
        await supabase.rpc("record_video_review_activity", {
          p_clip_id: clipId,
          p_action: "view",
        });
        return data.signedUrl as string;
      }),
    [run],
  );

  const recordDownload = useCallback(
    (clipId: string) =>
      run(async () => {
        const { error: activityError } = await supabase.rpc(
          "record_video_review_activity",
          { p_clip_id: clipId, p_action: "download" },
        );
        if (activityError) throw activityError;
      }),
    [run],
  );

  return {
    createSession,
    updateSession,
    uploadClip,
    addAnnotation,
    getPlaybackUrl,
    recordDownload,
    submitting,
    error,
  };
}