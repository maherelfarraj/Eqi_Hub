import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileVideo,
  LockKeyhole,
  MessageSquareText,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import {
  EmptyState,
  ErrorState,
  Modal,
  OutlineButton,
  PageHeader,
  PageSkeleton,
  PrimaryButton,
  StatusBadge,
  SurfaceCard,
  fieldClass,
  formatDate,
  labelClass,
} from "@/components/EquiVistaUI";
import { useAuth } from "@/contexts/AuthContext";
import {
  useVideoReviewActions,
  useVideoReviewActivity,
  useVideoReviewAnnotations,
  useVideoReviewClips,
  useVideoReviewCoaches,
  useVideoReviewRiders,
  useVideoReviewSession,
  useVideoReviewSessions,
} from "@/hooks/use-video-reviews";
import type {
  CreateVideoReviewSessionInput,
  VideoReviewAnnotationType,
  VideoReviewClip,
  VideoReviewSession,
} from "@/hooks/types";

const reviewStaffRoles = [
  "coach",
  "academy_admin",
  "stable_manager",
  "platform_admin",
];

function reviewStatusLabel(value: string) {
  return value.replaceAll("_", " ");
}

function SessionContext({ session }: { session: VideoReviewSession }) {
  const pieces = [
    session.horseName ? `Horse: ${session.horseName}` : null,
    session.trainingObjective ? `Objective: ${session.trainingObjective}` : null,
    session.competitionReference
      ? `Competition: ${session.competitionReference}`
      : null,
    session.lessonId ? "Lesson-linked review" : null,
  ].filter(Boolean);

  return (
    <p className="mt-2 text-sm leading-6 text-text-secondary">
      {pieces.join(" · ") || "Context is restricted to authorized academy users."}
    </p>
  );
}

function ReviewCreateDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (sessionId: string) => void;
}) {
  const riders = useVideoReviewRiders();
  const actions = useVideoReviewActions();
  const [form, setForm] = useState<CreateVideoReviewSessionInput>({
    riderId: "",
    coachId: "",
    title: "",
    trainingObjective: "",
    competitionReference: "",
  });
  const [validationError, setValidationError] = useState("");
  const coaches = useVideoReviewCoaches(form.riderId);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError("");
    if (
      !form.riderId ||
      !form.coachId ||
      !form.title.trim() ||
      !form.trainingObjective?.trim() &&
        !form.competitionReference?.trim() &&
        !form.lessonId?.trim()
    ) {
      setValidationError(
        "Choose a rider, enter a title, and add a lesson, training objective, or competition reference.",
      );
      return;
    }
    const id = await actions.createSession(form);
    if (id) onCreated(id);
  };

  return (
    <Modal
      open={open}
      title="Create private review"
      description="This creates a private academy record. Consent starts pending and no rider or guardian can see it until an assigned coach approves it."
      onClose={() => !actions.submitting && onClose()}
      size="lg"
    >
      <form className="space-y-5" onSubmit={submit}>
        {validationError || actions.error ? (
          <ErrorState message={validationError || actions.error || ""} />
        ) : null}
        <label>
          <span className={labelClass}>Rider</span>
          <select
            className={fieldClass}
            required
            value={form.riderId}
            disabled={actions.submitting || riders.loading}
            onChange={(event) =>
              setForm((current) => ({ ...current, riderId: event.target.value }))
            }
          >
            <option value="">Choose an assigned rider</option>
            {(riders.data ?? []).map((rider) => (
              <option key={rider.id} value={rider.id}>
                {rider.name}
              </option>
            ))}
          </select>
          {riders.error ? (
            <p className="mt-1 text-xs text-error-700">{riders.error}</p>
          ) : null}
        </label>
        <label>
          <span className={labelClass}>Assigned coach</span>
          <select
            className={fieldClass}
            required
            value={form.coachId}
            disabled={
              actions.submitting || !form.riderId || coaches.loading
            }
            onChange={(event) =>
              setForm((current) => ({ ...current, coachId: event.target.value }))
            }
          >
            <option value="">
              {form.riderId ? "Choose the assigned coach" : "Choose a rider first"}
            </option>
            {(coaches.data ?? []).map((coach) => (
              <option key={coach.id} value={coach.id}>
                {coach.name}
              </option>
            ))}
          </select>
          {coaches.error ? (
            <p className="mt-1 text-xs text-error-700">{coaches.error}</p>
          ) : null}
        </label>
        <label>
          <span className={labelClass}>Review title</span>
          <input
            className={fieldClass}
            required
            maxLength={160}
            value={form.title}
            disabled={actions.submitting}
            onChange={(event) =>
              setForm((current) => ({ ...current, title: event.target.value }))
            }
            placeholder="e.g. Flatwork lesson review"
          />
        </label>
        <label>
          <span className={labelClass}>Training objective</span>
          <textarea
            className={fieldClass}
            maxLength={500}
            rows={3}
            value={form.trainingObjective ?? ""}
            disabled={actions.submitting}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                trainingObjective: event.target.value,
              }))
            }
            placeholder="Required unless a lesson ID or competition reference is provided."
          />
        </label>
        <label>
          <span className={labelClass}>Competition reference (optional)</span>
          <input
            className={fieldClass}
            maxLength={240}
            value={form.competitionReference ?? ""}
            disabled={actions.submitting}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                competitionReference: event.target.value,
              }))
            }
          />
        </label>
        <p className="rounded-xl border border-primary-300 bg-primary-50 p-3 text-xs leading-5 text-primary-800">
          This release records video-review metadata and manual notes only. It
          does not run AI, gait, YOLO, soundness, medical, or safety analysis.
        </p>
        <div className="flex justify-end gap-3">
          <OutlineButton
            type="button"
            disabled={actions.submitting}
            onClick={onClose}
          >
            Cancel
          </OutlineButton>
          <PrimaryButton type="submit" disabled={actions.submitting}>
            <Plus className="size-4" />
            Create review
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function ReviewList({
  canManage,
  onCreate,
}: {
  canManage: boolean;
  onCreate: () => void;
}) {
  const navigate = useNavigate();
  const sessions = useVideoReviewSessions();

  if (sessions.loading) return <PageSkeleton cards={3} />;
  if (sessions.error) {
    return (
      <ErrorState
        message={sessions.error}
        retryLabel="Try again"
        onRetry={sessions.refetch}
      />
    );
  }

  return (
    <section>
      <PageHeader
        eyebrow="Private video review"
        title="Video Review Workspace"
        description="Private, academy-scoped coaching review. Riders and verified guardians only receive coach-approved output."
        actions={
          canManage ? (
            <PrimaryButton type="button" onClick={onCreate}>
              <Plus className="size-4" />
              Create review
            </PrimaryButton>
          ) : undefined
        }
      />
      <SurfaceCard className="mb-6 border-primary-300 bg-primary-50 p-4">
        <div className="flex gap-3">
          <LockKeyhole className="mt-0.5 size-5 shrink-0 text-primary-700" />
          <p className="text-sm leading-6 text-primary-900">
            No public links or public analytics are available here. Playback is
            authorized per session and uses short-lived private access only.
          </p>
        </div>
      </SurfaceCard>
      {!sessions.data?.length ? (
        <SurfaceCard>
          <EmptyState
            icon={Video}
            title={
              canManage
                ? "No private reviews yet"
                : "No coach-approved reviews are available"
            }
            description={
              canManage
                ? "Create a review after confirming the academy, rider, and coaching context."
                : "Private reviews remain hidden until consent and coach approval are both recorded."
            }
            action={
              canManage ? (
                <PrimaryButton type="button" onClick={onCreate}>
                  <Plus className="size-4" />
                  Create review
                </PrimaryButton>
              ) : undefined
            }
          />
        </SurfaceCard>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {sessions.data.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => navigate(`/video-review/${session.id}`)}
              className="text-start"
            >
              <SurfaceCard className="h-full p-6 transition hover:border-primary-400 hover:shadow-md">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl text-espresso">{session.title}</h2>
                    <p className="mt-1 text-sm font-semibold text-primary-700">
                      {session.riderName ?? "Authorized rider"}
                    </p>
                  </div>
                  <StatusBadge
                    status={session.reviewStatus}
                    label={reviewStatusLabel(session.reviewStatus)}
                  />
                </div>
                <SessionContext session={session} />
                <div className="mt-5 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-cream-100 px-3 py-1.5 font-semibold text-text-secondary">
                    Consent: {reviewStatusLabel(session.consentStatus)}
                  </span>
                  <span className="rounded-full bg-cream-100 px-3 py-1.5 font-semibold text-text-secondary">
                    Retention: {reviewStatusLabel(session.retentionState)}
                  </span>
                </div>
              </SurfaceCard>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function ClipCard({
  clip,
  canManage,
  onPlayback,
}: {
  clip: VideoReviewClip;
  canManage: boolean;
  onPlayback: (clip: VideoReviewClip) => void;
}) {
  return (
    <div className="rounded-xl border border-cream-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold text-espresso">{clip.originalFilename}</p>
          <p className="mt-1 text-xs text-text-secondary">
            {(clip.originalSizeBytes / 1024 / 1024).toFixed(1)} MB ·{" "}
            {reviewStatusLabel(clip.processingStatus)}
          </p>
        </div>
        <StatusBadge
          status={clip.processingStatus}
          label={reviewStatusLabel(clip.processingStatus)}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-secondary">
        <span className="rounded-full bg-cream-50 px-3 py-1">
          {clip.streamingReady ? "Streaming derivative ready" : "Derivative pending"}
        </span>
        <span className="rounded-full bg-cream-50 px-3 py-1">
          Slow motion: {clip.slowMotionRates.join("×, ")}×
        </span>
        <span className="rounded-full bg-cream-50 px-3 py-1">
          {clip.keyframeTimeline.length} key frames
        </span>
      </div>
      {(clip.streamingReady || canManage) && clip.processingStatus !== "deleted" ? (
        <OutlineButton
          type="button"
          className="mt-4"
          onClick={() => onPlayback(clip)}
        >
          <FileVideo className="size-4" />
          Secure playback
        </OutlineButton>
      ) : null}
    </div>
  );
}

function ReviewDetail({ canManage }: { canManage: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isStaff } = useAuth();
  const session = useVideoReviewSession(id);
  const clips = useVideoReviewClips(id);
  const actions = useVideoReviewActions();
  const [selectedClip, setSelectedClip] = useState<string | undefined>();
  const annotations = useVideoReviewAnnotations(selectedClip);
  const activity = useVideoReviewActivity(id);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [annotationType, setAnnotationType] =
    useState<VideoReviewAnnotationType>("text");
  const [annotationText, setAnnotationText] = useState("");
  const [audienceVisible, setAudienceVisible] = useState(false);

  const activeClipId = selectedClip ?? clips.data?.[0]?.id;
  const selectedAnnotations =
    useVideoReviewAnnotations(activeClipId);

  const refreshAll = () => {
    session.refetch();
    clips.refetch();
    annotations.refetch();
    selectedAnnotations.refetch();
    activity.refetch();
  };

  const openPlayback = async (clip: VideoReviewClip) => {
    const url = await actions.getPlaybackUrl(clip.id, canManage && isStaff());
    if (url) {
      setSelectedClip(clip.id);
      setPlaybackUrl(url);
      refreshAll();
    }
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !id) return;
    const clipId = await actions.uploadClip(id, file);
    event.target.value = "";
    if (clipId) {
      setSelectedClip(clipId);
      refreshAll();
    }
  };

  const submitAnnotation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeClipId || !annotationText.trim()) return;
    const completed = await actions.addAnnotation(
      activeClipId,
      annotationType,
      annotationText,
      audienceVisible,
    );
    if (completed !== null) {
      setAnnotationText("");
      refreshAll();
    }
  };

  if (session.loading || clips.loading) return <PageSkeleton cards={3} />;
  if (session.error || clips.error) {
    return <ErrorState message={session.error || clips.error || ""} />;
  }
  if (!session.data) {
    return (
      <SurfaceCard>
        <EmptyState
          icon={ShieldCheck}
          title="Review not available"
          description="This review may be private, unapproved, deleted, or outside your academy access."
          action={
            <OutlineButton type="button" onClick={() => navigate("/video-review")}>
              <ArrowLeft className="size-4" />
              Back to reviews
            </OutlineButton>
          }
        />
      </SurfaceCard>
    );
  }

  const detail = session.data;
  return (
    <section>
      <PageHeader
        eyebrow="Private video review"
        title={detail.title}
        description={`Rider: ${detail.riderName ?? "Authorized rider"} · Coach: ${detail.coachName ?? "Assigned coach"}`}
        actions={
          <OutlineButton type="button" onClick={() => navigate("/video-review")}>
            <ArrowLeft className="size-4" />
            Back to reviews
          </OutlineButton>
        }
      />
      {actions.error ? <ErrorState message={actions.error} /> : null}
      <SurfaceCard className="mb-6 p-5">
        <SessionContext session={detail} />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-cream-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-text-secondary">Consent</p>
            <p className="mt-1 font-semibold text-espresso">
              {reviewStatusLabel(detail.consentStatus)}
            </p>
          </div>
          <div className="rounded-xl bg-cream-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-text-secondary">Review</p>
            <p className="mt-1 font-semibold text-espresso">
              {reviewStatusLabel(detail.reviewStatus)}
            </p>
          </div>
          <div className="rounded-xl bg-cream-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-text-secondary">Retention</p>
            <p className="mt-1 font-semibold text-espresso">
              {reviewStatusLabel(detail.retentionState)}
            </p>
          </div>
        </div>
        {canManage ? (
          <div className="mt-5 flex flex-wrap gap-3 border-t border-cream-200 pt-4">
            {detail.consentStatus !== "granted" ? (
              <PrimaryButton
                type="button"
                disabled={actions.submitting}
                onClick={async () => {
                  await actions.updateSession(detail.id, {
                    consent_status: "granted",
                  });
                  refreshAll();
                }}
              >
                <CheckCircle2 className="size-4" />
                Record consent
              </PrimaryButton>
            ) : null}
            {detail.reviewStatus !== "coach_approved" ? (
              <OutlineButton
                type="button"
                disabled={
                  actions.submitting ||
                  !["granted", "not_required"].includes(detail.consentStatus)
                }
                onClick={async () => {
                  await actions.updateSession(detail.id, {
                    review_status: "coach_approved",
                  });
                  refreshAll();
                }}
              >
                <ShieldCheck className="size-4" />
                Coach approve output
              </OutlineButton>
            ) : null}
            {detail.retentionState !== "deleted" ? (
              <OutlineButton
                type="button"
                disabled={actions.submitting}
                onClick={async () => {
                  await actions.updateSession(detail.id, {
                    retention_state: "deletion_requested",
                  });
                  refreshAll();
                }}
              >
                <Trash2 className="size-4" />
                Request retention deletion
              </OutlineButton>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-primary-50 p-3 text-sm text-primary-900">
            This output is available because consent and coach approval have been recorded. It is read-only.
          </p>
        )}
      </SurfaceCard>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(19rem,0.75fr)]">
        <div className="space-y-6">
          <SurfaceCard className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl text-espresso">Private clips</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Originals are never public. Streaming derivatives are shown only when ready and authorized.
                </p>
              </div>
              {canManage ? (
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-bold text-white">
                  <Upload className="size-4" />
                  Add clip
                  <input
                    className="sr-only"
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm"
                    disabled={actions.submitting}
                    onChange={upload}
                  />
                </label>
              ) : null}
            </div>
            <div className="mt-5 space-y-3">
              {clips.data?.map((clip) => (
                <ClipCard
                  key={clip.id}
                  clip={clip}
                  canManage={canManage}
                  onPlayback={openPlayback}
                />
              ))}
              {!clips.data?.length ? (
                <p className="rounded-xl bg-cream-50 p-4 text-sm text-text-secondary">
                  {canManage
                    ? "No clips have been uploaded for this review."
                    : "No coach-approved streaming clips are available."}
                </p>
              ) : null}
            </div>
          </SurfaceCard>

          {playbackUrl ? (
            <SurfaceCard className="overflow-hidden">
              <div className="aspect-video bg-espresso">
                <video controls preload="metadata" className="size-full">
                  <source src={playbackUrl} />
                </video>
              </div>
              <p className="border-t border-cream-200 p-4 text-xs text-text-secondary">
                Playback access expires shortly and is not a public link.
              </p>
            </SurfaceCard>
          ) : null}
        </div>

        <div className="space-y-6">
          <SurfaceCard className="p-6">
            <div className="flex items-center gap-3">
              <MessageSquareText className="size-5 text-primary-600" />
              <div>
                <h2 className="text-xl text-espresso">Manual review notes</h2>
                <p className="text-sm text-text-secondary">
                  Text, tag, voice, drawing, and frame annotations are manual review interfaces only.
                </p>
              </div>
            </div>
            {canManage && activeClipId ? (
              <form className="mt-5 space-y-3" onSubmit={submitAnnotation}>
                <select
                  className={fieldClass}
                  value={annotationType}
                  onChange={(event) =>
                    setAnnotationType(event.target.value as VideoReviewAnnotationType)
                  }
                >
                  <option value="text">Text note</option>
                  <option value="tag">Tag</option>
                  <option value="voice">Voice annotation status</option>
                  <option value="drawing">Drawing annotation status</option>
                  <option value="frame">Frame annotation</option>
                </select>
                <textarea
                  className={fieldClass}
                  rows={3}
                  value={annotationText}
                  onChange={(event) => setAnnotationText(event.target.value)}
                  placeholder="Add a coach observation or manual capture note"
                />
                <label className="flex items-start gap-2 text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={audienceVisible}
                    onChange={(event) => setAudienceVisible(event.target.checked)}
                  />
                  Include this annotation in coach-approved rider/guardian output.
                </label>
                <PrimaryButton type="submit" disabled={actions.submitting}>
                  Add annotation
                </PrimaryButton>
              </form>
            ) : null}
            <div className="mt-5 space-y-3">
              {selectedAnnotations.loading ? (
                <p className="text-sm text-text-secondary">Loading annotations…</p>
              ) : selectedAnnotations.error ? (
                <p className="text-sm text-error-700">{selectedAnnotations.error}</p>
              ) : (selectedAnnotations.data ?? []).length ? (
                selectedAnnotations.data?.map((annotation) => (
                  <div key={annotation.id} className="rounded-xl bg-cream-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-primary-700">
                      {annotation.type} · {reviewStatusLabel(annotation.visibility)}
                    </p>
                    <p className="mt-1 text-sm text-espresso">
                      {typeof annotation.payload.text === "string"
                        ? annotation.payload.text
                        : "Manual annotation metadata recorded."}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-text-secondary">
                  Select a clip to view its approved annotations.
                </p>
              )}
            </div>
          </SurfaceCard>

          {canManage ? (
            <SurfaceCard className="p-6">
              <div className="flex items-center gap-3">
                <Clock3 className="size-5 text-primary-600" />
                <h2 className="text-xl text-espresso">Activity audit</h2>
              </div>
              <div className="mt-4 space-y-3">
                {(activity.data ?? []).map((event) => (
                  <div key={event.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-espresso">
                      {reviewStatusLabel(event.action)}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {formatDate(event.occurredAt, "en-US", {
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
                {!activity.data?.length ? (
                  <p className="text-sm text-text-secondary">
                    Every upload, edit, approval, access request, and deletion is written here.
                  </p>
                ) : null}
              </div>
            </SurfaceCard>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default function VideoReviewPage() {
  const { hasRole, activeOrganization } = useAuth();
  const { id } = useParams();
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();
  const canManage =
    Boolean(activeOrganization) && reviewStaffRoles.some((role) => hasRole(role));

  const content = useMemo(
    () =>
      id ? (
        <ReviewDetail canManage={canManage} />
      ) : (
        <ReviewList canManage={canManage} onCreate={() => setCreateOpen(true)} />
      ),
    [canManage, id],
  );

  return (
    <>
      {content}
      <ReviewCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(sessionId) => {
          setCreateOpen(false);
          navigate(`/video-review/${sessionId}`);
        }}
      />
    </>
  );
}