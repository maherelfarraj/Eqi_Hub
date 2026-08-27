import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Award,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Flag,
  Route,
  Trophy,
  Truck,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  EmptyState,
  ErrorState,
  formatCurrency,
  formatDate,
  PageHeader,
  PageSkeleton,
  PrimaryButton,
  StatusBadge,
  SurfaceCard,
  fieldClass,
  labelClass,
} from "@/components/EquiVistaUI";
import { useAuth } from "@/contexts/AuthContext";
import {
  type CompetitionEntry,
  type CompetitionWorkspace,
  useCompetitionDevelopmentAccess,
  useCompetitionDevelopmentActions,
  useCompetitionDevelopmentCoaches,
  useCompetitionDevelopmentRiders,
  useCompetitionDevelopmentWorkspace,
} from "@/hooks/use-competition-development";
import { useHorses } from "@/hooks/use-horses";

const today = () => new Date().toISOString().slice(0, 10);
const currentYear = new Date().getFullYear();

function Section({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: typeof Trophy;
  children: ReactNode;
}) {
  return (
    <SurfaceCard className="overflow-hidden transition-all duration-300 hover:border-primary-200 hover:shadow-md">
      <div className="border-b border-cream-200 bg-cream-50/50 px-5 py-4">
        <div className="flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700 shadow-inner">
            <Icon className="size-5" />
          </span>
          <div>
            <h2 className="font-serif text-2xl text-espresso">{title}</h2>
            <p className="mt-1 text-sm text-text-secondary">{description}</p>
          </div>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </SurfaceCard>
  );
}

function SubmitButton({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  return (
    <PrimaryButton type="submit" disabled={disabled} className="mt-3">
      {children}
    </PrimaryButton>
  );
}

function WorkspaceSections({
  workspace,
  riderId,
  coachId,
  onRefresh,
}: {
  workspace: CompetitionWorkspace;
  riderId: string;
  coachId: string;
  onRefresh: () => void;
}) {
  const { t, i18n } = useTranslation();
  const horses = useHorses();
  const actions = useCompetitionDevelopmentActions(onRefresh);
  const [message, setMessage] = useState<string | null>(null);

  const locale = (i18n.resolvedLanguage ?? i18n.language) === "ar" ? "ar-JO" : "en-US";
  const isStaff = workspace.access.canManage;
  const activePlan = workspace.annualPlans.find((plan) => plan.status !== "archived")
    ?? workspace.annualPlans[0];
  const entriesByEvent = useMemo(
    () =>
      workspace.entries.reduce<Record<string, CompetitionEntry[]>>((entries, entry) => {
        (entries[entry.competition_id] ??= []).push(entry);
        return entries;
      }, {}),
    [workspace.entries],
  );

  const save = async (fn: () => Promise<unknown>, success: string) => {
    setMessage(null);
    try {
      await fn();
      setMessage(success);
    } catch {
      // The hook exposes a server-authored failure message below.
    }
  };

  return (
    <div className="space-y-6">
      {message ? (
        <div className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-800" role="status">
          {message}
        </div>
      ) : null}
      {actions.error ? <ErrorState message={actions.error} /> : null}

      <Section
        title={t("competitionDevelopment.annualPlan.title")}
        description={t("competitionDevelopment.annualPlan.description")}
        icon={Flag}
      >
        {activePlan ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-serif text-xl text-espresso">
                  {activePlan.plan_year} · {activePlan.title}
                </h3>
                <StatusBadge status={activePlan.status} />
                {activePlan.coach_signed_off ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-success-700">
                    <CheckCircle2 className="size-4" /> {t("competitionDevelopment.signedOff")}
                  </span>
                ) : null}
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-cream-200 bg-white p-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">
                    English
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-espresso">{activePlan.goals_en}</p>
                </div>
                <div className="rounded-xl border border-cream-200 bg-white p-4" dir="rtl">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">
                    العربية
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-espresso">{activePlan.goals_ar}</p>
                </div>
              </div>
            </div>
            {isStaff ? (
              <form
                className="grid gap-2 rounded-xl border border-primary-200 bg-primary-50 p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void save(
                    () =>
                      actions.savePlan({
                        p_rider_id: riderId,
                        p_plan_year: activePlan.plan_year,
                        p_title: activePlan.title,
                        p_goals_en: activePlan.goals_en,
                        p_goals_ar: activePlan.goals_ar,
                        p_status: activePlan.status,
                        p_coach_id: activePlan.coach_id,
                        p_plan_id: activePlan.id,
                        p_coach_signed_off: true,
                        p_portal_visible: true,
                      }),
                    t("competitionDevelopment.messages.planPublished"),
                  );
                }}
              >
                <p className="text-sm font-bold text-primary-800">
                  {t("competitionDevelopment.annualPlan.portalApproval")}
                </p>
                <SubmitButton disabled={actions.saving}>
                  {t("competitionDevelopment.annualPlan.publish")}
                </SubmitButton>
              </form>
            ) : null}
          </div>
        ) : isStaff ? (
          <form
            className="grid gap-4 rounded-xl border border-cream-200 bg-cream-50 p-4 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void save(
                () => {
                  if (!coachId) return Promise.reject(new Error(t("competitionDevelopment.messages.coachRequired")));
                  return actions.savePlan({
                    p_rider_id: riderId,
                    p_plan_year: Number(form.get("planYear")),
                    p_title: String(form.get("planTitle")),
                    p_goals_en: String(form.get("goalsEn")),
                    p_goals_ar: String(form.get("goalsAr")),
                    p_status: "active",
                    p_coach_id: coachId,
                    p_coach_signed_off: true,
                    p_portal_visible: Boolean(form.get("portalVisible")),
                  });
                },
                t("competitionDevelopment.messages.planSaved"),
              );
            }}
          >
            <div>
              <label className={labelClass}>{t("competitionDevelopment.annualPlan.year")}</label>
              <input className={fieldClass} name="planYear" type="number" defaultValue={currentYear} min="2000" max="2100" required />
            </div>
            <div>
              <label className={labelClass}>{t("competitionDevelopment.annualPlan.name")}</label>
              <input className={fieldClass} name="planTitle" minLength={3} required />
            </div>
            <div>
              <label className={labelClass}>{t("competitionDevelopment.annualPlan.goalsEnglish")}</label>
              <textarea className={fieldClass} name="goalsEn" rows={4} minLength={10} required />
            </div>
            <div dir="rtl">
              <label className={labelClass}>{t("competitionDevelopment.annualPlan.goalsArabic")}</label>
              <textarea className={fieldClass} name="goalsAr" rows={4} minLength={10} required />
            </div>
            <label className="col-span-full flex items-center gap-2 text-sm text-espresso">
              <input name="portalVisible" type="checkbox" /> {t("competitionDevelopment.annualPlan.portalVisible")}
            </label>
            {!coachId ? <p role="alert" className="col-span-full text-sm text-warning-700">{t("competitionDevelopment.messages.coachRequired")}</p> : null}
            <div className="col-span-full">
              <SubmitButton disabled={actions.saving || !coachId}>{t("competitionDevelopment.annualPlan.create")}</SubmitButton>
            </div>
          </form>
        ) : (
          <EmptyState
            icon={Flag}
            title={t("competitionDevelopment.annualPlan.emptyTitle")}
            description={t("competitionDevelopment.annualPlan.emptyDescription")}
          />
        )}
      </Section>

      <Section
        title={t("competitionDevelopment.calendar.title")}
        description={t("competitionDevelopment.calendar.description")}
        icon={CalendarDays}
      >
        {isStaff ? (
          <form
            className="mb-5 grid gap-3 rounded-xl border border-cream-200 bg-cream-50 p-4 md:grid-cols-2 xl:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void save(
                () =>
                  actions.saveEvent({
                    p_name: String(form.get("eventName")),
                    p_discipline: String(form.get("discipline")),
                    p_venue: String(form.get("venue")),
                    p_starts_on: String(form.get("startsOn")),
                    p_ends_on: String(form.get("endsOn")),
                    p_entry_deadline: String(form.get("deadline")) || null,
                    p_status: "planned",
                    p_portal_visible: Boolean(form.get("eventPortalVisible")),
                  }),
                t("competitionDevelopment.messages.competitionSaved"),
              );
            }}
          >
            <input className={fieldClass} name="eventName" placeholder={t("competitionDevelopment.calendar.name")} minLength={3} required />
            <input className={fieldClass} name="venue" placeholder={t("competitionDevelopment.calendar.venue")} minLength={2} required />
            <select className={fieldClass} name="discipline" defaultValue="show_jumping">
              <option value="show_jumping">{t("competitionDevelopment.disciplines.showJumping")}</option>
              <option value="flatwork">{t("competitionDevelopment.disciplines.flatwork")}</option>
              <option value="dressage">{t("competitionDevelopment.disciplines.dressage")}</option>
              <option value="eventing">{t("competitionDevelopment.disciplines.eventing")}</option>
              <option value="other">{t("competitionDevelopment.disciplines.other")}</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input className={fieldClass} name="startsOn" type="date" defaultValue={today()} required aria-label={t("competitionDevelopment.calendar.startsOn")} />
              <input className={fieldClass} name="endsOn" type="date" defaultValue={today()} required aria-label={t("competitionDevelopment.calendar.endsOn")} />
            </div>
            <input className={fieldClass} name="deadline" type="date" aria-label={t("competitionDevelopment.calendar.deadline")} />
            <label className="flex items-center gap-2 text-sm text-espresso">
              <input name="eventPortalVisible" type="checkbox" /> {t("competitionDevelopment.calendar.portalVisible")}
            </label>
            <SubmitButton disabled={actions.saving}>{t("competitionDevelopment.calendar.add")}</SubmitButton>
          </form>
        ) : null}
        {workspace.competitions.length ? (
          <div className="space-y-3">
            {workspace.competitions.map((competition) => (
              <div key={competition.id} className="rounded-xl border border-cream-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-xl text-espresso">{competition.name}</h3>
                    <p className="mt-1 text-sm text-text-secondary">
                      {competition.venue} · {formatDate(competition.starts_on, locale)} — {formatDate(competition.ends_on, locale)}
                    </p>
                  </div>
                  <StatusBadge status={competition.status} />
                </div>
                <EntryList
                  competitionId={competition.id}
                  entries={entriesByEvent[competition.id] ?? []}
                  workspace={workspace}
                  canManage={isStaff}
                  riderId={riderId}
                  coachId={coachId}
                  horses={horses.data ?? []}
                  actions={actions}
                  onSaved={onRefresh}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">{t("competitionDevelopment.calendar.empty")}</p>
        )}
      </Section>

      <Section
        title={t("competitionDevelopment.readiness.title")}
        description={t("competitionDevelopment.readiness.description")}
        icon={ClipboardCheck}
      >
        {isStaff ? (
          <form
            className="mb-5 grid gap-3 rounded-xl border border-cream-200 bg-cream-50 p-4 md:grid-cols-[1fr_2fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void save(
                () =>
                  actions.saveReadiness({
                    p_rider_id: riderId,
                    p_plan_id: activePlan?.id ?? null,
                    p_horse_id: null,
                    p_evidence_type: "coach_observation",
                    p_source_id: null,
                    p_evidence_note: String(form.get("readinessNote")),
                    p_portal_visible: Boolean(form.get("readinessPortalVisible")),
                  }),
                t("competitionDevelopment.messages.readinessSaved"),
              );
            }}
          >
            <select className={fieldClass} disabled>
              <option>{t("competitionDevelopment.readiness.coachObservation")}</option>
            </select>
            <input className={fieldClass} name="readinessNote" minLength={5} placeholder={t("competitionDevelopment.readiness.note")} required />
            <div className="flex items-center gap-3">
              <label className="text-sm text-espresso"><input name="readinessPortalVisible" type="checkbox" /> {t("competitionDevelopment.calendar.portalVisible")}</label>
              <SubmitButton disabled={actions.saving}>{t("competitionDevelopment.readiness.add")}</SubmitButton>
            </div>
          </form>
        ) : null}
        <div className="space-y-2">
          {workspace.readiness.map((evidence) => (
            <div key={evidence.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cream-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-espresso">{evidence.evidence_note}</p>
                <p className="mt-1 text-xs text-text-secondary">{evidence.evidence_type.replaceAll("_", " ")}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={evidence.status} />
                {isStaff && evidence.status === "draft" ? (
                  <PrimaryButton
                    onClick={() => void save(() => actions.confirmReadiness(evidence.id), t("competitionDevelopment.messages.readinessConfirmed"))}
                    disabled={actions.saving}
                  >
                    {t("competitionDevelopment.readiness.signOff")}
                  </PrimaryButton>
                ) : null}
              </div>
            </div>
          ))}
          {!workspace.readiness.length ? <p className="text-sm text-text-secondary">{t("competitionDevelopment.readiness.empty")}</p> : null}
        </div>
      </Section>

      <Section
        title={t("competitionDevelopment.jumping.title")}
        description={t("competitionDevelopment.jumping.description")}
        icon={Award}
      >
        {isStaff ? (
          <form
            className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-cream-200 bg-cream-50 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void save(
                () =>
                  actions.saveLadderProgress({
                    p_rider_id: riderId,
                    p_plan_id: activePlan?.id ?? null,
                    p_level: Number(form.get("level")),
                    p_status: String(form.get("ladderStatus")),
                    p_evidence_id: String(form.get("evidenceId")) || null,
                    p_portal_visible: Boolean(form.get("ladderPortalVisible")),
                  }),
                t("competitionDevelopment.messages.ladderSaved"),
              );
            }}
          >
            <div>
              <label className={labelClass}>{t("competitionDevelopment.jumping.level")}</label>
              <select className={fieldClass} name="level">
                {workspace.ladderCatalog.map((level) => <option key={level.level} value={level.level}>L{level.level} · {locale.startsWith("ar") ? level.name_ar : level.name_en}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("competitionDevelopment.jumping.status")}</label>
              <select className={fieldClass} name="ladderStatus" defaultValue="in_progress">
                <option value="planned">{t("competitionDevelopment.statuses.planned")}</option>
                <option value="in_progress">{t("competitionDevelopment.statuses.inProgress")}</option>
                <option value="coach_confirmed">{t("competitionDevelopment.statuses.coachConfirmed")}</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("competitionDevelopment.jumping.evidence")}</label>
              <select className={fieldClass} name="evidenceId" defaultValue="">
                <option value="">{t("competitionDevelopment.jumping.none")}</option>
                {workspace.readiness.filter((item) => item.status === "signed_off").map((item) => <option key={item.id} value={item.id}>{item.evidence_note}</option>)}
              </select>
            </div>
            <label className="mb-3 text-sm text-espresso"><input name="ladderPortalVisible" type="checkbox" /> {t("competitionDevelopment.calendar.portalVisible")}</label>
            <SubmitButton disabled={actions.saving}>{t("competitionDevelopment.jumping.save")}</SubmitButton>
          </form>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          {workspace.ladderCatalog.map((level) => {
            const progress = workspace.ladder.find((item) => item.level === level.level);
            return (
              <div key={level.level} className={`rounded-xl border p-4 ${progress?.status === "coach_confirmed" ? "border-success-300 bg-success-50" : "border-cream-200 bg-white"}`}>
                <p className="font-serif text-lg text-espresso">L{level.level}</p>
                <p className="mt-1 text-sm font-semibold text-espresso">{locale.startsWith("ar") ? level.name_ar : level.name_en}</p>
                <p className="mt-2 text-xs leading-5 text-text-secondary">{locale.startsWith("ar") ? level.criteria_ar : level.criteria_en}</p>
                {progress ? <div className="mt-3"><StatusBadge status={progress.status} /></div> : null}
              </div>
            );
          })}
        </div>
      </Section>

      <Section
        title={t("competitionDevelopment.reports.title")}
        description={t("competitionDevelopment.reports.description")}
        icon={FileText}
      >
        {isStaff && activePlan ? (
          <form
            className="mb-5 grid gap-4 rounded-xl border border-cream-200 bg-cream-50 p-4 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void save(
                () =>
                  actions.saveReport({
                    p_rider_id: riderId,
                    p_plan_id: activePlan.id,
                    p_title_en: String(form.get("titleEn")),
                    p_title_ar: String(form.get("titleAr")),
                    p_content_en: String(form.get("contentEn")),
                    p_content_ar: String(form.get("contentAr")),
                  }),
                t("competitionDevelopment.messages.reportSaved"),
              );
            }}
          >
            <div>
              <label className={labelClass}>Title (English)</label>
              <input className={fieldClass} name="titleEn" minLength={3} required />
              <label className={`${labelClass} mt-3`}>Content (English)</label>
              <textarea className={fieldClass} name="contentEn" rows={5} minLength={20} required />
            </div>
            <div dir="rtl">
              <label className={labelClass}>العنوان</label>
              <input className={fieldClass} name="titleAr" minLength={3} required />
              <label className={`${labelClass} mt-3`}>المحتوى</label>
              <textarea className={fieldClass} name="contentAr" rows={5} minLength={20} required />
            </div>
            <div className="col-span-full"><SubmitButton disabled={actions.saving}>{t("competitionDevelopment.reports.draft")}</SubmitButton></div>
          </form>
        ) : null}
        <div className="space-y-3">
          {workspace.reports.map((report) => (
            <div key={report.id} className="rounded-xl border border-cream-200 p-4 transition-colors hover:bg-cream-50/50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-serif text-xl text-espresso">{locale.startsWith("ar") ? report.title_ar : report.title_en}</h3>
                <div className="flex items-center gap-2">
                  <StatusBadge status={report.status} />
                  {isStaff && report.status === "draft" ? <PrimaryButton onClick={() => void save(() => actions.approveReport(report.id), t("competitionDevelopment.messages.reportApproved"))}>{t("competitionDevelopment.reports.approve")}</PrimaryButton> : null}
                  {isStaff && report.status === "approved" ? <PrimaryButton onClick={() => void save(() => actions.publishReport(report.id), t("competitionDevelopment.messages.reportPublished"))}>{t("competitionDevelopment.reports.publish")}</PrimaryButton> : null}
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <p className="whitespace-pre-wrap text-sm leading-6 text-espresso">{report.content_en}</p>
                <p dir="rtl" className="whitespace-pre-wrap text-sm leading-6 text-espresso">{report.content_ar}</p>
              </div>
            </div>
          ))}
          {!workspace.reports.length ? <p className="text-sm text-text-secondary">{t("competitionDevelopment.reports.empty")}</p> : null}
        </div>
      </Section>
    </div>
  );
}

function EntryList({
  competitionId,
  entries,
  workspace,
  canManage,
  riderId,
  coachId,
  horses,
  actions,
  onSaved,
}: {
  competitionId: string;
  entries: CompetitionEntry[];
  workspace: CompetitionWorkspace;
  canManage: boolean;
  riderId: string;
  coachId: string;
  horses: { id: string; name: string }[];
  actions: ReturnType<typeof useCompetitionDevelopmentActions>;
  onSaved: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [selectedEntry, setSelectedEntry] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const locale = (i18n.resolvedLanguage ?? i18n.language) === "ar" ? "ar-JO" : "en-US";
  const selected = entries.find((entry) => entry.id === selectedEntry) ?? entries[0];

  const submit = async (callback: () => Promise<unknown>) => {
    setError(null);
    try {
      await callback();
      onSaved();
    } catch (cause: any) {
      setError(cause?.message ?? "Could not save competition data");
    }
  };

  return (
    <div className="mt-4 space-y-4 border-t border-cream-100 pt-4">
      {entries.map((entry) => {
        const result = workspace.results.find((item) => item.entry_id === entry.id);
        const logistics = workspace.logistics.find((item) => item.entry_id === entry.id);
        return (
          <div key={entry.id} className="rounded-lg bg-cream-50 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-espresso">{entry.class_name} · {entry.target_family} L{entry.target_level}</p>
              <StatusBadge status={entry.status} />
            </div>
            {result ? <p className="mt-2 text-text-secondary">{result.outcome}{result.placing ? ` · #${result.placing}` : ""}{result.score !== null ? ` · ${result.score}` : ""}</p> : null}
            {logistics ? <p className="mt-2 flex items-center gap-1 text-text-secondary"><Truck className="size-3.5" /> {logistics.transport_provider ?? "Transport"}{logistics.cost_cents !== undefined ? ` · ${formatCurrency((logistics.cost_cents ?? 0) / 100, logistics.currency ?? "USD", locale)}` : ""}</p> : null}
          </div>
        );
      })}
      {canManage ? (
        <>
          <form
            className="grid gap-2 rounded-lg border border-cream-200 bg-white p-3 md:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              if (!coachId) {
                setError(t("competitionDevelopment.messages.coachRequired"));
                return;
              }
              void submit(() => actions.saveEntry({
                p_rider_id: riderId,
                p_competition_id: competitionId,
                p_plan_id: String(form.get("planId")) || null,
                p_coach_id: coachId,
                p_horse_id: String(form.get("horseId")) || null,
                p_class_name: String(form.get("className")),
                p_target_family: String(form.get("family")),
                p_target_level: Number(form.get("level")),
                p_status: "approved",
                p_coach_signed_off: true,
                p_portal_visible: Boolean(form.get("portalVisible")),
              }));
            }}
          >
            <select className={fieldClass} name="planId" defaultValue={workspace.annualPlans[0]?.id ?? ""}>
              <option value="">{t("competitionDevelopment.entries.noPlan")}</option>
              {workspace.annualPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.plan_year} · {plan.title}</option>)}
            </select>
            <select className={fieldClass} name="horseId" defaultValue="">
              <option value="">{t("competitionDevelopment.entries.noHorse")}</option>
              {horses.map((horse) => <option key={horse.id} value={horse.id}>{horse.name}</option>)}
            </select>
            <input className={fieldClass} name="className" placeholder={t("competitionDevelopment.entries.class")} minLength={2} required />
            <div className="flex gap-2">
              <select className={fieldClass} name="family" defaultValue="show_jumping">
                <option value="show_jumping">{t("competitionDevelopment.disciplines.showJumping")}</option>
                <option value="foundation">{t("competitionDevelopment.entries.foundation")}</option>
              </select>
              <input className={fieldClass} name="level" type="number" defaultValue={1} min={1} max={10} required />
            </div>
            <label className="text-xs text-text-secondary"><input name="portalVisible" type="checkbox" /> {t("competitionDevelopment.calendar.portalVisible")}</label>
            {!coachId ? <p role="alert" className="text-sm text-warning-700 md:col-span-4">{t("competitionDevelopment.messages.coachRequired")}</p> : null}
            <div className="md:col-span-3"><SubmitButton disabled={actions.saving || !coachId}>{t("competitionDevelopment.entries.add")}</SubmitButton></div>
          </form>
          {selected ? (
            <div className="grid gap-3 rounded-lg border border-cream-200 bg-white p-3 lg:grid-cols-2">
              <div>
                <label className={labelClass}>{t("competitionDevelopment.entries.selectEntry")}</label>
                <select className={fieldClass} value={selectedEntry || selected.id} onChange={(event) => setSelectedEntry(event.target.value)}>
                  {entries.map((entry) => <option key={entry.id} value={entry.id}>{entry.class_name}</option>)}
                </select>
              </div>
              <form
                className="grid gap-2 sm:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void submit(() => actions.saveLogistics({
                    p_entry_id: selected.id,
                    p_transport_provider: String(form.get("provider")),
                    p_outbound_details: String(form.get("outbound")),
                    p_return_details: String(form.get("return")),
                    p_cost_cents: Math.round(Number(form.get("cost")) * 100),
                    p_currency: String(form.get("currency")),
                    p_confirmed: Boolean(form.get("confirmed")),
                  }));
                }}
              >
                <input className={fieldClass} name="provider" placeholder={t("competitionDevelopment.logistics.provider")} />
                <input className={fieldClass} name="cost" type="number" min={0} step="0.01" placeholder={t("competitionDevelopment.logistics.cost")} />
                <input className={fieldClass} name="outbound" placeholder={t("competitionDevelopment.logistics.outbound")} />
                <input className={fieldClass} name="return" placeholder={t("competitionDevelopment.logistics.return")} />
                <input className={fieldClass} name="currency" defaultValue="USD" maxLength={3} />
                <label className="text-sm text-espresso"><input name="confirmed" type="checkbox" /> {t("competitionDevelopment.logistics.confirmed")}</label>
                <div className="sm:col-span-2"><SubmitButton disabled={actions.saving}>{t("competitionDevelopment.logistics.save")}</SubmitButton></div>
              </form>
              <form
                className="grid gap-2 border-t border-cream-100 pt-3 sm:grid-cols-3 lg:col-span-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void submit(() => actions.saveResult({
                    p_entry_id: selected.id,
                    p_placing: String(form.get("placing")) ? Number(form.get("placing")) : null,
                    p_score: String(form.get("score")) ? Number(form.get("score")) : null,
                    p_outcome: String(form.get("outcome")),
                    p_coach_note: String(form.get("note")) || null,
                    p_portal_visible: Boolean(form.get("resultPortalVisible")),
                  }));
                }}
              >
                <input className={fieldClass} name="placing" type="number" min={1} placeholder={t("competitionDevelopment.results.placing")} />
                <input className={fieldClass} name="score" type="number" min={0} max={100} step="0.1" placeholder={t("competitionDevelopment.results.score")} />
                <input className={fieldClass} name="outcome" minLength={2} placeholder={t("competitionDevelopment.results.outcome")} required />
                <input className={`${fieldClass} sm:col-span-2`} name="note" placeholder={t("competitionDevelopment.results.note")} />
                <label className="text-sm text-espresso"><input name="resultPortalVisible" type="checkbox" /> {t("competitionDevelopment.calendar.portalVisible")}</label>
                <div className="sm:col-span-3"><SubmitButton disabled={actions.saving}>{t("competitionDevelopment.results.save")}</SubmitButton></div>
              </form>
            </div>
          ) : null}
        </>
      ) : null}
      {error ? <p role="alert" className="text-sm text-error-700">{error}</p> : null}
    </div>
  );
}

export default function CompetitionDevelopmentPage() {
  const { t } = useTranslation();
  const access = useCompetitionDevelopmentAccess();
  const riders = useCompetitionDevelopmentRiders();
  const [riderId, setRiderId] = useState<string | null>(null);
  const workspace = useCompetitionDevelopmentWorkspace(riderId);
  const coaches = useCompetitionDevelopmentCoaches(riderId);

  useEffect(() => {
    const available = riders.data ?? [];
    if (!riderId || !available.some((rider) => rider.riderId === riderId)) {
      setRiderId(available[0]?.riderId ?? null);
    }
  }, [riders.data, riderId]);

  if (access.loading || riders.loading || (riderId && (workspace.loading || coaches.loading))) return <PageSkeleton cards={4} />;
  if (access.error) return <ErrorState message={access.error} retryLabel={t("common.tryAgain")} onRetry={access.refetch} />;
  if (riders.error) return <ErrorState message={riders.error} retryLabel={t("common.tryAgain")} onRetry={riders.refetch} />;
  if (!access.data?.enabled) {
    return (
      <EmptyState
        icon={Trophy}
        title={t("competitionDevelopment.gatedTitle")}
        description={t("competitionDevelopment.gatedDescription")}
      />
    );
  }
  if (!(riders.data ?? []).length || !riderId) {
    return (
      <EmptyState
        icon={Trophy}
        title={t("competitionDevelopment.noRiderTitle")}
        description={t("competitionDevelopment.noRiderDescription")}
      />
    );
  }
  if (workspace.error) return <ErrorState message={workspace.error} retryLabel={t("common.tryAgain")} onRetry={workspace.refetch} />;
  if (!workspace.data?.access.canView) {
    return <EmptyState icon={Route} title={t("competitionDevelopment.noAccessTitle")} description={t("competitionDevelopment.noAccessDescription")} />;
  }

  return (
    <div>
      <PageHeader
        eyebrow={t("competitionDevelopment.eyebrow")}
        title={t("competitionDevelopment.title")}
        description={t("competitionDevelopment.description")}
      />
      <SurfaceCard className="mb-6 p-5 transition-all duration-300 hover:border-primary-200 hover:shadow-md">
        <label className={labelClass}>{t("competitionDevelopment.rider")}</label>
        <select className={`${fieldClass} max-w-md`} value={riderId} onChange={(event) => setRiderId(event.target.value)}>
          {(riders.data ?? []).map((rider) => <option key={rider.riderId} value={rider.riderId}>{rider.riderName}</option>)}
        </select>
      </SurfaceCard>
      <WorkspaceSections
        workspace={workspace.data}
        riderId={riderId}
        coachId={workspace.data.annualPlans.find((plan) => plan.status !== "archived")?.coach_id ?? coaches.data?.[0]?.coachId ?? ""}
        onRefresh={workspace.refetch}
      />
    </div>
  );
}