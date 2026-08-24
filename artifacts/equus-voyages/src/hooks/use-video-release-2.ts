import { useCallback, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { requireOrganizationId, useQuery } from "./_shared";

type Row = Record<string, any>;

export type VideoRelease2Access = {
  enabled: boolean;
  canManage: boolean;
  canUpload: boolean;
  canViewApproved: boolean;
  pilotScope: "coach" | "adult_rider" | "not_enrolled";
};

export type VideoRelease2Session = {
  id: string;
  organizationId: string;
  riderId: string;
  coachId: string;
  title: string;
  exerciseContext: string | null;
  consentStatus: "pending" | "granted" | "withdrawn";
  reviewStatus: "draft" | "approved" | "archived";
  retentionState: "active" | "deletion_requested" | "deleted";
  approvedRevisionId: string | null;
  approvedAt: string | null;
  createdAt: string;
};

export type VideoRelease2Clip = {
  id: string;
  sessionId: string;
  mimeType: string;
  byteSize: number;
  durationMs: number;
  uploadState: "registered" | "uploaded" | "failed" | "deleted";
  storagePath: string;
  createdAt: string;
};

export type VideoRelease2Revision = {
  id: string;
  sessionId: string;
  revisionNumber: number;
  sourceKind: "manual" | "metric" | "ai";
  status: "draft" | "approved" | "superseded";
  createdAt: string;
  approvedAt: string | null;
};

export type VideoRelease2Feedback = {
  sessionId: string;
  title: string;
  exerciseContext: string | null;
  approvedAt: string;
  revisionId: string;
  category: string | null;
  score: number | null;
  coachNote: string | null;
  rhythmState: string | null;
  strideCount: number | null;
  strideNotes: string | null;
};

export type VideoRelease2TrendPoint = {
  sessionId: string;
  approvedAt: string;
  category: string;
  score: number;
};

const allowedVideoTypes = ["video/mp4", "video/quicktime", "video/webm"];
const maxClipBytes = 524288000;
const maxClipDurationMs = 28800000;

function mapAccess(row: Row | null): VideoRelease2Access {
  return {
    enabled: Boolean(row?.enabled),
    canManage: Boolean(row?.can_manage),
    canUpload: Boolean(row?.can_upload),
    canViewApproved: Boolean(row?.can_view_approved),
    pilotScope: row?.pilot_scope ?? "not_enrolled",
  };
}

function mapSession(row: Row): VideoRelease2Session {
  return {
    id: row.id,
    organizationId: row.organization_id,
    riderId: row.rider_id,
    coachId: row.coach_id,
    title: row.title,
    exerciseContext: row.exercise_context ?? null,
    consentStatus: row.consent_status,
    reviewStatus: row.review_status,
    retentionState: row.retention_state,
    approvedRevisionId: row.approved_revision_id ?? null,
    approvedAt: row.approved_at ?? null,
    createdAt: row.created_at,
  };
}

function mapClip(row: Row): VideoRelease2Clip {
  return {
    id: row.id,
    sessionId: row.session_id,
    mimeType: row.mime_type,
    byteSize: Number(row.byte_size),
    durationMs: Number(row.duration_ms),
    uploadState: row.upload_state,
    storagePath: row.original_storage_path,
    createdAt: row.created_at,
  };
}

function mapRevision(row: Row): VideoRelease2Revision {
  return {
    id: row.id,
    sessionId: row.session_id,
    revisionNumber: row.revision_number,
    sourceKind: row.source_kind,
    status: row.status,
    createdAt: row.created_at,
    approvedAt: row.approved_at ?? null,
  };
}

async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function videoDurationMs(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => resolve(video.duration * 1000);
      video.onerror = () => reject(new Error("The selected file is not a readable video."));
      video.src = objectUrl;
    });
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("The selected video does not expose a valid duration.");
    }
    return Math.round(duration);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function useVideoRelease2Access() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;
  return useQuery(async () => {
    if (!organizationId) return mapAccess(null);
    const { data, error } = await supabase
      .rpc("get_video_release_2_access", { p_organization_id: organizationId })
      .maybeSingle();
    if (error) throw error;
    return mapAccess(data as Row | null);
  }, [organizationId]);
}

export function useVideoRelease2Sessions() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;
  return useQuery<VideoRelease2Session[]>(async () => {
    if (!organizationId) return [];
    const { data, error } = await supabase
      .from("video_release_2_sessions")
      .select(
        "id, organization_id, rider_id, coach_id, title, exercise_context, consent_status, review_status, retention_state, approved_revision_id, approved_at, created_at",
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapSession) as VideoRelease2Session[];
  }, [organizationId]);
}

export function useVideoRelease2SessionWorkspace(sessionId: string | null) {
  return useQuery(async () => {
    if (!sessionId) {
      return {
        session: null as VideoRelease2Session | null,
        clips: [] as VideoRelease2Clip[],
        revisions: [] as VideoRelease2Revision[],
      };
    }
    const [sessionResult, clipsResult, revisionsResult] = await Promise.all([
      supabase
        .from("video_release_2_sessions")
        .select(
          "id, organization_id, rider_id, coach_id, title, exercise_context, consent_status, review_status, retention_state, approved_revision_id, approved_at, created_at",
        )
        .eq("id", sessionId)
        .maybeSingle(),
      supabase
        .from("video_release_2_clips")
        .select("id, session_id, mime_type, byte_size, duration_ms, upload_state, original_storage_path, created_at")
        .eq("session_id", sessionId)
        .order("created_at"),
      supabase
        .from("video_release_2_review_revisions")
        .select("id, session_id, revision_number, source_kind, status, created_at, approved_at")
        .eq("session_id", sessionId)
        .order("revision_number", { ascending: false }),
    ]);
    if (sessionResult.error) throw sessionResult.error;
    if (clipsResult.error) throw clipsResult.error;
    if (revisionsResult.error) throw revisionsResult.error;
    return {
      session: sessionResult.data ? mapSession(sessionResult.data) : null,
      clips: (clipsResult.data ?? []).map(mapClip),
      revisions: (revisionsResult.data ?? []).map(mapRevision),
    };
  }, [sessionId]);
}

export function useVideoRelease2PilotRiders() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;
  return useQuery<Array<{ id: string; name: string }>>(async () => {
    if (!organizationId) return [];
    const { data, error } = await supabase.rpc("get_video_release_2_pilot_riders", {
      p_organization_id: organizationId,
    });
    if (error) throw error;
    return (data ?? []).map((row: Row) => ({
      id: row.rider_id,
      name: row.rider_name,
    })) as Array<{ id: string; name: string }>;
  }, [organizationId]);
}

export function useVideoRelease2AssignedCoaches(riderId: string | null) {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;
  return useQuery<Array<{ id: string; name: string }>>(async () => {
    if (!organizationId || !riderId) return [];
    const { data, error } = await supabase
      .from("coach_rider_assignments")
      .select("coach_id, coach:profiles!coach_rider_assignments_coach_id_fkey(full_name)")
      .eq("organization_id", organizationId)
      .eq("rider_id", riderId)
      .eq("active", true);
    if (error) throw error;
    return (data ?? []).map((row: Row) => {
      const coach = Array.isArray(row.coach) ? row.coach[0] : row.coach;
      return {
        id: row.coach_id,
        name: coach?.full_name || "Assigned coach",
      };
    }) as Array<{ id: string; name: string }>;
  }, [organizationId, riderId]);
}

export function useVideoRelease2ApprovedFeedback() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;
  return useQuery<VideoRelease2Feedback[]>(async () => {
    if (!organizationId) return [];
    const { data, error } = await supabase.rpc("get_video_release_2_approved_feedback", {
      p_organization_id: organizationId,
    });
    if (error) throw error;
    return (data ?? []).map((row: Row): VideoRelease2Feedback => ({
      sessionId: row.session_id,
      title: row.title,
      exerciseContext: row.exercise_context ?? null,
      approvedAt: row.approved_at,
      revisionId: row.revision_id,
      category: row.category ?? null,
      score: row.score ?? null,
      coachNote: row.coach_note ?? null,
      rhythmState: row.rhythm_state ?? null,
      strideCount: row.stride_count ?? null,
      strideNotes: row.stride_notes ?? null,
    })) as VideoRelease2Feedback[];
  }, [organizationId]);
}

export function useVideoRelease2RiderConsentSessions() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;
  return useQuery<Array<{ id: string; title: string; consentStatus: string; retentionState: string }>>(async () => {
    if (!organizationId) return [];
    const { data, error } = await supabase.rpc("get_video_release_2_rider_consent_sessions", {
      p_organization_id: organizationId,
    });
    if (error) throw error;
    return (data ?? []).map((row: Row) => ({
      id: row.session_id,
      title: row.title,
      consentStatus: row.consent_status,
      retentionState: row.retention_state,
    }));
  }, [organizationId]);
}

export function useVideoRelease2Actions() {
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
      setError(cause?.message ?? "We could not complete the coach-approved video request.");
      return null;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const createSession = useCallback(
    (input: {
      riderId: string;
      coachId: string;
      title: string;
      exerciseContext?: string;
      horseId?: string;
      lessonId?: string;
    }) =>
      run(async () => {
        const tenantId = requireOrganizationId(organizationId);
        const { data, error: rpcError } = await supabase.rpc(
          "create_video_release_2_session",
          {
            p_organization_id: tenantId,
            p_rider_id: input.riderId,
            p_coach_id: input.coachId,
            p_horse_id: input.horseId ?? null,
            p_lesson_id: input.lessonId ?? null,
            p_title: input.title.trim(),
            p_exercise_context: input.exerciseContext?.trim() || null,
          },
        );
        if (rpcError) throw rpcError;
        return data as string;
      }),
    [organizationId, run],
  );

  const recordConsent = useCallback(
    (sessionId: string, granted: boolean) =>
      run(async () => {
        const { error: rpcError } = await supabase.rpc("record_video_release_2_consent", {
          p_session_id: sessionId,
          p_granted: granted,
        });
        if (rpcError) throw rpcError;
        return true;
      }),
    [run],
  );

  const uploadClip = useCallback(
    (sessionId: string, file: File) =>
      run(async () => {
        if (!allowedVideoTypes.includes(file.type)) {
          throw new Error("Use an MP4, MOV, or WebM video file.");
        }
        if (file.size <= 0 || file.size > maxClipBytes) {
          throw new Error("Videos must be larger than 0 bytes and no more than 500 MB.");
        }
        const durationMs = await videoDurationMs(file);
        if (durationMs > maxClipDurationMs) {
          throw new Error("Videos must be no longer than 8 hours.");
        }
        const checksum = await sha256(file);
        const { data, error: registrationError } = await supabase
          .rpc("register_video_release_2_clip", {
            p_session_id: sessionId,
            p_checksum_sha256: checksum,
            p_mime_type: file.type,
            p_byte_size: file.size,
            p_duration_ms: durationMs,
          })
          .single();
        if (registrationError) throw registrationError;
        const clip = data as { clip_id: string; storage_path: string };
        const { error: uploadError } = await supabase.storage
          .from("video-release-2")
          .upload(clip.storage_path, file, {
            contentType: file.type,
            upsert: false,
          });
        if (uploadError) throw uploadError;
        const { error: confirmError } = await supabase.rpc(
          "confirm_video_release_2_clip_upload",
          { p_clip_id: clip.clip_id },
        );
        if (confirmError) throw confirmError;
        return clip.clip_id;
      }),
    [run],
  );

  const createRevision = useCallback(
    (sessionId: string) =>
      run(async () => {
        const { data, error: rpcError } = await supabase.rpc(
          "create_video_release_2_revision",
          { p_session_id: sessionId, p_source_kind: "manual" },
        );
        if (rpcError) throw rpcError;
        return data as string;
      }),
    [run],
  );

  const getClipPlaybackUrl = useCallback(
    (storagePath: string) =>
      run(async () => {
        const { data, error: signedUrlError } = await supabase.storage
          .from("video-release-2")
          .createSignedUrl(storagePath, 300);
        if (signedUrlError) throw signedUrlError;
        if (!data?.signedUrl) throw new Error("Private playback is not available for this clip.");
        return data.signedUrl;
      }),
    [run],
  );

  const saveScorecard = useCallback(
    (revisionId: string, category: string, score: number, coachNote?: string) =>
      run(async () => {
        const { error: rpcError } = await supabase.rpc("save_video_release_2_scorecard", {
          p_revision_id: revisionId,
          p_category: category,
          p_score: score,
          p_coach_note: coachNote?.trim() || null,
        });
        if (rpcError) throw rpcError;
      }),
    [run],
  );

  const saveStrideObservation = useCallback(
    (input: {
      revisionId: string;
      clipId: string | null;
      startMs: number;
      endMs: number;
      rhythmState: string;
      strideCount?: number;
      notes?: string;
    }) =>
      run(async () => {
        const { error: rpcError } = await supabase.rpc(
          "save_video_release_2_stride_observation",
          {
            p_revision_id: input.revisionId,
            p_clip_id: input.clipId,
            p_start_ms: input.startMs,
            p_end_ms: input.endMs,
            p_rhythm_state: input.rhythmState,
            p_stride_count: input.strideCount ?? null,
            p_notes: input.notes?.trim() || null,
          },
        );
        if (rpcError) throw rpcError;
      }),
    [run],
  );

  const saveCourseTag = useCallback(
    (input: {
      revisionId: string;
      clipId: string | null;
      sequenceNumber: number;
      fenceLabel: string;
      tagCode: string;
      positionMs?: number;
      notes?: string;
    }) =>
      run(async () => {
        const { error: rpcError } = await supabase.rpc("save_video_release_2_course_tag", {
          p_revision_id: input.revisionId,
          p_clip_id: input.clipId,
          p_sequence_number: input.sequenceNumber,
          p_fence_label: input.fenceLabel.trim(),
          p_tag_code: input.tagCode,
          p_position_ms: input.positionMs ?? null,
          p_notes: input.notes?.trim() || null,
        });
        if (rpcError) throw rpcError;
      }),
    [run],
  );

  const approveRevision = useCallback(
    (revisionId: string) =>
      run(async () => {
        const { error: rpcError } = await supabase.rpc(
          "approve_video_release_2_revision",
          { p_revision_id: revisionId },
        );
        if (rpcError) throw rpcError;
      }),
    [run],
  );

  const loadTrend = useCallback(
    async (riderId?: string): Promise<VideoRelease2TrendPoint[]> => {
      const tenantId = requireOrganizationId(organizationId);
      const { data, error: rpcError } = await supabase.rpc("get_video_release_2_trend", {
        p_organization_id: tenantId,
        p_rider_id: riderId ?? null,
      });
      if (rpcError) throw rpcError;
      return (data ?? []).map((row: Row) => ({
        sessionId: row.session_id,
        approvedAt: row.approved_at,
        category: row.category,
        score: row.score,
      }));
    },
    [organizationId],
  );

  return {
    submitting,
    error,
    createSession,
    recordConsent,
    uploadClip,
    createRevision,
    getClipPlaybackUrl,
    saveScorecard,
    saveStrideObservation,
    saveCourseTag,
    approveRevision,
    loadTrend,
  };
}