import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  Award,
  CheckCircle2,
  ClipboardCheck,
  MessageSquareText,
} from "lucide-react";
import {
  BusyLabel,
  ErrorState,
  Modal,
  OutlineButton,
  PrimaryButton,
  StatusBadge,
  fieldClass,
  labelClass,
} from "@/components/EquiVistaUI";
import { useAuth } from "@/contexts/AuthContext";
import { useLessonDevelopmentActions } from "@/hooks/use-lessons";
import { useRiderBadgeCatalog } from "@/hooks/use-rider-sync";
import type {
  CompetencyDefinition,
  CompetencyStage,
  Lesson,
  LessonDevelopmentInput,
} from "@/hooks/types";

const stages: CompetencyStage[] = [
  "introduced",
  "practising",
  "demonstrated",
  "achieved",
];
const scoreOptions = [1, 2, 3, 4, 5];

function listValue(items: string[]) {
  return items.join(", ");
}

function splitList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,،]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

interface CompetencyDraft {
  selected: boolean;
  stage: CompetencyStage;
  evidenceNote: string;
}

interface CloseoutDraft {
  objectives: string;
  summary: string;
  strengths: string;
  focusAreas: string;
  horseObservations: string;
  interactionObservations: string;
  homework: string;
  homeworkDueAt: string;
  nextFocus: string;
  effortScore: number;
  riderConfidenceScore: number;
  lessonDifficultyScore: number;
  privateNote: string;
}

function initialDraft(lesson: Lesson): CloseoutDraft {
  const report = lesson.developmentReport;
  return {
    objectives: listValue(report?.objectives ?? []),
    summary: report?.summary ?? "",
    strengths: listValue(report?.strengths ?? []),
    focusAreas: listValue(report?.focusAreas ?? []),
    horseObservations: report?.horseObservations ?? "",
    interactionObservations: report?.interactionObservations ?? "",
    homework: report?.homework ?? "",
    homeworkDueAt: report?.homeworkDueAt?.slice(0, 10) ?? "",
    nextFocus: report?.nextFocus ?? "",
    effortScore: report?.effortScore ?? 3,
    riderConfidenceScore: report?.riderConfidenceScore ?? 3,
    lessonDifficultyScore: report?.lessonDifficultyScore ?? 3,
    privateNote: "",
  };
}

export function LessonDevelopmentSummary({
  lesson,
  onChanged,
}: {
  lesson: Lesson;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const { user, activeOrganization } = useAuth();
  const report = lesson.developmentReport;
  const actions = useLessonDevelopmentActions();
  const badges = useRiderBadgeCatalog();
  const [reflection, setReflection] = useState(
    report?.reflection?.reflection ?? "",
  );
  const [question, setQuestion] = useState(report?.reflection?.question ?? "");
  const [visibleToGuardian, setVisibleToGuardian] = useState(
    report?.reflection?.visibleToGuardian ?? true,
  );
  const [saved, setSaved] = useState(false);
  const [badgeCode, setBadgeCode] = useState("");
  const [badgeMessage, setBadgeMessage] = useState("");
  const [badgeSaved, setBadgeSaved] = useState(false);

  useEffect(() => {
    setReflection(report?.reflection?.reflection ?? "");
    setQuestion(report?.reflection?.question ?? "");
    setVisibleToGuardian(report?.reflection?.visibleToGuardian ?? true);
  }, [report?.reflection]);

  if (!report) return null;

  const canReflect =
    report.status === "approved" && user?.id === lesson.riderId;
  const canAwardBadge =
    report.status === "approved" &&
    Boolean(
      activeOrganization?.roles.some((role) =>
        ["coach", "academy_admin", "stable_manager"].includes(role),
      ),
    );

  const submitReflection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeOrganization || (!reflection.trim() && !question.trim())) return;
    const ok = await actions.saveReflection(
      report.id,
      activeOrganization.id,
      lesson.riderId,
      reflection,
      question,
      visibleToGuardian,
    );
    if (ok) {
      setSaved(true);
      onChanged();
    }
  };

  const submitBadge = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeOrganization || !badgeCode) return;
    const ok = await actions.awardBadge(
      activeOrganization.id,
      lesson.riderId,
      badgeCode,
      badgeMessage,
      report.id,
    );
    if (ok) {
      setBadgeSaved(true);
      setBadgeMessage("");
      onChanged();
    }
  };

  return (
    <details className="group mt-4 rounded-xl border border-cream-200 bg-cream-50">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-espresso">
        <span className="flex items-center gap-2">
          <ClipboardCheck
            className="size-4 text-primary-600"
            aria-hidden="true"
          />
          {t("lessons.development.title")}
        </span>
        <span className="flex items-center gap-2">
          <StatusBadge
            status={report.status}
            label={t(`lessons.development.status.${report.status}`)}
          />
        </span>
      </summary>
      <div className="space-y-5 border-t border-cream-200 px-4 py-4 text-sm leading-6">
        <div>
          <p className="font-bold text-espresso">
            {t("lessons.development.coachSummary")}
          </p>
          <p className="mt-1 text-text-secondary">{report.summary}</p>
        </div>

        {report.strengths.length ? (
          <div>
            <p className="font-bold text-espresso">
              {t("lessons.development.strengths")}
            </p>
            <ul className="mt-1 list-disc ps-5 text-text-secondary">
              {report.strengths.map((strength) => (
                <li key={strength}>{strength}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {report.focusAreas.length ? (
          <div>
            <p className="font-bold text-espresso">
              {t("lessons.development.focusAreas")}
            </p>
            <ul className="mt-1 list-disc ps-5 text-text-secondary">
              {report.focusAreas.map((area) => (
                <li key={area}>{area}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {report.competencies.length ? (
          <div>
            <p className="font-bold text-espresso">
              {t("lessons.development.competencies")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {report.competencies.map((competency) => (
                <span
                  key={competency.competencyId}
                  className="rounded-full border border-primary-200 bg-white px-3 py-1 text-xs font-bold text-primary-700"
                  title={competency.note ?? undefined}
                >
                  {competency.competencyName} ·{" "}
                  {t(`lessons.development.stages.${competency.stage}`)}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-white p-3">
            <p className="text-xs font-bold text-text-secondary">
              {t("lessons.development.effort")}
            </p>
            <p className="mt-1 font-serif text-xl text-espresso">
              {report.effortScore ?? "—"}/5
            </p>
          </div>
          <div className="rounded-xl bg-white p-3">
            <p className="text-xs font-bold text-text-secondary">
              {t("lessons.development.confidence")}
            </p>
            <p className="mt-1 font-serif text-xl text-espresso">
              {report.riderConfidenceScore ?? "—"}/5
            </p>
          </div>
          <div className="rounded-xl bg-white p-3">
            <p className="text-xs font-bold text-text-secondary">
              {t("lessons.development.difficulty")}
            </p>
            <p className="mt-1 font-serif text-xl text-espresso">
              {report.lessonDifficultyScore ?? "—"}/5
            </p>
          </div>
        </div>

        {report.homework ? (
          <div className="border-s-2 border-primary-500 ps-3">
            <p className="font-bold text-espresso">
              {t("lessons.development.homework")}
            </p>
            <p className="mt-1 text-text-secondary">{report.homework}</p>
          </div>
        ) : null}

        <div>
          <p className="font-bold text-espresso">
            {t("lessons.development.nextFocus")}
          </p>
          <p className="mt-1 text-text-secondary">{report.nextFocus}</p>
        </div>

        {canAwardBadge ? (
          <form
            className="space-y-3 rounded-xl border border-primary-200 bg-white p-4"
            onSubmit={submitBadge}
          >
            <p className="flex items-center gap-2 font-bold text-espresso">
              <Award className="size-4 text-primary-600" aria-hidden="true" />
              {t("lessons.development.approveBadge")}
            </p>
            <p className="text-xs text-text-secondary">
              {t("lessons.development.approveBadgeHelp")}
            </p>
            <select
              className={fieldClass}
              value={badgeCode}
              onChange={(event) => {
                setBadgeCode(event.target.value);
                setBadgeSaved(false);
              }}
              required
            >
              <option value="">{t("lessons.development.selectBadge")}</option>
              {(badges.data ?? []).map((badge) => (
                <option key={badge.code} value={badge.code}>
                  {badge.name}
                </option>
              ))}
            </select>
            <textarea
              className={`${fieldClass} min-h-20 resize-y`}
              value={badgeMessage}
              onChange={(event) => setBadgeMessage(event.target.value)}
              placeholder={t("lessons.development.badgeMessage")}
              maxLength={500}
            />
            {badges.error ? <ErrorState message={badges.error} /> : null}
            <div className="flex items-center gap-3">
              <PrimaryButton
                type="submit"
                disabled={actions.submitting || badges.loading || !badgeCode}
              >
                {actions.submitting ? (
                  <BusyLabel label={t("common.saving")} />
                ) : (
                  t("lessons.development.approveBadgeAction")
                )}
              </PrimaryButton>
              {badgeSaved ? (
                <span className="flex items-center gap-1 text-xs font-bold text-success-700">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  {t("lessons.development.badgeApproved")}
                </span>
              ) : null}
            </div>
          </form>
        ) : null}

        {report.reflection ? (
          <div className="rounded-xl border border-cream-200 bg-white p-4">
            <p className="flex items-center gap-2 font-bold text-espresso">
              <MessageSquareText
                className="size-4 text-primary-600"
                aria-hidden="true"
              />
              {t("lessons.development.riderReflection")}
            </p>
            {report.reflection.reflection ? (
              <p className="mt-2 text-text-secondary">
                {report.reflection.reflection}
              </p>
            ) : null}
            {report.reflection.question ? (
              <p className="mt-2 font-semibold text-primary-700">
                {report.reflection.question}
              </p>
            ) : null}
          </div>
        ) : null}

        {canReflect ? (
          <form
            className="space-y-3 border-t border-cream-200 pt-4"
            onSubmit={submitReflection}
          >
            <div>
              <label className={labelClass} htmlFor={`reflection-${lesson.id}`}>
                {t("lessons.development.reflectionLabel")}
              </label>
              <textarea
                id={`reflection-${lesson.id}`}
                className={`${fieldClass} min-h-24 resize-y`}
                value={reflection}
                onChange={(event) => {
                  setReflection(event.target.value);
                  setSaved(false);
                }}
                maxLength={3000}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor={`question-${lesson.id}`}>
                {t("lessons.development.questionLabel")}
              </label>
              <textarea
                id={`question-${lesson.id}`}
                className={`${fieldClass} min-h-20 resize-y`}
                value={question}
                onChange={(event) => {
                  setQuestion(event.target.value);
                  setSaved(false);
                }}
                maxLength={1500}
              />
            </div>
            <label className="flex items-start gap-3 text-sm text-text-secondary">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-primary-600"
                checked={visibleToGuardian}
                onChange={(event) => setVisibleToGuardian(event.target.checked)}
              />
              {t("lessons.development.shareWithGuardian")}
            </label>
            {actions.error ? <ErrorState message={actions.error} /> : null}
            <div className="flex items-center gap-3">
              <PrimaryButton
                type="submit"
                disabled={
                  actions.submitting || (!reflection.trim() && !question.trim())
                }
              >
                {actions.submitting ? (
                  <BusyLabel label={t("common.saving")} />
                ) : (
                  t("lessons.development.saveReflection")
                )}
              </PrimaryButton>
              {saved ? (
                <span className="flex items-center gap-1 text-xs font-bold text-success-700">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  {t("lessons.development.reflectionSaved")}
                </span>
              ) : null}
            </div>
          </form>
        ) : null}
      </div>
    </details>
  );
}

export function LessonCloseoutModal({
  lesson,
  competencies,
  open,
  onClose,
  onSaved,
}: {
  lesson: Lesson | null;
  competencies: CompetencyDefinition[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const actions = useLessonDevelopmentActions();
  const [draft, setDraft] = useState<CloseoutDraft | null>(null);
  const [competencyDrafts, setCompetencyDrafts] = useState<
    Record<string, CompetencyDraft>
  >({});

  useEffect(() => {
    if (!lesson) return;
    setDraft(initialDraft(lesson));
    const existing = new Map(
      (lesson.developmentReport?.competencies ?? []).map((item) => [
        item.competencyId,
        item,
      ]),
    );
    setCompetencyDrafts(
      Object.fromEntries(
        competencies.map((competency) => {
          const evidence = existing.get(competency.id);
          return [
            competency.id,
            {
              selected: Boolean(evidence),
              stage: evidence?.stage ?? "introduced",
              evidenceNote: evidence?.note ?? "",
            },
          ];
        }),
      ),
    );
  }, [competencies, lesson]);

  const selectedCompetencies = useMemo(
    () =>
      competencies.flatMap((competency) => {
        const value = competencyDrafts[competency.id];
        return value?.selected
          ? [
              {
                competencyId: competency.id,
                stage: value.stage,
                evidenceNote: value.evidenceNote,
              },
            ]
          : [];
      }),
    [competencies, competencyDrafts],
  );

  if (!lesson || !draft) return null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const approveAfterSave = submitter?.value === "approve";
    const input: LessonDevelopmentInput = {
      lessonId: lesson.id,
      objectives: splitList(draft.objectives),
      summary: draft.summary.trim(),
      strengths: splitList(draft.strengths),
      focusAreas: splitList(draft.focusAreas),
      horseObservations: draft.horseObservations,
      interactionObservations: draft.interactionObservations,
      homework: draft.homework,
      homeworkDueAt: draft.homeworkDueAt
        ? new Date(`${draft.homeworkDueAt}T12:00:00`).toISOString()
        : undefined,
      nextFocus: draft.nextFocus.trim(),
      effortScore: draft.effortScore,
      riderConfidenceScore: draft.riderConfidenceScore,
      lessonDifficultyScore: draft.lessonDifficultyScore,
      competencies: selectedCompetencies,
      privateNote: draft.privateNote,
    };

    const reportId = await actions.save(input);
    if (!reportId) return;
    if (approveAfterSave && !(await actions.approve(reportId))) return;
    onSaved();
    onClose();
  };

  const setField = <K extends keyof CloseoutDraft>(
    field: K,
    value: CloseoutDraft[K],
  ) =>
    setDraft((current) => (current ? { ...current, [field]: value } : current));

  const approvalReady =
    draft.summary.trim().length >= 10 &&
    draft.nextFocus.trim().length >= 3 &&
    selectedCompetencies.length > 0;

  return (
    <Modal
      open={open}
      title={t("lessons.development.closeoutTitle", {
        rider: lesson.riderName,
      })}
      description={t("lessons.development.closeoutDescription")}
      onClose={onClose}
      footer={
        <>
          <OutlineButton
            type="button"
            onClick={onClose}
            disabled={actions.submitting}
          >
            {t("common.cancel")}
          </OutlineButton>
          <OutlineButton
            type="submit"
            form="lesson-development-form"
            value="draft"
            disabled={actions.submitting}
          >
            {actions.submitting ? (
              <BusyLabel label={t("common.saving")} />
            ) : (
              t("lessons.development.saveDraft")
            )}
          </OutlineButton>
          <PrimaryButton
            type="submit"
            form="lesson-development-form"
            value="approve"
            disabled={actions.submitting || !approvalReady}
          >
            {t("lessons.development.saveApprove")}
          </PrimaryButton>
        </>
      }
    >
      <form
        id="lesson-development-form"
        className="space-y-5"
        onSubmit={submit}
      >
        {actions.error ? <ErrorState message={actions.error} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="development-objectives">
              {t("lessons.development.objectives")}
            </label>
            <input
              id="development-objectives"
              className={fieldClass}
              value={draft.objectives}
              onChange={(event) => setField("objectives", event.target.value)}
              placeholder={t("lessons.development.commaSeparated")}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="development-strengths">
              {t("lessons.development.strengths")}
            </label>
            <input
              id="development-strengths"
              className={fieldClass}
              value={draft.strengths}
              onChange={(event) => setField("strengths", event.target.value)}
              placeholder={t("lessons.development.commaSeparated")}
            />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="development-summary">
            {t("lessons.development.coachSummary")}
          </label>
          <textarea
            id="development-summary"
            className={`${fieldClass} min-h-28 resize-y`}
            value={draft.summary}
            onChange={(event) => setField("summary", event.target.value)}
            maxLength={4000}
            required
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="development-focus-areas">
            {t("lessons.development.focusAreas")}
          </label>
          <input
            id="development-focus-areas"
            className={fieldClass}
            value={draft.focusAreas}
            onChange={(event) => setField("focusAreas", event.target.value)}
            placeholder={t("lessons.development.commaSeparated")}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              className={labelClass}
              htmlFor="development-horse-observations"
            >
              {t("lessons.development.horseObservations")}
            </label>
            <textarea
              id="development-horse-observations"
              className={`${fieldClass} min-h-24 resize-y`}
              value={draft.horseObservations}
              onChange={(event) =>
                setField("horseObservations", event.target.value)
              }
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="development-interaction">
              {t("lessons.development.interactionObservations")}
            </label>
            <textarea
              id="development-interaction"
              className={`${fieldClass} min-h-24 resize-y`}
              value={draft.interactionObservations}
              onChange={(event) =>
                setField("interactionObservations", event.target.value)
              }
            />
          </div>
        </div>

        <fieldset>
          <legend className={labelClass}>
            {t("lessons.development.competencies")}
          </legend>
          <div className="mt-2 space-y-3 rounded-xl border border-cream-200 p-3">
            {competencies.map((competency) => {
              const value = competencyDrafts[competency.id] ?? {
                selected: false,
                stage: "introduced" as CompetencyStage,
                evidenceNote: "",
              };
              return (
                <div key={competency.id} className="rounded-xl bg-cream-50 p-3">
                  <label className="flex items-start gap-3 font-bold text-espresso">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 accent-primary-600"
                      checked={value.selected}
                      onChange={(event) =>
                        setCompetencyDrafts((current) => ({
                          ...current,
                          [competency.id]: {
                            ...value,
                            selected: event.target.checked,
                          },
                        }))
                      }
                    />
                    <span>
                      {competency.name}
                      <span className="ms-2 text-xs font-normal text-text-secondary">
                        {competency.category}
                      </span>
                    </span>
                  </label>
                  {value.selected ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-[10rem_1fr]">
                      <select
                        className={fieldClass}
                        value={value.stage}
                        aria-label={t("lessons.development.competencyStage", {
                          competency: competency.name,
                        })}
                        onChange={(event) =>
                          setCompetencyDrafts((current) => ({
                            ...current,
                            [competency.id]: {
                              ...value,
                              stage: event.target.value as CompetencyStage,
                            },
                          }))
                        }
                      >
                        {stages.map((stage) => (
                          <option key={stage} value={stage}>
                            {t(`lessons.development.stages.${stage}`)}
                          </option>
                        ))}
                      </select>
                      <input
                        className={fieldClass}
                        value={value.evidenceNote}
                        onChange={(event) =>
                          setCompetencyDrafts((current) => ({
                            ...current,
                            [competency.id]: {
                              ...value,
                              evidenceNote: event.target.value,
                            },
                          }))
                        }
                        placeholder={t(
                          "lessons.development.evidencePlaceholder",
                        )}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ["effortScore", "effort"],
              ["riderConfidenceScore", "confidence"],
              ["lessonDifficultyScore", "difficulty"],
            ] as const
          ).map(([field, label]) => (
            <div key={field}>
              <label className={labelClass} htmlFor={`development-${field}`}>
                {t(`lessons.development.${label}`)}
              </label>
              <select
                id={`development-${field}`}
                className={fieldClass}
                value={draft[field]}
                onChange={(event) =>
                  setField(field, Number(event.target.value))
                }
              >
                {scoreOptions.map((score) => (
                  <option key={score} value={score}>
                    {score}/5
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="development-homework">
              {t("lessons.development.homework")}
            </label>
            <textarea
              id="development-homework"
              className={`${fieldClass} min-h-24 resize-y`}
              value={draft.homework}
              onChange={(event) => setField("homework", event.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="development-next-focus">
              {t("lessons.development.nextFocus")}
            </label>
            <textarea
              id="development-next-focus"
              className={`${fieldClass} min-h-24 resize-y`}
              value={draft.nextFocus}
              onChange={(event) => setField("nextFocus", event.target.value)}
              maxLength={2000}
              required
            />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="development-homework-due">
            {t("lessons.development.homeworkDue")}
          </label>
          <input
            id="development-homework-due"
            type="date"
            className={fieldClass}
            value={draft.homeworkDueAt}
            onChange={(event) => setField("homeworkDueAt", event.target.value)}
          />
        </div>

        <div className="rounded-xl border border-warning-500/25 bg-warning-50 p-4">
          <label className={labelClass} htmlFor="development-private-note">
            {t("lessons.development.privateNote")}
          </label>
          <textarea
            id="development-private-note"
            className={`${fieldClass} min-h-20 resize-y`}
            value={draft.privateNote}
            onChange={(event) => setField("privateNote", event.target.value)}
            placeholder={t("lessons.development.privateNoteHelp")}
          />
        </div>
      </form>
    </Modal>
  );
}
