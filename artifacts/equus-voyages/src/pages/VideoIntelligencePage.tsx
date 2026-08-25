import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  CheckCircle,
  ClipboardCheck,
  FileText,
  Lock,
  Plus,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UploadCloud,
  Video
} from "lucide-react";

import {
  EmptyState,
  ErrorState,
  OutlineButton,
  PageHeader,
  PageSkeleton,
  PrimaryButton,
  StatusBadge,
  SurfaceCard,
  fieldClass,
  labelClass,
  formatDate,
  Modal,
} from "@/components/EquiVistaUI";
import { useAuth } from "@/contexts/AuthContext";
import {
  useVideoRelease2Access,
  useVideoRelease2Sessions,
  useVideoRelease2SessionWorkspace,
  useVideoRelease2ApprovedFeedback,
  useVideoRelease2RiderConsentSessions,
  useVideoRelease2Actions,
  useVideoRelease2PilotRiders,
  useVideoRelease2AssignedCoaches,
  type VideoRelease2TrendPoint
} from "@/hooks/use-video-release-2";
import { useVideoRelease3Access } from "@/hooks/use-video-release-3";
import { VideoDevelopmentWorkspace } from "@/components/VideoDevelopmentWorkspace";

function useWorkspaceLocale() {
  const { i18n } = useTranslation();
  return (i18n.resolvedLanguage ?? i18n.language) === "ar" ? "ar-JO" : "en-US";
}

function NotEnrolledView() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow={t("videoRelease2.pilotEyebrow", "Adult Rider Pilot")}
        title={t("videoRelease2.pilotTitle", "Video Intelligence")}
        description={t("videoRelease2.pilotDescription", "Secure, coach-led video review for adult riders.")}
      />
      <SurfaceCard>
        <EmptyState
          icon={ShieldAlert}
          title={t("videoRelease2.notEnrolledTitle", "Not Enrolled in Pilot")}
          description={t("videoRelease2.notEnrolledDesc", "This feature is currently restricted to the adult rider video intelligence pilot. Contact your coach or academy administrator to participate.")}
        />
      </SurfaceCard>
    </div>
  );
}

function RiderSubmission() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const coaches = useVideoRelease2AssignedCoaches(user?.id ?? null);
  const actions = useVideoRelease2Actions();
  const [coachId, setCoachId] = useState("");
  const [title, setTitle] = useState("");
  const [exerciseContext, setExerciseContext] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [complete, setComplete] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.id || !coachId || !title.trim() || !file || !consentConfirmed) return;
    const sessionId = await actions.createSession({
      riderId: user.id,
      coachId,
      title,
      exerciseContext,
    });
    if (!sessionId) return;
    const consentRecorded = await actions.recordConsent(sessionId, true);
    if (!consentRecorded) return;
    const clipId = await actions.uploadClip(sessionId, file);
    if (clipId) {
      setComplete(true);
      setTitle("");
      setExerciseContext("");
      setFile(null);
      setConsentConfirmed(false);
    }
  };

  return (
    <SurfaceCard className="p-6">
      <div className="flex items-start gap-3">
        <UploadCloud className="mt-0.5 size-5 text-primary-600" aria-hidden="true" />
        <div>
          <h3 className="font-serif text-xl text-espresso">
            {t("videoRelease2.riderUploadTitle", "Share a private clip with your coach")}
          </h3>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            {t("videoRelease2.riderUploadDescription", "Your clip is private to the assigned coach. It does not create rider-visible feedback until that coach explicitly approves a review.")}
          </p>
        </div>
      </div>
      {complete ? (
        <p className="mt-4 rounded-xl border border-success-200 bg-success-50 p-3 text-sm text-success-800">
          {t("videoRelease2.riderUploadComplete", "Your clip was uploaded to the private coach workspace.")}
        </p>
      ) : null}
      {actions.error ? <ErrorState message={actions.error} /> : null}
      <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={submit}>
        <div>
          <label className={labelClass}>{t("videoRelease2.coachLabel", "Assigned coach")}</label>
          <select
            className={fieldClass}
            required
            value={coachId}
            onChange={(event) => setCoachId(event.target.value)}
            disabled={actions.submitting || coaches.loading}
          >
            <option value="">{t("videoRelease2.selectCoach", "Select your coach")}</option>
            {(coaches.data ?? []).map((coach) => (
              <option key={coach.id} value={coach.id}>{coach.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("videoRelease2.sessionTitleLabel", "Session title")}</label>
          <input
            className={fieldClass}
            required
            maxLength={160}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={actions.submitting}
          />
        </div>
        <div className="md:col-span-2">
          <label className={labelClass}>{t("videoRelease2.sessionContextLabel", "Exercise context")}</label>
          <textarea
            className={fieldClass}
            rows={2}
            maxLength={800}
            value={exerciseContext}
            onChange={(event) => setExerciseContext(event.target.value)}
            disabled={actions.submitting}
          />
        </div>
        <div className="md:col-span-2">
          <label className={labelClass}>{t("videoRelease2.clipLabel", "Video clip")}</label>
          <input
            className={fieldClass}
            required
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            disabled={actions.submitting}
          />
          <p className="mt-2 text-xs text-text-secondary">
            {t("videoRelease2.uploadLimits", "MP4, MOV, or WebM. Maximum 500 MB and 8 hours. Duplicate private clips are rejected by checksum.")}
          </p>
        </div>
        <label className="md:col-span-2 flex items-start gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={consentConfirmed}
            onChange={(event) => setConsentConfirmed(event.target.checked)}
            disabled={actions.submitting}
            className="mt-1"
          />
          <span>{t("videoRelease2.riderConsentConfirmation", "I am the enrolled adult rider and consent to this private coach review for this session.")}</span>
        </label>
        <div className="md:col-span-2 flex justify-end">
          <PrimaryButton
            type="submit"
            disabled={
              actions.submitting ||
              coaches.loading ||
              !coachId ||
              !title.trim() ||
              !file ||
              !consentConfirmed
            }
          >
            <UploadCloud className="size-4" />
            {actions.submitting
              ? t("common.working", "Working...")
              : t("videoRelease2.riderUploadAction", "Upload private clip")}
          </PrimaryButton>
        </div>
      </form>
    </SurfaceCard>
  );
}

function RiderFeedbackView() {
  const { t } = useTranslation();
  const locale = useWorkspaceLocale();
  const { user } = useAuth();
  const feedbackQuery = useVideoRelease2ApprovedFeedback();
  const consentSessions = useVideoRelease2RiderConsentSessions();
  const actions = useVideoRelease2Actions();
  const [trendData, setTrendData] = useState<VideoRelease2TrendPoint[]>([]);

  const loadTrendRef = useRef(actions.loadTrend);
  loadTrendRef.current = actions.loadTrend;

  useEffect(() => {
    if (user?.id) {
      loadTrendRef.current(user.id).then(data => {
        if (data) setTrendData(data);
      });
    }
  }, [user?.id]);

  if (feedbackQuery.loading) return <PageSkeleton cards={2} />;
  if (feedbackQuery.error) return <ErrorState message={feedbackQuery.error} onRetry={feedbackQuery.refetch} />;

  const feedback = feedbackQuery.data || [];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        eyebrow={t("videoRelease2.riderEyebrow", "Your Approved Feedback")}
        title={t("videoRelease2.riderTitle", "Video Intelligence")}
        description={t("videoRelease2.riderDescription", "Review approved scorecards and rhythm summaries explicitly released by your coach. No medical/safety claims, AI generation, camera, livestream, or Guardian/Parent experience.")}
      />
      <RiderSubmission />
      {(consentSessions.data ?? []).some((session) => session.consentStatus === "granted") ? (
        <SurfaceCard className="p-6">
          <h3 className="font-serif text-xl text-espresso">{t("videoRelease2.consentControlsTitle", "Your private clip consent")}</h3>
          <p className="mt-1 text-sm text-text-secondary">{t("videoRelease2.consentControlsDesc", "Withdrawing consent immediately removes private clips and prevents further review or feedback access.")}</p>
          <div className="mt-4 space-y-3">
            {(consentSessions.data ?? []).filter((session) => session.consentStatus === "granted").map((session) => (
              <div key={session.id} className="flex flex-col gap-3 rounded-xl border border-cream-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-semibold text-espresso">{session.title}</p>
                <OutlineButton onClick={async () => {
                  const withdrawn = await actions.recordConsent(session.id, false);
                  if (withdrawn) {
                    consentSessions.refetch();
                    feedbackQuery.refetch();
                  }
                }} disabled={actions.submitting}>
                  {t("videoRelease2.withdrawConsent", "Withdraw consent and delete clip")}
                </OutlineButton>
              </div>
            ))}
          </div>
        </SurfaceCard>
      ) : null}

      {trendData.length > 0 && (
        <SurfaceCard className="p-6">
          <div className="flex items-center gap-3 border-b border-cream-200 pb-4 mb-4">
            <TrendingUp className="size-5 text-primary-600" aria-hidden="true" />
            <h3 className="text-lg font-serif text-espresso">{t("videoRelease2.trendTitle", "Performance Trend")}</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {trendData.map((pt, i) => (
              <div key={i} className="rounded-xl bg-cream-50 p-4 border border-cream-100">
                <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">{pt.category}</p>
                <p className="mt-1 text-2xl font-serif text-espresso">{pt.score}</p>
                <p className="mt-2 text-xs text-text-secondary">{formatDate(pt.approvedAt, locale)}</p>
              </div>
            ))}
          </div>
        </SurfaceCard>
      )}

      {feedback.length === 0 ? (
        <SurfaceCard>
          <EmptyState
            icon={ClipboardCheck}
            title={t("videoRelease2.noFeedbackTitle", "No Approved Feedback Yet")}
            description={t("videoRelease2.noFeedbackDesc", "Your coach has not yet released any approved video scorecards for your review.")}
          />
        </SurfaceCard>
      ) : (
        <div className="grid gap-6">
          {feedback.map((fb, idx) => (
            <SurfaceCard key={idx} className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="text-xl font-serif text-espresso">{fb.title}</h4>
                  {fb.exerciseContext && (
                    <p className="mt-1 text-sm text-text-secondary">{fb.exerciseContext}</p>
                  )}
                </div>
                <StatusBadge status="approved" label={t("videoRelease2.approvedBadge", "Coach Approved")} />
              </div>
              <div className="mt-4 grid md:grid-cols-2 gap-6">
                {fb.category && (
                  <div className="bg-primary-50 rounded-xl p-4 border border-primary-100">
                    <p className="text-xs font-bold uppercase tracking-wider text-primary-800">{fb.category}</p>
                    <p className="mt-1 text-3xl font-serif text-primary-900">{fb.score}</p>
                    {fb.coachNote && (
                      <p className="mt-3 text-sm text-primary-800 leading-relaxed italic">"{fb.coachNote}"</p>
                    )}
                  </div>
                )}
                {fb.rhythmState && (
                  <div className="bg-cream-50 rounded-xl p-4 border border-cream-200">
                    <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">{t("videoRelease2.rhythmTitle", "Rhythm & Stride")}</p>
                    <p className="mt-1 text-lg font-medium text-espresso capitalize">{fb.rhythmState.replace('_', ' ')}</p>
                    {fb.strideCount !== null && (
                      <p className="mt-2 text-sm text-text-secondary">{fb.strideCount} {t("videoRelease2.strides", "strides")}</p>
                    )}
                    {fb.strideNotes && (
                      <p className="mt-2 text-sm text-text-secondary italic">"{fb.strideNotes}"</p>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-4 text-xs text-text-secondary flex items-center gap-1">
                <CheckCircle className="size-3" aria-hidden="true" />
                <span>{t("videoRelease2.approvedAt", "Approved at")}: {formatDate(fb.approvedAt, locale, { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
            </SurfaceCard>
          ))}
        </div>
      )}
    </div>
  );
}

function DraftEditor({ 
  revisionId, 
  clipId, 
  onSave, 
  onApprove, 
  submitting 
}: { 
  revisionId: string; 
  clipId: string | null; 
  onSave: () => void; 
  onApprove: () => void;
  submitting: boolean;
}) {
  const { t } = useTranslation();
  const actions = useVideoRelease2Actions();

  const domains = [
    "approach",
    "takeoff",
    "jump",
    "landing",
    "between_fences",
  ];
  const [selectedDomain, setSelectedDomain] = useState(domains[0]);
  const [score, setScore] = useState<number>(3);
  const [coachNote, setCoachNote] = useState("");

  const handleSaveScorecard = async (e: FormEvent) => {
    e.preventDefault();
    await actions.saveScorecard(revisionId, selectedDomain, score, coachNote);
    onSave();
    setCoachNote("");
  };

  const [rhythmState, setRhythmState] = useState("steady");
  const [strideCount, setStrideCount] = useState<number>(4);
  const [strideNotes, setStrideNotes] = useState("");

  const handleSaveStride = async (e: FormEvent) => {
    e.preventDefault();
    await actions.saveStrideObservation({
      revisionId,
      clipId,
      startMs: 0,
      endMs: 5000, 
      rhythmState,
      strideCount,
      notes: strideNotes
    });
    onSave();
    setStrideNotes("");
  };

  const [sequence, setSequence] = useState<number>(1);
  const [fenceLabel, setFenceLabel] = useState("Fence 1");
  const [tagCode, setTagCode] = useState("approach");
  const [tagNotes, setTagNotes] = useState("");

  const handleSaveTag = async (e: FormEvent) => {
    e.preventDefault();
    await actions.saveCourseTag({
      revisionId,
      clipId,
      sequenceNumber: sequence,
      fenceLabel,
      tagCode,
      notes: tagNotes
    });
    onSave();
    setTagNotes("");
  };

  return (
    <div className="space-y-8">
      <div className="border border-cream-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-cream-50 p-4 border-b border-cream-200">
          <h4 className="font-serif text-espresso text-lg">{t("videoRelease2.scorecardTitle", "1. Record Scorecard")}</h4>
          <p className="text-xs text-text-secondary mt-1">{t("videoRelease2.scorecardDesc", "Save scores for all 5 domains.")}</p>
        </div>
        <form onSubmit={handleSaveScorecard} className="p-4 space-y-4 bg-white">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t("videoRelease2.domainLabel", "Domain")}</label>
              <select className={fieldClass} value={selectedDomain} onChange={e => setSelectedDomain(e.target.value)} disabled={submitting}>
                {domains.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("videoRelease2.scoreLabel", "Score (1–5)")}</label>
              <input type="number" min={1} max={5} required className={fieldClass} value={score} onChange={e => setScore(Number(e.target.value))} disabled={submitting} />
            </div>
          </div>
          <div>
            <label className={labelClass}>{t("videoRelease2.noteLabel", "Coach Note (optional)")}</label>
            <textarea className={fieldClass} rows={2} value={coachNote} onChange={e => setCoachNote(e.target.value)} disabled={submitting} placeholder="Provide constructive feedback..." />
          </div>
          <div className="flex justify-end">
            <OutlineButton type="submit" disabled={submitting} className="text-xs py-1.5 min-h-0">
              {t("videoRelease2.saveDomainBtn", "Save Domain Score")}
            </OutlineButton>
          </div>
        </form>
      </div>

      <div className="border border-cream-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-cream-50 p-4 border-b border-cream-200">
          <h4 className="font-serif text-espresso text-lg">{t("videoRelease2.strideTitle", "2. Stride & Rhythm")}</h4>
          <p className="text-xs text-text-secondary mt-1">{t("videoRelease2.strideDesc", "Capture rhythm state across a specific segment.")}</p>
        </div>
        <form onSubmit={handleSaveStride} className="p-4 space-y-4 bg-white">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t("videoRelease2.rhythmStateLabel", "Rhythm State")}</label>
              <select className={fieldClass} value={rhythmState} onChange={e => setRhythmState(e.target.value)} disabled={submitting}>
                <option value="steady">{t("videoRelease2.rhythmSteady", "Steady")}</option>
                <option value="variable">{t("videoRelease2.rhythmVariable", "Variable")}</option>
                <option value="recovered">{t("videoRelease2.rhythmRecovered", "Recovered")}</option>
                <option value="not_observed">{t("videoRelease2.rhythmNotObserved", "Not observed")}</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("videoRelease2.strideCountLabel", "Stride Count")}</label>
              <input type="number" min={1} max={99} required className={fieldClass} value={strideCount} onChange={e => setStrideCount(Number(e.target.value))} disabled={submitting} />
            </div>
          </div>
          <div>
            <label className={labelClass}>{t("videoRelease2.notesLabel", "Observation Notes")}</label>
            <input type="text" className={fieldClass} value={strideNotes} onChange={e => setStrideNotes(e.target.value)} disabled={submitting} placeholder="Additional context..." />
          </div>
          <div className="flex justify-end">
            <OutlineButton type="submit" disabled={submitting} className="text-xs py-1.5 min-h-0">
              {t("videoRelease2.saveStrideBtn", "Save Observation")}
            </OutlineButton>
          </div>
        </form>
      </div>

      <div className="border border-cream-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-cream-50 p-4 border-b border-cream-200">
          <h4 className="font-serif text-espresso text-lg">{t("videoRelease2.courseTagTitle", "3. Course/Fence Tag")}</h4>
          <p className="text-xs text-text-secondary mt-1">{t("videoRelease2.courseTagDesc", "Annotate specific fences or movements.")}</p>
        </div>
        <form onSubmit={handleSaveTag} className="p-4 space-y-4 bg-white">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>{t("videoRelease2.sequenceLabel", "Sequence #")}</label>
              <input type="number" min={1} required className={fieldClass} value={sequence} onChange={e => setSequence(Number(e.target.value))} disabled={submitting} />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>{t("videoRelease2.fenceLabelLabel", "Fence/Movement Label")}</label>
              <input type="text" required className={fieldClass} value={fenceLabel} onChange={e => setFenceLabel(e.target.value)} disabled={submitting} placeholder="e.g. Oxer 1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t("videoRelease2.tagCodeLabel", "Tag Code")}</label>
              <select className={fieldClass} value={tagCode} onChange={e => setTagCode(e.target.value)} disabled={submitting}>
                <option value="approach">{t("videoRelease2.tagApproach", "Approach")}</option>
                <option value="takeoff">{t("videoRelease2.tagTakeoff", "Takeoff")}</option>
                <option value="jump">{t("videoRelease2.tagJump", "Jump")}</option>
                <option value="landing">{t("videoRelease2.tagLanding", "Landing")}</option>
                <option value="between_fences">{t("videoRelease2.tagBetweenFences", "Between fences")}</option>
                <option value="course_note">{t("videoRelease2.tagCourseNote", "Course note")}</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("videoRelease2.tagNotesLabel", "Notes")}</label>
              <input type="text" className={fieldClass} value={tagNotes} onChange={e => setTagNotes(e.target.value)} disabled={submitting} placeholder="Optional detail..." />
            </div>
          </div>
          <div className="flex justify-end">
            <OutlineButton type="submit" disabled={submitting} className="text-xs py-1.5 min-h-0">
              {t("videoRelease2.saveTagBtn", "Save Tag")}
            </OutlineButton>
          </div>
        </form>
      </div>

      <div className="mt-8 p-6 bg-cream-50 rounded-2xl border border-cream-200">
        <div className="flex flex-col md:flex-row md:items-start gap-4">
          <ShieldAlert className="size-6 text-primary-600 shrink-0 md:mt-1" aria-hidden="true" />
          <div className="flex-1">
            <h4 className="font-serif text-lg text-espresso">{t("videoRelease2.explicitApproveTitle", "Explicit Approval Boundary")}</h4>
            <p className="text-sm text-text-secondary mt-1 mb-5">
              {t("videoRelease2.explicitApproveDesc", "Riders cannot see any drafted scores or observations until explicitly approved. By approving, you release this feedback to the rider's private workspace.")}
            </p>
            <PrimaryButton onClick={onApprove} disabled={submitting} className="w-full sm:w-auto bg-primary-600 hover:bg-primary-700 shadow-md">
              <CheckCircle className="size-4" aria-hidden="true" />
              {t("videoRelease2.approveRevisionBtn", "Explicitly Approve & Release")}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function CoachSessionDetail({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const { t } = useTranslation();
  const locale = useWorkspaceLocale();
  const workspace = useVideoRelease2SessionWorkspace(sessionId);
  const actions = useVideoRelease2Actions();
  const access = useVideoRelease2Access();
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  
  if (workspace.loading) return <PageSkeleton cards={2} />;
  if (workspace.error) return <ErrorState message={workspace.error} onRetry={workspace.refetch} />;
  if (!workspace.data?.session) return <ErrorState message={t("videoRelease2.sessionNotFound", "Session not found")} onRetry={onBack} />;

  const { session, clips, revisions } = workspace.data;
  const draftRevision = revisions.find(r => r.status === 'draft');
  const approvedRevision = revisions.find(r => r.status === 'approved');

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await actions.uploadClip(session.id, file);
    workspace.refetch();
    e.target.value = '';
  };

  const handlePlayback = async (storagePath: string) => {
    const signedUrl = await actions.getClipPlaybackUrl(storagePath);
    if (signedUrl) setPlaybackUrl(signedUrl);
  };

  const handleCreateDraft = async () => {
    await actions.createRevision(session.id);
    workspace.refetch();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-20">
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-text-secondary hover:text-espresso transition-colors">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("videoRelease2.backToSessions", "Back to sessions")}
      </button>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif text-espresso">{session.title}</h2>
          {session.exerciseContext && <p className="mt-2 text-text-secondary">{session.exerciseContext}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={session.reviewStatus} />
          <StatusBadge status={session.consentStatus} />
        </div>
      </div>
      
      {actions.error && <ErrorState message={actions.error} />}

      <div className="grid md:grid-cols-[1fr_350px] gap-6 items-start">
        <div className="space-y-6">
          <SurfaceCard className="p-6">
            <div className="flex justify-between items-center mb-6 border-b border-cream-100 pb-4">
              <h3 className="text-xl font-serif text-espresso flex items-center gap-2">
                <Video className="size-5 text-primary-600" aria-hidden="true" />
                {t("videoRelease2.clipsTitle", "Session Clips")}
              </h3>
              {access.data?.canUpload && (
                <label className={`cursor-pointer inline-flex items-center gap-2 rounded-xl bg-primary-50 px-3 py-2 text-sm font-bold text-primary-700 transition-colors ${session.consentStatus !== 'granted' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary-100'}`}>
                  <UploadCloud className="size-4" aria-hidden="true" />
                  {t("videoRelease2.uploadClipBtn", "Upload Clip")}
                  <input type="file" className="sr-only" accept="video/mp4,video/quicktime,video/webm" onChange={handleUpload} disabled={actions.submitting || session.consentStatus !== 'granted'} />
                </label>
              )}
            </div>
            
            {clips.length === 0 ? (
              <div className="text-sm text-text-secondary py-8 text-center border border-dashed border-cream-300 rounded-xl bg-cream-50/50">
                {t("videoRelease2.noClips", "No video clips have been uploaded yet.")}
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {clips.map(clip => (
                    <div key={clip.id} className="flex justify-between items-center p-4 bg-cream-50 rounded-xl border border-cream-100">
                      <div>
                        <p className="text-sm font-semibold text-espresso">{clip.mimeType.split('/')[1]?.toUpperCase() || 'VIDEO'} - {(clip.byteSize / 1024 / 1024).toFixed(1)} MB</p>
                        <p className="text-xs text-text-secondary mt-1">{Math.round(clip.durationMs / 1000)}s duration · {formatDate(clip.createdAt, locale)}</p>
                      </div>
                      <StatusBadge status={clip.uploadState} />
                      {clip.uploadState === 'uploaded' ? (
                        <OutlineButton onClick={() => handlePlayback(clip.storagePath)} disabled={actions.submitting}>
                          {t("videoRelease2.playPrivateClip", "Play private clip")}
                        </OutlineButton>
                      ) : null}
                    </div>
                  ))}
                </div>
                {playbackUrl ? <video className="mt-4 w-full rounded-xl bg-black" controls src={playbackUrl} /> : null}
              </>
            )}
          </SurfaceCard>

          <SurfaceCard className="p-6">
            <div className="flex justify-between items-center mb-6 border-b border-cream-100 pb-4">
              <h3 className="text-xl font-serif text-espresso flex items-center gap-2">
                <FileText className="size-5 text-primary-600" aria-hidden="true" />
                {t("videoRelease2.reviewWorkspace", "Review Workspace")}
              </h3>
              {!draftRevision && session.consentStatus === 'granted' && (
                <PrimaryButton onClick={handleCreateDraft} disabled={actions.submitting} className="text-xs py-2 min-h-0">
                  {t("videoRelease2.startDraftBtn", "Start Draft")}
                </PrimaryButton>
              )}
            </div>

            {!draftRevision && !approvedRevision ? (
              <div className="text-center py-10 px-4 border border-dashed border-cream-300 rounded-xl bg-cream-50/50">
                <p className="text-sm text-text-secondary">{t("videoRelease2.noDraft", "Start a draft to record scorecard domains and observations.")}</p>
              </div>
            ) : draftRevision ? (
              <DraftEditor 
                revisionId={draftRevision.id} 
                clipId={clips[0]?.id || null} 
                onSave={() => workspace.refetch()}
                onApprove={async () => {
                  await actions.approveRevision(draftRevision.id);
                  workspace.refetch();
                }}
                submitting={actions.submitting}
              />
            ) : (
              <div className="bg-success-50 border border-success-200 rounded-xl p-6 text-center">
                <ShieldCheck className="size-8 text-success-600 mx-auto mb-3" aria-hidden="true" />
                <h4 className="text-lg font-serif text-success-900 mb-1">{t("videoRelease2.revisionApprovedTitle", "Revision Approved")}</h4>
                <p className="text-sm text-success-800">{t("videoRelease2.revisionApprovedDesc", "This session's feedback has been permanently approved and explicitly released to the rider.")}</p>
              </div>
            )}
          </SurfaceCard>
        </div>

        <div className="space-y-6 sticky top-6">
          <SurfaceCard className="p-5 bg-primary-900 text-white border-primary-900 shadow-md">
            <h4 className="font-serif text-lg mb-3 text-primary-50">{t("videoRelease2.pilotGuidelines", "Pilot Guidelines")}</h4>
            <ul className="text-sm space-y-3 text-primary-100/90 list-disc list-outside pl-4 leading-relaxed">
              <li>{t("videoRelease2.guideline1", "Explicit boundary: Output is invisible to riders until approved.")}</li>
              <li>{t("videoRelease2.guideline2", "Coach-led: the assigned coach is the final reviewer and approver.")}</li>
              <li>{t("videoRelease2.guideline3", "Use coaching observations only; this pilot does not make medical or soundness claims.")}</li>
              <li>{t("videoRelease2.guideline4", "Consent strictly enforces data retention and visibility.")}</li>
            </ul>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}

function CoachSessionList({ onSelect }: { onSelect: (id: string) => void }) {
  const { t } = useTranslation();
  const locale = useWorkspaceLocale();
  const { user } = useAuth();
  const sessionsQuery = useVideoRelease2Sessions();
  const ridersQuery = useVideoRelease2PilotRiders();
  const actions = useVideoRelease2Actions();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContext, setNewContext] = useState("");
  const [riderId, setRiderId] = useState("");

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.id || !newTitle.trim() || !riderId) return;
    const id = await actions.createSession({
      riderId,
      coachId: user.id,
      title: newTitle,
      exerciseContext: newContext
    });
    if (id) {
      setShowCreate(false);
      sessionsQuery.refetch();
      onSelect(id);
    }
  };

  if (sessionsQuery.loading || ridersQuery.loading) return <PageSkeleton cards={4} />;
  if (sessionsQuery.error || ridersQuery.error) {
    return (
      <ErrorState
        message={sessionsQuery.error || ridersQuery.error || ""}
        onRetry={() => {
          sessionsQuery.refetch();
          ridersQuery.refetch();
        }}
      />
    );
  }

  const sessions = sessionsQuery.data || [];
  const riders = ridersQuery.data || [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow={t("videoRelease2.coachEyebrow", "Pilot Administration")}
        title={t("videoRelease2.coachTitle", "Coach Workspace")}
        description={t("videoRelease2.coachDesc", "Manage video sessions, record observations, and explicitly release approved feedback to adult riders.")}
        actions={
          <PrimaryButton onClick={() => setShowCreate(true)}>
            <Plus className="size-4" aria-hidden="true" />
            {t("videoRelease2.startSessionBtn", "Start Pilot Session")}
          </PrimaryButton>
        }
      />
      
      {sessions.length === 0 ? (
        <SurfaceCard>
          <EmptyState
            icon={Video}
            title={t("videoRelease2.noSessionsTitle", "No Sessions")}
            description={t("videoRelease2.noSessionsDesc", "Start a new pilot session to begin uploading clips and drafting scorecards.")}
            action={
              <PrimaryButton onClick={() => setShowCreate(true)}>
                <Plus className="size-4" aria-hidden="true" />
                {t("videoRelease2.startSessionBtn", "Start Pilot Session")}
              </PrimaryButton>
            }
          />
        </SurfaceCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sessions.map(session => (
            <button
              key={session.id}
              onClick={() => onSelect(session.id)}
              className="text-left transition-transform hover:-translate-y-0.5"
            >
              <SurfaceCard className="h-full p-6 hover:border-primary-400 hover:shadow-md transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start gap-4">
                    <h3 className="font-serif text-lg text-espresso line-clamp-1">{session.title}</h3>
                    <StatusBadge status={session.reviewStatus} />
                  </div>
                  <p className="mt-2 text-sm text-text-secondary line-clamp-2 leading-relaxed">
                    {session.exerciseContext || t("videoRelease2.noContext", "No context provided")}
                  </p>
                </div>
                <div className="mt-6 flex items-center justify-between text-xs text-text-secondary border-t border-cream-100 pt-4">
                  <span className="flex items-center gap-1 font-medium bg-cream-50 px-2 py-1 rounded-md">
                    <Lock className="size-3" aria-hidden="true" />
                    {session.consentStatus.replace('_', ' ').toUpperCase()}
                  </span>
                  <span>{formatDate(session.createdAt, locale)}</span>
                </div>
              </SurfaceCard>
            </button>
          ))}
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={t("videoRelease2.createSessionTitle", "Start Pilot Session")}
          description={t("videoRelease2.createSessionDesc", "Choose an enrolled adult pilot rider you currently coach. Consent is recorded separately before any clip can be uploaded.")}
      >
        <form onSubmit={handleCreate} className="space-y-5">
          {actions.error && <ErrorState message={actions.error} />}
          <div>
            <label className={labelClass}>{t("videoRelease2.sessionTitleLabel", "Session Title")}</label>
            <input
              type="text"
              required
              maxLength={100}
              className={fieldClass}
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="e.g. Morning Flatwork"
              disabled={actions.submitting}
            />
          </div>
          <div>
            <label className={labelClass}>{t("videoRelease2.riderLabel", "Adult pilot rider")}</label>
            <select
              className={fieldClass}
              required
              value={riderId}
              onChange={(event) => setRiderId(event.target.value)}
              disabled={actions.submitting || riders.length === 0}
            >
              <option value="">{t("videoRelease2.selectRider", "Select an enrolled rider")}</option>
              {riders.map((rider) => (
                <option key={rider.id} value={rider.id}>{rider.name}</option>
              ))}
            </select>
            {riders.length === 0 ? (
              <p className="mt-2 text-xs text-warning-700">
                {t("videoRelease2.noPilotRiders", "No adult pilot riders assigned to your coaching account are enrolled yet.")}
              </p>
            ) : null}
          </div>
          <div>
            <label className={labelClass}>{t("videoRelease2.sessionContextLabel", "Exercise Context")}</label>
            <textarea
              className={fieldClass}
              rows={3}
              value={newContext}
              onChange={e => setNewContext(e.target.value)}
              placeholder="Context or focus for this session..."
              disabled={actions.submitting}
            />
          </div>
          <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-cream-100">
            <OutlineButton type="button" onClick={() => setShowCreate(false)} disabled={actions.submitting}>
              {t("common.cancel", "Cancel")}
            </OutlineButton>
            <PrimaryButton type="submit" disabled={actions.submitting || !newTitle.trim() || !riderId}>
              {actions.submitting ? t("common.saving", "Saving...") : t("videoRelease2.createBtn", "Create Session")}
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function CoachWorkspace() {
  const { t } = useTranslation();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const developmentAccess = useVideoRelease3Access();

  if (selectedSessionId) {
    return <CoachSessionDetail sessionId={selectedSessionId} onBack={() => setSelectedSessionId(null)} />;
  }
  return (
    <div className="space-y-10">
      <CoachSessionList onSelect={setSelectedSessionId} />
      {developmentAccess.data?.enabled && developmentAccess.data.canManage ? (
        <section className="mx-auto max-w-5xl space-y-5" aria-labelledby="video-development-intelligence">
          <div className="border-t border-cream-200 pt-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-600">
              {t("videoRelease3.eyebrow", "Batch 3 · Coach Development Intelligence")}
            </p>
            <h2 id="video-development-intelligence" className="mt-2 font-serif text-3xl text-espresso">
              {t("videoRelease3.title", "Approved development record")}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
              {t("videoRelease3.description", "Use approved, consented video evidence only. This Coach-only workspace does not create Rider or Guardian output.")}
            </p>
          </div>
          <VideoDevelopmentWorkspace />
        </section>
      ) : null}
    </div>
  );
}

export default function VideoIntelligencePage() {
  const accessQuery = useVideoRelease2Access();

  if (accessQuery.loading) return <PageSkeleton cards={3} />;
  if (accessQuery.error) return <ErrorState message={accessQuery.error} onRetry={accessQuery.refetch} />;

  const access = accessQuery.data;
  
  if (!access || !access.enabled || access.pilotScope === 'not_enrolled') {
    return <NotEnrolledView />;
  }

  if (access.pilotScope === 'coach' || access.canManage) {
    return <CoachWorkspace />;
  }

  if (access.pilotScope === 'adult_rider' || access.canViewApproved) {
    return <RiderFeedbackView />;
  }

  return <NotEnrolledView />;
}
