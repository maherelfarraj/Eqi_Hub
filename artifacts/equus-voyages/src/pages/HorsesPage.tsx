import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  Download,
  FileText,
  Heart,
  HeartPulse,
  ImagePlus,
  NotebookText,
  Plus,
  ShieldCheck,
  Stethoscope,
  Upload,
  Users,
  Video,
} from "lucide-react";
import {
  BusyLabel,
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
import { useHorse, useHorses, useUpsertHorse } from "@/hooks/use-horses";
import type { Horse, HorseStatus, UpsertHorseInput } from "@/hooks/types";

type HorseTab = "overview" | "training" | "health" | "analyses" | "documents";

function HorseCard({ horse, onOpen }: { horse: Horse; onOpen: () => void }) {
  const { t } = useTranslation();
  const age = horse.birthYear ? Math.max(0, new Date().getFullYear() - horse.birthYear) : null;

  return (
    <SurfaceCard className="overflow-hidden">
      <button type="button" onClick={onOpen} className="block w-full text-start">
        <div className="aspect-[4/3] bg-cream-100">
          {horse.photoUrl ? (
            <img src={horse.photoUrl} alt={horse.name} className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-primary-500">
              <Heart className="size-14" aria-hidden="true" />
            </div>
          )}
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-2xl text-espresso">{horse.name}</h2>
            <StatusBadge status={horse.status} label={t(`horses.status.${horse.status}`)} />
          </div>
          <p className="mt-2 text-sm text-text-secondary">
            {[horse.breed, age === null ? null : t("horses.ageYears", { count: age })]
              .filter(Boolean)
              .join(" · ") || t("horses.detailsPending")}
          </p>
          <div className="mt-4 flex items-start gap-2 border-t border-cream-200 pt-4 text-xs text-text-secondary">
            <Users className="mt-0.5 size-4 shrink-0 text-primary-600" aria-hidden="true" />
            <span>
              <strong className="text-espresso">{t("horses.riddenBy")}:</strong>{" "}
              {horse.riderNames.length > 0 ? horse.riderNames.join(", ") : t("horses.noRiders")}
            </span>
          </div>
        </div>
      </button>
    </SurfaceCard>
  );
}

function AddHorseDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { upsert, saving, error } = useUpsertHorse();
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [color, setColor] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [status, setStatus] = useState<HorseStatus>("active");
  const [photo, setPhoto] = useState<File | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input: UpsertHorseInput = {
      name: name.trim(),
      status,
      photo,
    };
    if (breed.trim()) input.breed = breed.trim();
    if (birthYear) input.birthYear = Number(birthYear);
    if (color.trim()) input.color = color.trim();
    if (heightCm) input.heightCm = Number(heightCm);

    if (await upsert(input)) onSaved();
  };

  return (
    <Modal
      open={open}
      title={t("horses.addTitle")}
      description={t("horses.addDescription")}
      onClose={() => {
        if (!saving) onClose();
      }}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error ? <ErrorState message={error} /> : null}

        <label className="block">
          <span className={labelClass}>{t("horses.photo")}</span>
          <span className="mt-2 flex min-h-28 cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-primary-300 bg-primary-50 p-5">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-primary-600">
              <ImagePlus className="size-6" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold text-espresso">
                {photo ? photo.name : t("horses.choosePhoto")}
              </span>
              <span className="mt-1 block text-xs text-text-secondary">{t("horses.photoHint")}</span>
            </span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={saving}
              onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
            />
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={labelClass}>{t("horses.name")}</span>
            <input
              className={fieldClass}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={100}
              disabled={saving}
            />
          </label>
          <label>
            <span className={labelClass}>{t("horses.breed")}</span>
            <input className={fieldClass} value={breed} onChange={(event) => setBreed(event.target.value)} disabled={saving} />
          </label>
          <label>
            <span className={labelClass}>{t("horses.color")}</span>
            <input className={fieldClass} value={color} onChange={(event) => setColor(event.target.value)} disabled={saving} />
          </label>
          <label>
            <span className={labelClass}>{t("horses.birthYear")}</span>
            <input
              type="number"
              min="1980"
              max={new Date().getFullYear()}
              className={fieldClass}
              value={birthYear}
              onChange={(event) => setBirthYear(event.target.value)}
              disabled={saving}
            />
          </label>
          <label>
            <span className={labelClass}>{t("horses.heightCm")}</span>
            <input
              type="number"
              min="50"
              max="250"
              step="0.1"
              className={fieldClass}
              value={heightCm}
              onChange={(event) => setHeightCm(event.target.value)}
              disabled={saving}
            />
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>{t("horses.statusLabel")}</span>
            <select className={fieldClass} value={status} onChange={(event) => setStatus(event.target.value as HorseStatus)} disabled={saving}>
              <option value="active">{t("horses.status.active")}</option>
              <option value="resting">{t("horses.status.resting")}</option>
              <option value="retired">{t("horses.status.retired")}</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-cream-200 pt-5">
          <OutlineButton type="button" onClick={onClose} disabled={saving}>
            {t("horses.cancel")}
          </OutlineButton>
          <PrimaryButton type="submit" disabled={saving || !name.trim()}>
            {saving ? (
              <BusyLabel label={t("horses.saving")} />
            ) : (
              <>
                <Upload className="size-4" aria-hidden="true" />
                {t("horses.saveHorse")}
              </>
            )}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function HorseDetailPage({ id }: { id: string }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { data, loading, error } = useHorse(id);
  const [tab, setTab] = useState<HorseTab>("overview");

  if (loading) return <PageSkeleton cards={4} />;
  if (error) return <ErrorState message={error} />;
  if (!data) {
    return (
      <SurfaceCard>
        <EmptyState
          icon={Heart}
          title={t("horses.notFoundTitle")}
          description={t("horses.notFoundDescription")}
          action={<OutlineButton type="button" onClick={() => navigate("/horses")}>{t("horses.backToHorses")}</OutlineButton>}
        />
      </SurfaceCard>
    );
  }

  const tabs: Array<{ id: HorseTab; label: string }> = [
    { id: "overview", label: t("horses.tabs.overview") },
    { id: "training", label: t("horses.tabs.training") },
    { id: "health", label: t("horses.tabs.health") },
    { id: "analyses", label: t("horses.tabs.analyses") },
    { id: "documents", label: t("horses.tabs.documents") },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={t("horses.detailEyebrow")}
        title={data.name}
        description={[data.breed, data.color].filter(Boolean).join(" · ") || t("horses.detailsPending")}
        actions={
          <OutlineButton type="button" onClick={() => navigate("/horses")}>
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
            {t("horses.backToHorses")}
          </OutlineButton>
        }
      />

      <SurfaceCard className="mb-6 overflow-hidden">
        <div className="grid md:grid-cols-[18rem_1fr]">
          <div className="aspect-[4/3] bg-cream-100 md:aspect-auto md:min-h-64">
            {data.photoUrl ? (
              <img src={data.photoUrl} alt={data.name} className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-primary-500"><Heart className="size-16" aria-hidden="true" /></div>
            )}
          </div>
          <div className="grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-3">
            <div><p className={labelClass}>{t("horses.statusLabel")}</p><div className="mt-2"><StatusBadge status={data.status} label={t(`horses.status.${data.status}`)} /></div></div>
            <div><p className={labelClass}>{t("horses.birthYear")}</p><p className="mt-2 font-semibold text-espresso">{data.birthYear ?? "—"}</p></div>
            <div><p className={labelClass}>{t("horses.heightCm")}</p><p className="mt-2 font-semibold text-espresso">{data.heightCm ? t("horses.heightValue", { value: data.heightCm }) : "—"}</p></div>
            <div className="sm:col-span-2 lg:col-span-3"><p className={labelClass}>{t("horses.riddenBy")}</p><p className="mt-2 text-sm text-espresso">{data.riderNames.length > 0 ? data.riderNames.join(", ") : t("horses.noRiders")}</p></div>
          </div>
        </div>
      </SurfaceCard>

      <div className="mb-5 overflow-x-auto border-b border-cream-200" role="tablist" aria-label={t("horses.detailSections")}>
        <div className="flex min-w-max gap-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`border-b-2 px-4 py-3 text-sm font-bold transition-colors ${tab === item.id ? "border-primary-500 text-primary-700" : "border-transparent text-text-secondary hover:text-espresso"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" ? (
        <div className="grid gap-5 md:grid-cols-3">
          <SurfaceCard className="p-6"><ShieldCheck className="size-6 text-primary-600" aria-hidden="true" /><p className={`${labelClass} mt-4`}>{t("horses.breed")}</p><p className="mt-2 text-lg font-semibold text-espresso">{data.breed ?? "—"}</p></SurfaceCard>
          <SurfaceCard className="p-6"><Activity className="size-6 text-primary-600" aria-hidden="true" /><p className={`${labelClass} mt-4`}>{t("horses.color")}</p><p className="mt-2 text-lg font-semibold text-espresso">{data.color ?? "—"}</p></SurfaceCard>
          <SurfaceCard className="p-6"><HeartPulse className="size-6 text-primary-600" aria-hidden="true" /><p className={`${labelClass} mt-4`}>{t("horses.statusLabel")}</p><p className="mt-2 text-lg font-semibold text-espresso">{t(`horses.status.${data.status}`)}</p></SurfaceCard>
        </div>
      ) : null}

      {tab === "training" ? (
        <SurfaceCard>
          {data.trainingLog.length === 0 ? (
            <EmptyState compact icon={NotebookText} title={t("horses.trainingEmptyTitle")} description={t("horses.trainingEmptyDescription")} />
          ) : (
            <ol className="divide-y divide-cream-200 p-6">
              {data.trainingLog.map((entry) => (
                <li key={entry.id} className="relative ps-8 py-4 first:pt-0 last:pb-0">
                  <span className="absolute start-0 top-5 size-3 rounded-full bg-primary-500 ring-4 ring-primary-50" aria-hidden="true" />
                  <p className="text-sm leading-6 text-espresso">{entry.note}</p>
                  <p className="mt-2 text-xs text-text-secondary">{formatDate(entry.date, locale)} · {entry.author}</p>
                </li>
              ))}
            </ol>
          )}
        </SurfaceCard>
      ) : null}

      {tab === "health" ? (
        <SurfaceCard className="overflow-hidden">
          {data.healthRecords.length === 0 ? (
            <EmptyState compact icon={Stethoscope} title={t("horses.healthEmptyTitle")} description={t("horses.healthEmptyDescription")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[38rem] text-start text-sm">
                <thead className="bg-cream-50 text-xs uppercase tracking-[0.1em] text-text-secondary"><tr><th className="px-5 py-3 text-start">{t("horses.date")}</th><th className="px-5 py-3 text-start">{t("horses.recordType")}</th><th className="px-5 py-3 text-start">{t("horses.summary")}</th></tr></thead>
                <tbody className="divide-y divide-cream-200">{data.healthRecords.map((record) => <tr key={record.id}><td className="px-5 py-4 text-text-secondary">{formatDate(record.date, locale)}</td><td className="px-5 py-4 font-semibold text-espresso">{record.type}</td><td className="px-5 py-4 text-text-secondary">{record.summary ?? "—"}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </SurfaceCard>
      ) : null}

      {tab === "analyses" ? (
        data.analyses.length === 0 ? (
          <SurfaceCard><EmptyState compact icon={Video} title={t("horses.analysesEmptyTitle")} description={t("horses.analysesEmptyDescription")} /></SurfaceCard>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.analyses.map((analysis) => (
              <SurfaceCard key={analysis.id} className="p-5">
                <div className="flex items-start justify-between gap-3"><h3 className="text-lg text-espresso">{analysis.title}</h3><StatusBadge status={analysis.status} label={t(`analysis.status.${analysis.status}`)} /></div>
                <p className="mt-2 text-sm text-text-secondary">{analysis.discipline} · {formatDate(analysis.createdAt, locale)}</p>
                <OutlineButton type="button" className="mt-4 w-full" onClick={() => navigate(`/analysis/${analysis.id}`)}>{t("horses.viewAnalysis")}</OutlineButton>
              </SurfaceCard>
            ))}
          </div>
        )
      ) : null}

      {tab === "documents" ? (
        <SurfaceCard>
          {data.documents.length === 0 ? (
            <EmptyState compact icon={FileText} title={t("horses.documentsEmptyTitle")} description={t("horses.documentsEmptyDescription")} />
          ) : (
            <ul className="divide-y divide-cream-200">{data.documents.map((document) => <li key={document.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"><div className="flex min-w-0 items-center gap-3"><FileText className="size-5 shrink-0 text-primary-600" aria-hidden="true" /><span className="truncate font-semibold text-espresso">{document.name}</span></div><OutlineButton type="button" onClick={() => window.open(document.url, "_blank", "noopener,noreferrer")}><Download className="size-4" aria-hidden="true" />{t("horses.download")}</OutlineButton></li>)}</ul>
          )}
        </SurfaceCard>
      ) : null}
    </div>
  );
}

export default function HorsesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, refetch } = useHorses();
  const [addOpen, setAddOpen] = useState(false);

  if (id) return <HorseDetailPage id={id} />;
  if (loading) return <PageSkeleton cards={6} />;

  return (
    <div>
      <PageHeader
        eyebrow={t("horses.eyebrow")}
        title={t("horses.pageTitle")}
        description={t("horses.pageDescription")}
        actions={<PrimaryButton type="button" onClick={() => setAddOpen(true)}><Plus className="size-4" aria-hidden="true" />{t("horses.addHorse")}</PrimaryButton>}
      />

      {error ? (
        <ErrorState message={error} retryLabel={t("horses.tryAgain")} onRetry={refetch} />
      ) : (data ?? []).length === 0 ? (
        <SurfaceCard>
          <EmptyState icon={Heart} title={t("horses.emptyTitle")} description={t("horses.emptyDescription")} action={<PrimaryButton type="button" onClick={() => setAddOpen(true)}><Plus className="size-4" aria-hidden="true" />{t("horses.addFirstHorse")}</PrimaryButton>} />
        </SurfaceCard>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {(data ?? []).map((horse) => <HorseCard key={horse.id} horse={horse} onOpen={() => navigate(`/horses/${horse.id}`)} />)}
          <button type="button" onClick={() => setAddOpen(true)} className="flex min-h-72 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary-300 bg-primary-50/50 p-8 text-center text-primary-700 transition hover:border-primary-500 hover:bg-primary-50"><Plus className="size-9" aria-hidden="true" /><span className="mt-3 font-serif text-xl">{t("horses.addHorse")}</span><span className="mt-2 text-sm text-text-secondary">{t("horses.addCardDescription")}</span></button>
        </div>
      )}

      <AddHorseDialog
        key={String(addOpen)}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => {
          setAddOpen(false);
          refetch();
        }}
      />
    </div>
  );
}
