import { useState, type DragEvent, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Circle,
  CloudUpload,
  FileVideo,
  Gauge,
  LoaderCircle,
  MessageSquareText,
  PlayCircle,
  RotateCcw,
  Sparkles,
  Upload,
  Video,
} from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import {
  BusyLabel,
  EmptyState,
  ErrorState,
  Modal,
  OutlineButton,
  PageHeader,
  PageSkeleton,
  PrimaryButton,
  ProgressMeter,
  StatusBadge,
  SurfaceCard,
  fieldClass,
  formatDate,
  labelClass,
} from "@/components/EquiVistaUI";
import {
  useUploadVideo,
  useVideoAnalyses,
  useVideoAnalysis,
} from "@/hooks/use-analysis";
import { useHorses } from "@/hooks/use-horses";
import type {
  AnalysisStatus,
  Discipline,
  VideoAnalysisListItem,
} from "@/hooks/types";

const statusOrder: AnalysisStatus[] = ["uploaded", "processing", "analyzed"];

function AnalysisStepper({ status }: { status: AnalysisStatus }) {
  const { t } = useTranslation();
  const activeIndex = statusOrder.indexOf(status);

  if (status === "failed") {
    return (
      <div className="rounded-xl border border-error-500/25 bg-error-50 p-4">
        <StatusBadge status="failed" label={t("analysis.status.failed")} />
        <p className="mt-2 text-sm text-error-700">{t("analysis.failedDescription")}</p>
      </div>
    );
  }

  return (
    <ol className="grid grid-cols-3" aria-label={t("analysis.processingStatus")}>
      {statusOrder.map((step, index) => {
        const complete = index <= activeIndex;
        return (
          <li key={step} className="relative flex flex-col items-center text-center">
            {index > 0 ? (
              <span
                className={`absolute end-1/2 top-4 h-0.5 w-full ${index <= activeIndex ? "bg-primary-500" : "bg-cream-200"}`}
                aria-hidden="true"
              />
            ) : null}
            <span
              className={`relative z-10 flex size-8 items-center justify-center rounded-full border ${complete ? "border-primary-500 bg-primary-500 text-white" : "border-cream-300 bg-white text-text-secondary"}`}
            >
              {index < activeIndex ? (
                <Check className="size-4" aria-hidden="true" />
              ) : (
                <Circle className="size-3 fill-current" aria-hidden="true" />
              )}
            </span>
            <span className="mt-2 text-xs font-bold text-espresso">
              {t(`analysis.status.${step}`)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function AnalysisCard({
  analysis,
  onOpen,
  onRetry,
}: {
  analysis: VideoAnalysisListItem;
  onOpen: () => void;
  onRetry: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;

  return (
    <SurfaceCard className="overflow-hidden">
      <button type="button" onClick={onOpen} className="block w-full text-start">
        <div className="relative aspect-video bg-cream-100">
          {analysis.thumbnailUrl ? (
            <img
              src={analysis.thumbnailUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-primary-500">
              <PlayCircle className="size-12" aria-hidden="true" />
            </div>
          )}
          {analysis.score !== null ? (
            <span className="absolute end-3 top-3 rounded-full bg-espresso px-3 py-1 font-serif text-lg text-white shadow-sm">
              {Math.round(analysis.score)}
            </span>
          ) : null}
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="line-clamp-2 text-xl text-espresso">{analysis.title}</h2>
            <StatusBadge
              status={analysis.status}
              label={t(`analysis.status.${analysis.status}`)}
            />
          </div>
          <p className="mt-2 text-sm text-text-secondary">
            {analysis.horseName ?? t("analysis.noHorse")} · {analysis.discipline}
          </p>
          <p className="mt-3 flex items-center gap-2 text-xs text-text-secondary">
            <CalendarDays className="size-4" aria-hidden="true" />
            {formatDate(analysis.createdAt, locale)}
          </p>
        </div>
      </button>
      {analysis.status === "failed" ? (
        <div className="border-t border-cream-200 p-4">
          <OutlineButton type="button" className="w-full" onClick={onRetry}>
            <RotateCcw className="size-4" aria-hidden="true" />
            {t("analysis.retryAsNewUpload")}
          </OutlineButton>
        </div>
      ) : null}
    </SurfaceCard>
  );
}

function AnalysisDetail({ id, onNewUpload }: { id: string; onNewUpload: () => void }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { data, loading, error } = useVideoAnalysis(id);

  if (loading) return <PageSkeleton cards={3} />;
  if (error) {
    return <ErrorState message={error} />;
  }
  if (!data) {
    return (
      <SurfaceCard>
        <EmptyState
          icon={Video}
          title={t("analysis.notFoundTitle")}
          description={t("analysis.notFoundDescription")}
          action={
            <OutlineButton type="button" onClick={() => navigate("/analysis")}>
              {t("analysis.backToAnalyses")}
            </OutlineButton>
          }
        />
      </SurfaceCard>
    );
  }

  const detailHeader = (
    <PageHeader
      eyebrow={t("analysis.detailEyebrow")}
      title={data.title}
      description={`${data.horseName ?? t("analysis.noHorse")} · ${formatDate(data.createdAt, locale)}`}
      actions={
        <OutlineButton type="button" onClick={() => navigate("/analysis")}>
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
          {t("analysis.backToAnalyses")}
        </OutlineButton>
      }
    />
  );

  if (data.status !== "analyzed") {
    const failed = data.status === "failed";

    return (
      <div>
        {detailHeader}
        <SurfaceCard className="mx-auto max-w-3xl p-6 sm:p-8">
          <AnalysisStepper status={data.status} />
          <div
            className={`mt-8 rounded-2xl border px-6 py-10 text-center ${
              failed
                ? "border-error-500/25 bg-error-50"
                : "border-primary-300 bg-primary-50"
            }`}
            role={failed ? "alert" : "status"}
            aria-live="polite"
          >
            {failed ? (
              <RotateCcw className="mx-auto size-10 text-error-500" aria-hidden="true" />
            ) : (
              <LoaderCircle className="mx-auto size-10 animate-spin text-primary-600" aria-hidden="true" />
            )}
            <h2 className="mt-4 text-2xl text-espresso">
              {failed ? t("analysis.status.failed") : t("analysis.processingTitle")}
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-text-secondary">
              {failed ? t("analysis.failedDescription") : t("analysis.processingDescription")}
            </p>
            {failed ? (
              <PrimaryButton type="button" className="mt-6" onClick={onNewUpload}>
                <RotateCcw className="size-4" aria-hidden="true" />
                {t("analysis.retryAsNewUpload")}
              </PrimaryButton>
            ) : null}
          </div>
        </SurfaceCard>
      </div>
    );
  }

  return (
    <div>
      {detailHeader}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.8fr)]">
        <div className="space-y-6">
          <SurfaceCard className="overflow-hidden">
            <div className="aspect-video bg-espresso">
              {data.videoUrl ? (
                <video
                  key={data.videoUrl}
                  controls
                  preload="metadata"
                  className="size-full"
                  aria-label={t("analysis.videoPlayerLabel", { title: data.title })}
                >
                  <source src={data.videoUrl} />
                </video>
              ) : (
                <div className="flex size-full flex-col items-center justify-center px-6 text-center text-white">
                  <FileVideo className="size-12 text-primary-300" aria-hidden="true" />
                  <p className="mt-3 font-semibold">{t("analysis.videoUnavailableTitle")}</p>
                  <p className="mt-1 max-w-md text-sm text-cream-300">
                    {t("analysis.videoUnavailableDescription")}
                  </p>
                </div>
              )}
            </div>
            <div className="border-t border-cream-200 p-5">
              <AnalysisStepper status={data.status} />
            </div>
          </SurfaceCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <SurfaceCard className="border-success-500/25 p-6">
              <div className="mb-4 flex items-center gap-2 text-success-700">
                <Sparkles className="size-5" aria-hidden="true" />
                <h2 className="text-xl">{t("analysis.strengths")}</h2>
              </div>
              {data.aiFeedback.strengths.length > 0 ? (
                <ul className="space-y-3">
                  {data.aiFeedback.strengths.map((strength, index) => (
                    <li key={`${strength}-${index}`} className="flex gap-3 text-sm leading-6 text-espresso">
                      <Check className="mt-1 size-4 shrink-0 text-success-500" aria-hidden="true" />
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-secondary">{t("analysis.noStrengths")}</p>
              )}
            </SurfaceCard>

            <SurfaceCard className="border-primary-300 p-6">
              <div className="mb-4 flex items-center gap-2 text-primary-700">
                <Gauge className="size-5" aria-hidden="true" />
                <h2 className="text-xl">{t("analysis.improvements")}</h2>
              </div>
              {data.aiFeedback.improvements.length > 0 ? (
                <ul className="space-y-3">
                  {data.aiFeedback.improvements.map((improvement, index) => (
                    <li key={`${improvement}-${index}`} className="flex gap-3 text-sm leading-6 text-espresso">
                      <Circle className="mt-1.5 size-3 shrink-0 fill-primary-500 text-primary-500" aria-hidden="true" />
                      <span>{improvement}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-secondary">{t("analysis.noImprovements")}</p>
              )}
            </SurfaceCard>
          </div>
        </div>

        <div className="space-y-6">
          <SurfaceCard className="p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl text-espresso">{t("analysis.performanceMetrics")}</h2>
              {data.score !== null ? (
                <span className="font-serif text-3xl text-primary-600">{Math.round(data.score)}</span>
              ) : null}
            </div>
            {data.metrics.length > 0 ? (
              <div className="mt-4 h-72" aria-label={t("analysis.metricsChartLabel")}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={data.metrics} outerRadius="68%">
                    <PolarGrid stroke="#EAE1D3" />
                    <PolarAngleAxis dataKey="category" tick={{ fill: "#8A7A68", fontSize: 11 }} />
                    <Radar
                      dataKey="score"
                      stroke="#B08A2E"
                      fill="#B08A2E"
                      fillOpacity={0.22}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-5 text-sm text-text-secondary">{t("analysis.noMetrics")}</p>
            )}
          </SurfaceCard>

          <SurfaceCard className="p-6">
            <div className="mb-4 flex items-center gap-2 text-primary-700">
              <MessageSquareText className="size-5" aria-hidden="true" />
              <h2 className="text-xl text-espresso">{t("analysis.trainerComment")}</h2>
            </div>
            {data.trainerComment ? (
              <blockquote>
                <p className="text-sm leading-6 text-espresso">{data.trainerComment.text}</p>
                <footer className="mt-4 border-t border-cream-200 pt-3 text-xs text-text-secondary">
                  {data.trainerComment.author} · {formatDate(data.trainerComment.created_at, locale)}
                </footer>
              </blockquote>
            ) : (
              <p className="text-sm text-text-secondary">{t("analysis.noTrainerComment")}</p>
            )}
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}

function UploadDialog({
  open,
  initialTitle,
  onClose,
  onUploaded,
}: {
  open: boolean;
  initialTitle: string;
  onClose: () => void;
  onUploaded: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { data: horsesData, loading: horsesLoading, error: horsesError } = useHorses();
  const { upload, uploading, progress, error: uploadError } = useUploadVideo();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState(initialTitle);
  const [horseId, setHorseId] = useState("");
  const [discipline, setDiscipline] = useState<Discipline>("Flatwork");
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [validationError, setValidationError] = useState("");
  const horses = horsesData ?? [];

  const chooseFile = (nextFile: File | undefined) => {
    setValidationError("");
    if (!nextFile) return;
    if (!nextFile.type.startsWith("video/")) {
      setValidationError(t("analysis.videoOnlyError"));
      setFile(null);
      return;
    }
    setFile(nextFile);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    chooseFile(event.dataTransfer.files[0]);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError("");
    if (!file) {
      setValidationError(t("analysis.videoRequired"));
      return;
    }
    const id = await upload({
      file,
      title: title.trim(),
      horseId: horseId || null,
      discipline,
      sessionDate,
    });
    if (id) onUploaded(id);
  };

  return (
    <Modal
      open={open}
      title={t("analysis.uploadTitle")}
      description={t("analysis.uploadDescription")}
      onClose={() => {
        if (!uploading) onClose();
      }}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {(validationError || uploadError) ? (
          <ErrorState message={validationError || uploadError || t("analysis.uploadFailed")} />
        ) : null}

        <div>
          <span className={labelClass}>{t("analysis.videoFile")}</span>
          <label
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            className="mt-2 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary-300 bg-primary-50 px-6 py-8 text-center transition-colors hover:border-primary-500"
          >
            <CloudUpload className="size-9 text-primary-600" aria-hidden="true" />
            <span className="mt-3 font-semibold text-espresso">
              {file ? file.name : t("analysis.dropVideo")}
            </span>
            <span className="mt-1 text-xs text-text-secondary">{t("analysis.videoFileHint")}</span>
            <input
              type="file"
              accept="video/*"
              className="sr-only"
              disabled={uploading}
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={labelClass}>{t("analysis.titleLabel")}</span>
            <input
              className={fieldClass}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={120}
              disabled={uploading}
            />
          </label>
          <label>
            <span className={labelClass}>{t("analysis.horseLabel")}</span>
            <select
              className={fieldClass}
              value={horseId}
              onChange={(event) => setHorseId(event.target.value)}
              disabled={uploading || horsesLoading}
            >
              <option value="">{t("analysis.noHorse")}</option>
              {horses.map((horse) => (
                <option key={horse.id} value={horse.id}>{horse.name}</option>
              ))}
            </select>
            {horsesError ? <p className="mt-1 text-xs text-error-700">{horsesError}</p> : null}
          </label>
          <label>
            <span className={labelClass}>{t("analysis.disciplineLabel")}</span>
            <select
              className={fieldClass}
              value={discipline}
              onChange={(event) => setDiscipline(event.target.value as Discipline)}
              disabled={uploading}
            >
              <option value="Flatwork">{t("analysis.discipline.flatwork")}</option>
              <option value="Show jumping">{t("analysis.discipline.showJumping")}</option>
              <option value="Dressage">{t("analysis.discipline.dressage")}</option>
            </select>
          </label>
          <label>
            <span className={labelClass}>{t("analysis.sessionDate")}</span>
            <input
              type="date"
              className={fieldClass}
              value={sessionDate}
              onChange={(event) => setSessionDate(event.target.value)}
              required
              disabled={uploading}
            />
          </label>
        </div>

        {uploading ? <ProgressMeter value={progress} label={t("analysis.uploadProgress")} /> : null}

        <div className="flex flex-wrap justify-end gap-2 border-t border-cream-200 pt-5">
          <OutlineButton type="button" onClick={onClose} disabled={uploading}>
            {t("analysis.cancel")}
          </OutlineButton>
          <PrimaryButton type="submit" disabled={uploading || !title.trim()}>
            {uploading ? (
              <BusyLabel label={t("analysis.uploading")} />
            ) : (
              <>
                <Upload className="size-4" aria-hidden="true" />
                {t("analysis.startUpload")}
              </>
            )}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

export default function AnalysisPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, refetch } = useVideoAnalyses();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [retryTitle, setRetryTitle] = useState("");

  const openUpload = (title = "") => {
    setRetryTitle(title);
    setUploadOpen(true);
  };

  if (id) {
    return (
      <>
        <AnalysisDetail id={id} onNewUpload={() => openUpload(data?.find((item) => item.id === id)?.title ?? "")} />
        <UploadDialog
          key={`${uploadOpen}-${retryTitle}`}
          open={uploadOpen}
          initialTitle={retryTitle}
          onClose={() => setUploadOpen(false)}
          onUploaded={(analysisId) => {
            setUploadOpen(false);
            refetch();
            navigate(`/analysis/${analysisId}`);
          }}
        />
      </>
    );
  }

  if (loading) return <PageSkeleton cards={6} />;

  return (
    <div>
      <PageHeader
        eyebrow={t("analysis.eyebrow")}
        title={t("analysis.pageTitle")}
        description={t("analysis.pageDescription")}
        actions={
          <PrimaryButton type="button" onClick={() => openUpload()}>
            <Upload className="size-4" aria-hidden="true" />
            {t("analysis.uploadVideo")}
          </PrimaryButton>
        }
      />

      {error ? (
        <ErrorState message={error} retryLabel={t("analysis.tryAgain")} onRetry={refetch} />
      ) : (data ?? []).length === 0 ? (
        <SurfaceCard>
          <EmptyState
            icon={Video}
            title={t("analysis.emptyTitle")}
            description={t("analysis.emptyDescription")}
            action={
              <PrimaryButton type="button" onClick={() => openUpload()}>
                <Upload className="size-4" aria-hidden="true" />
                {t("analysis.uploadFirstVideo")}
              </PrimaryButton>
            }
          />
        </SurfaceCard>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {(data ?? []).map((analysis) => (
            <AnalysisCard
              key={analysis.id}
              analysis={analysis}
              onOpen={() => navigate(`/analysis/${analysis.id}`)}
              onRetry={() => openUpload(analysis.title)}
            />
          ))}
        </div>
      )}

      <UploadDialog
        key={`${uploadOpen}-${retryTitle}`}
        open={uploadOpen}
        initialTitle={retryTitle}
        onClose={() => setUploadOpen(false)}
        onUploaded={(analysisId) => {
          setUploadOpen(false);
          refetch();
          navigate(`/analysis/${analysisId}`);
        }}
      />
    </div>
  );
}
