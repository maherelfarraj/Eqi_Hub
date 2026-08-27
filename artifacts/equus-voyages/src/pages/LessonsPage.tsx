import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  List,
  MessageSquareText,
  Plus,
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
import {
  LessonCloseoutModal,
  LessonDevelopmentSummary,
} from "@/components/LessonDevelopment";
import { useAuth } from "@/contexts/AuthContext";
import { useHorses } from "@/hooks/use-horses";
import {
  useBookLesson,
  useCompetencyCatalog,
  useLessons,
  useTrainers,
  type LessonFilter,
} from "@/hooks/use-lessons";
import type { BookLessonInput, Lesson, LessonType } from "@/hooks/types";

type ViewMode = "list" | "week";

const lessonTypes: LessonType[] = [
  "Flatwork",
  "Jumping",
  "Dressage",
  "Groundwork",
];

const lessonDurations: BookLessonInput["durationMin"][] = [30, 45, 60];

function localDateTimeValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function initialDateTime() {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0);
  return localDateTimeValue(next);
}

function localDayKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfLocalWeek(offset: number) {
  const date = new Date();
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset + offset * 7);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addLocalDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function LessonCard({
  lesson,
  locale,
  onOpenAnalysis,
  canManageDevelopment,
  onCloseout,
  onChanged,
}: {
  lesson: Lesson;
  locale: string;
  onOpenAnalysis: (id: string) => void;
  canManageDevelopment: boolean;
  onCloseout: (lesson: Lesson) => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const time = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(lesson.dateTime));

  return (
    <article className="group rounded-2xl border border-cream-200 bg-white p-6 shadow-sm transition-all duration-300 hover:border-primary-200 hover:shadow-md">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-2xl text-espresso group-hover:text-primary-700 transition-colors">
              {t(`lessons.types.${lesson.type}`)}
            </h3>
            <StatusBadge
              status={lesson.status}
              label={t(`status.${lesson.status}`)}
            />
          </div>
          <p className="mt-2 flex items-center gap-2 text-sm text-text-secondary">
            <GraduationCap
              className="size-4 text-primary-500"
              aria-hidden="true"
            />
            {lesson.trainerName}
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            {t("lessons.riderLabel", { name: lesson.riderName })}
          </p>
          {lesson.horseName ? (
            <p className="mt-1 text-sm text-text-secondary">
              {t("lessons.horseLabel", { name: lesson.horseName })}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 rounded-xl bg-cream-50 px-3.5 py-2.5 text-sm font-semibold text-espresso">
          <span className="flex items-center gap-2">
            <Clock3 className="size-4 text-primary-500" aria-hidden="true" />
            {time} · {t("lessons.minutes", { count: lesson.durationMin })}
          </span>
        </div>
      </div>

      {lesson.notes ? (
        <p className="mt-4 border-s-2 border-primary-300 ps-3 text-sm leading-6 text-text-secondary">
          {lesson.notes}
        </p>
      ) : null}

      {lesson.status === "completed" && lesson.feedback ? (
        <details className="group/details mt-5 overflow-hidden rounded-xl border border-cream-200 bg-cream-50/50 transition-colors hover:border-primary-200 hover:bg-cream-50">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-bold text-espresso">
            <span className="flex items-center gap-2">
              <MessageSquareText
                className="size-4 text-primary-600"
                aria-hidden="true"
              />
              {t("lessons.feedbackTitle")}
            </span>
            <ChevronDown
              className="size-4 transition-transform group-open/details:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="space-y-4 border-t border-cream-200 px-5 py-4 text-sm leading-6">
            <div>
              <p className="font-bold text-espresso">
                {t("lessons.trainerFeedback")}
              </p>
              <p className="mt-1 text-text-secondary">{lesson.feedback.text}</p>
            </div>
            {lesson.feedback.homework ? (
              <div className="border-s-2 border-primary-500 ps-3">
                <p className="font-bold text-espresso">
                  {t("lessons.homework")}
                </p>
                <p className="mt-1 text-text-secondary">
                  {lesson.feedback.homework}
                </p>
              </div>
            ) : null}
            {lesson.analysisId ? (
              <button
                type="button"
                onClick={() => onOpenAnalysis(lesson.analysisId!)}
                className="font-bold text-primary-700 underline decoration-primary-300 underline-offset-4"
              >
                {t("lessons.viewAnalysis")}
              </button>
            ) : null}
          </div>
        </details>
      ) : null}

      <LessonDevelopmentSummary lesson={lesson} onChanged={onChanged} />

      {canManageDevelopment &&
      ["confirmed", "completed"].includes(lesson.status) &&
      lesson.developmentReport?.status !== "approved" ? (
        <div className="mt-4 border-t border-cream-200 pt-4">
          <OutlineButton type="button" onClick={() => onCloseout(lesson)}>
            <ClipboardCheck className="size-4" aria-hidden="true" />
            {lesson.developmentReport
              ? t("lessons.development.editDraft")
              : t("lessons.development.closeLesson")}
          </OutlineButton>
        </div>
      ) : null}
    </article>
  );
}

export default function LessonsPage() {
  const { t, i18n } = useTranslation();
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const [filter, setFilter] = useState<LessonFilter>("upcoming");
  const [view, setView] = useState<ViewMode>("list");
  const [weekOffset, setWeekOffset] = useState(0);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [success, setSuccess] = useState("");
  const [closeoutLesson, setCloseoutLesson] = useState<Lesson | null>(null);
  const [booking, setBooking] = useState<BookLessonInput>({
    trainerId: "",
    horseId: null,
    type: "Flatwork",
    dateTime: initialDateTime(),
    durationMin: 60,
    notes: "",
  });

  const lessons = useLessons(filter);
  const competencies = useCompetencyCatalog();
  const trainers = useTrainers();
  const horses = useHorses();
  const bookingAction = useBookLesson();
  const lessonItems = lessons.data ?? [];
  const trainerItems = trainers.data ?? [];
  const horseItems = horses.data ?? [];
  const competencyItems = competencies.data ?? [];
  const canManageDevelopment = [
    "coach",
    "academy_admin",
    "stable_manager",
    "platform_admin",
  ].some(hasRole);

  const groupedLessons = useMemo(() => {
    const groups = new Map<string, Lesson[]>();
    lessonItems.forEach((lesson) => {
      const key = localDayKey(lesson.dateTime);
      const current = groups.get(key) ?? [];
      current.push(lesson);
      groups.set(key, current);
    });
    return Array.from(groups.entries());
  }, [lessonItems]);

  const weekDays = useMemo(() => {
    const start = startOfLocalWeek(weekOffset);
    return Array.from({ length: 7 }, (_, index) => addLocalDays(start, index));
  }, [weekOffset]);

  const openBooking = () => {
    setSuccess("");
    setBookingOpen(true);
  };

  const closeBooking = () => {
    if (!bookingAction.submitting) setBookingOpen(false);
  };

  const submitBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!booking.trainerId || !booking.dateTime) return;
    const created = await bookingAction.book(booking);
    if (!created) return;

    setBookingOpen(false);
    setSuccess(t("lessons.bookingSuccess"));
    setFilter("requests");
    setView("list");
    lessons.refetch();
    setBooking({
      trainerId: "",
      horseId: null,
      type: "Flatwork",
      dateTime: initialDateTime(),
      durationMin: 60,
      notes: "",
    });
  };

  if (lessons.loading) return <PageSkeleton cards={3} />;

  return (
    <section>
      <PageHeader
        eyebrow={t("lessons.eyebrow")}
        title={t("lessons.title")}
        description={t("lessons.description")}
        actions={
          <PrimaryButton type="button" onClick={openBooking}>
            <Plus className="size-4" aria-hidden="true" />
            {t("lessons.bookLesson")}
          </PrimaryButton>
        }
      />

      {success ? (
        <div
          className="mb-5 rounded-xl border border-success-500/25 bg-success-50 px-4 py-3 text-sm font-semibold text-success-700"
          role="status"
        >
          {success}
        </div>
      ) : null}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="inline-flex w-full rounded-xl border border-cream-200 bg-cream-50/50 p-1 shadow-inner sm:w-auto"
          role="tablist"
          aria-label={t("lessons.filterLabel")}
        >
          {(["upcoming", "past", "requests"] as LessonFilter[]).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={filter === item}
              onClick={() => {
                setFilter(item);
                setSuccess("");
                setWeekOffset(0);
              }}
              className={`min-h-10 flex-1 rounded-lg px-4 py-2 text-sm font-bold transition-all duration-200 sm:flex-none ${
                filter === item
                  ? "bg-primary-600 text-white shadow-sm"
                  : "text-text-secondary hover:bg-white hover:text-espresso"
              }`}
            >
              {t(`lessons.tabs.${item}`)}
            </button>
          ))}
        </div>

        <div
          className="inline-flex self-end rounded-xl border border-cream-200 bg-cream-50/50 p-1 shadow-inner"
          aria-label={t("lessons.viewLabel")}
        >
          <button
            type="button"
            onClick={() => setView("list")}
            className={`flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-bold transition-all duration-200 ${view === "list" ? "bg-white text-espresso shadow-sm" : "text-text-secondary hover:text-espresso"}`}
            aria-pressed={view === "list"}
          >
            <List className="size-4" aria-hidden="true" />
            {t("lessons.views.list")}
          </button>
          <button
            type="button"
            onClick={() => setView("week")}
            className={`flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-bold transition-all duration-200 ${view === "week" ? "bg-white text-espresso shadow-sm" : "text-text-secondary hover:text-espresso"}`}
            aria-pressed={view === "week"}
          >
            <CalendarRange className="size-4" aria-hidden="true" />
            {t("lessons.views.week")}
          </button>
        </div>
      </div>

      {lessons.error ? (
        <ErrorState
          message={lessons.error}
          retryLabel={t("common.tryAgain")}
          onRetry={lessons.refetch}
        />
      ) : lessonItems.length === 0 ? (
        <SurfaceCard className="transition-all duration-300 hover:shadow-md">
          <EmptyState
            icon={CalendarDays}
            title={t(`lessons.empty.${filter}Title`)}
            description={t(`lessons.empty.${filter}Description`)}
            action={
              <PrimaryButton type="button" onClick={openBooking}>
                <Plus className="size-4" aria-hidden="true" />
                {t("lessons.bookLesson")}
              </PrimaryButton>
            }
          />
        </SurfaceCard>
      ) : view === "list" ? (
        <div className="space-y-8">
          {groupedLessons.map(([date, items]) => (
            <section key={date}>
              <h2 className="mb-4 font-serif text-2xl text-espresso">
                {formatDate(date, locale, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </h2>
              <div className="space-y-3">
                {items.map((lesson) => (
                  <LessonCard
                    key={lesson.id}
                    lesson={lesson}
                    locale={locale}
                    onOpenAnalysis={(id) => navigate(`/analysis/${id}`)}
                    canManageDevelopment={canManageDevelopment}
                    onCloseout={setCloseoutLesson}
                    onChanged={lessons.refetch}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <SurfaceCard className="flex items-center justify-between gap-3 p-3 transition-all duration-300 hover:border-primary-200 hover:shadow-md">
            <OutlineButton
              type="button"
              className="min-h-9 px-3"
              onClick={() => setWeekOffset((current) => current - 1)}
              aria-label={t("lessons.previousWeek")}
            >
              <ChevronLeft
                className="size-4 rtl:rotate-180"
                aria-hidden="true"
              />
            </OutlineButton>
            <div className="text-center">
              <p className="font-serif text-lg text-espresso">
                {formatDate(weekDays[0].toISOString(), locale, {
                  day: "numeric",
                  month: "short",
                })}
                {" — "}
                {formatDate(weekDays[6].toISOString(), locale, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
              {weekOffset !== 0 ? (
                <button
                  type="button"
                  onClick={() => setWeekOffset(0)}
                  className="text-xs font-bold text-primary-700 underline underline-offset-4"
                >
                  {t("lessons.thisWeek")}
                </button>
              ) : null}
            </div>
            <OutlineButton
              type="button"
              className="min-h-9 px-3"
              onClick={() => setWeekOffset((current) => current + 1)}
              aria-label={t("lessons.nextWeek")}
            >
              <ChevronRight
                className="size-4 rtl:rotate-180"
                aria-hidden="true"
              />
            </OutlineButton>
          </SurfaceCard>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            {weekDays.map((day) => {
              const items = lessons.data.filter(
                (lesson) => localDayKey(lesson.dateTime) === localDayKey(day),
              );
              return (
                <section
                  key={localDayKey(day)}
                  className="min-w-0 rounded-2xl border border-cream-200 bg-white p-4 shadow-sm transition-all duration-300 hover:border-primary-200 hover:shadow-md"
                >
                  <h2 className="border-b border-cream-200 pb-3 text-center text-sm font-bold text-espresso">
                    {formatDate(day.toISOString(), locale, {
                      weekday: "short",
                      day: "numeric",
                    })}
                  </h2>
                  <div className="mt-4 space-y-3">
                    {items.length ? (
                      items.map((lesson) => (
                        <button
                          key={lesson.id}
                          type="button"
                          onClick={() =>
                            lesson.analysisId
                              ? navigate(`/analysis/${lesson.analysisId}`)
                              : undefined
                          }
                          className="w-full rounded-xl border border-cream-200 bg-cream-50/50 p-3 text-start transition-all duration-200 hover:border-primary-300 hover:bg-white hover:shadow-sm"
                        >
                          <span className="block text-xs font-bold text-primary-700">
                            {new Intl.DateTimeFormat(locale, {
                              hour: "numeric",
                              minute: "2-digit",
                            }).format(new Date(lesson.dateTime))}
                          </span>
                          <span className="mt-1 block truncate text-sm font-semibold text-espresso">
                            {t(`lessons.types.${lesson.type}`)}
                          </span>
                          <span className="mt-1 block truncate text-xs text-text-secondary">
                            {lesson.trainerName}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="py-5 text-center text-xs text-text-secondary">
                        {t("lessons.noLessonsDay")}
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      <Modal
        open={bookingOpen}
        title={t("lessons.bookingTitle")}
        description={t("lessons.bookingDescription")}
        onClose={closeBooking}
        footer={
          <>
            <OutlineButton
              type="button"
              onClick={closeBooking}
              disabled={bookingAction.submitting}
            >
              {t("common.cancel")}
            </OutlineButton>
            <PrimaryButton
              type="submit"
              form="book-lesson-form"
              disabled={
                bookingAction.submitting ||
                !booking.trainerId ||
                !booking.dateTime ||
                trainers.loading
              }
            >
              {bookingAction.submitting ? (
                <BusyLabel label={t("lessons.bookingProgress")} />
              ) : (
                t("lessons.requestLesson")
              )}
            </PrimaryButton>
          </>
        }
      >
        <form
          id="book-lesson-form"
          className="space-y-5"
          onSubmit={submitBooking}
        >
          {bookingAction.error ? (
            <ErrorState message={bookingAction.error} />
          ) : null}
          {trainers.error ? <ErrorState message={trainers.error} /> : null}

          <div>
            <label className={labelClass} htmlFor="lesson-trainer">
              {t("lessons.trainer")}
            </label>
            <select
              id="lesson-trainer"
              className={fieldClass}
              value={booking.trainerId}
              onChange={(event) =>
                setBooking((current) => ({
                  ...current,
                  trainerId: event.target.value,
                }))
              }
              required
              disabled={trainers.loading}
            >
              <option value="">
                {trainers.loading
                  ? t("common.loading")
                  : t("lessons.selectTrainer")}
              </option>
              {trainerItems.map((trainer) => (
                <option key={trainer.id} value={trainer.id}>
                  {trainer.name}
                </option>
              ))}
            </select>
            {!trainers.loading &&
            !trainers.error &&
            trainerItems.length === 0 ? (
              <p className="mt-2 text-xs text-warning-700">
                {t("lessons.noTrainers")}
              </p>
            ) : null}
          </div>

          <div>
            <label className={labelClass} htmlFor="lesson-horse">
              {t("lessons.horse")}
            </label>
            <select
              id="lesson-horse"
              className={fieldClass}
              value={booking.horseId ?? ""}
              onChange={(event) =>
                setBooking((current) => ({
                  ...current,
                  horseId: event.target.value || null,
                }))
              }
              disabled={horses.loading}
            >
              <option value="">{t("lessons.noHorseSelected")}</option>
              {horseItems.map((horse) => (
                <option key={horse.id} value={horse.id}>
                  {horse.name}
                </option>
              ))}
            </select>
            {horses.error ? (
              <p className="mt-2 text-xs text-error-700">{horses.error}</p>
            ) : null}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="lesson-type">
                {t("lessons.lessonType")}
              </label>
              <select
                id="lesson-type"
                className={fieldClass}
                value={booking.type}
                onChange={(event) =>
                  setBooking((current) => ({
                    ...current,
                    type: event.target.value as LessonType,
                  }))
                }
              >
                {lessonTypes.map((type) => (
                  <option key={type} value={type}>
                    {t(`lessons.types.${type}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="lesson-duration">
                {t("lessons.duration")}
              </label>
              <select
                id="lesson-duration"
                className={fieldClass}
                value={booking.durationMin}
                onChange={(event) =>
                  setBooking((current) => ({
                    ...current,
                    durationMin: Number(
                      event.target.value,
                    ) as BookLessonInput["durationMin"],
                  }))
                }
              >
                {lessonDurations.map((duration) => (
                  <option key={duration} value={duration}>
                    {t("lessons.minutes", { count: duration })}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="lesson-date-time">
              {t("lessons.dateTime")}
            </label>
            <input
              id="lesson-date-time"
              type="datetime-local"
              className={fieldClass}
              min={localDateTimeValue(new Date())}
              value={booking.dateTime}
              onChange={(event) =>
                setBooking((current) => ({
                  ...current,
                  dateTime: event.target.value,
                }))
              }
              required
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="lesson-notes">
              {t("lessons.notes")}
            </label>
            <textarea
              id="lesson-notes"
              className={`${fieldClass} min-h-28 resize-y`}
              value={booking.notes ?? ""}
              onChange={(event) =>
                setBooking((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder={t("lessons.notesPlaceholder")}
            />
          </div>
        </form>
      </Modal>

      <LessonCloseoutModal
        lesson={closeoutLesson}
        competencies={competencyItems}
        open={Boolean(closeoutLesson)}
        onClose={() => setCloseoutLesson(null)}
        onSaved={() => {
          setSuccess(t("lessons.development.saved"));
          setFilter("past");
          setView("list");
          lessons.refetch();
        }}
      />
    </section>
  );
}
