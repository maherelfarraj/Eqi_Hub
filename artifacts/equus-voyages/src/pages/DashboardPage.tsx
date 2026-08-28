import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  CreditCard,
  Clock3,
  GraduationCap,
  Heart,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  UsersRound,
  Video,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router-dom";
import {
  EmptyState,
  ErrorState,
  formatCurrency,
  formatDate,
  MetricCard,
  OutlineButton,
  PageHeader,
  PageSkeleton,
  PrimaryButton,
  StatusBadge,
  SurfaceCard,
} from "@/components/EquiVistaUI";
import { RiderSyncDashboard } from "@/components/RiderSyncDashboard";
import { useAuth } from "@/contexts/AuthContext";
import { useCompetitionDevelopmentAccess } from "@/hooks/use-competition-development";
import { useDashboardSummary } from "@/hooks/use-dashboard";
import { useLessons } from "@/hooks/use-lessons";
import { useOrganizationMembers } from "@/hooks/use-organization";
import { useProfile } from "@/hooks/use-profile";
import type { Lesson } from "@/hooks/types";
import { resolvePortalPersona } from "@/lib/portal-persona";

export default function DashboardPage() {
  const { activeOrganization } = useAuth();
  const persona = resolvePortalPersona(activeOrganization?.roles);

  if (persona === "guardian") return <Navigate to="/guardian" replace />;
  if (persona === "academy_admin") return <AcademyAdminDashboard />;
  if (
    activeOrganization?.roles.includes("coach") ||
    activeOrganization?.roles.includes("trainer")
  ) {
    return <CoachDashboard />;
  }
  return <RiderDashboard />;
}

function AcademyAdminDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeOrganization } = useAuth();
  const { data, loading, error, refetch } = useOrganizationMembers(
    activeOrganization?.id,
  );

  if (loading) return <PageSkeleton />;
  if (error) {
    return (
      <ErrorState
        message={error}
        retryLabel={t("common.tryAgain")}
        onRetry={refetch}
      />
    );
  }

  const members = data ?? [];
  const countRole = (role: string) =>
    members.filter((member) => member.roles.includes(role)).length;

  return (
    <div>
      <PageHeader
        eyebrow={t("dashboard.academyAdmin.eyebrow")}
        title={t("dashboard.academyAdmin.title", {
          organization: activeOrganization?.name ?? t("app.name"),
        })}
        description={t("dashboard.academyAdmin.description")}
        actions={
          <>
            <PrimaryButton className="w-full sm:w-auto" onClick={() => navigate("/organization")}>
              <Users className="size-4" aria-hidden="true" />
              {t("dashboard.academyAdmin.manageMembers")}
            </PrimaryButton>
            <OutlineButton className="w-full sm:w-auto" onClick={() => navigate("/lessons")}>
              <CalendarDays className="size-4" aria-hidden="true" />
              {t("dashboard.academyAdmin.reviewLessons")}
            </OutlineButton>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Building2}
          label={t("dashboard.academyAdmin.activeMembers")}
          value={members.filter((member) => member.status === "active").length}
          detail={t("dashboard.academyAdmin.membersDetail")}
        />
        <MetricCard
          icon={GraduationCap}
          label={t("dashboard.academyAdmin.riders")}
          value={countRole("rider")}
          detail={t("dashboard.academyAdmin.ridersDetail")}
        />
        <MetricCard
          icon={Users}
          label={t("dashboard.academyAdmin.coaches")}
          value={countRole("coach")}
          detail={t("dashboard.academyAdmin.coachesDetail")}
        />
        <MetricCard
          icon={ShieldCheck}
          label={t("dashboard.academyAdmin.guardians")}
          value={countRole("guardian")}
          detail={t("dashboard.academyAdmin.guardiansDetail")}
        />
      </div>

      <SurfaceCard className="mt-6 p-5 sm:p-6">
        <h2 className="text-2xl text-espresso">
          {t("dashboard.academyAdmin.operationsTitle")}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
          {t("dashboard.academyAdmin.operationsDescription")}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <OutlineButton onClick={() => navigate("/organization")}>
            {t("dashboard.academyAdmin.openAccessControl")}
          </OutlineButton>
          <OutlineButton onClick={() => navigate("/billing")}>
            {t("dashboard.academyAdmin.openBilling")}
          </OutlineButton>
        </div>
      </SurfaceCard>
    </div>
  );
}

function CoachDashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const upcoming = useLessons("upcoming");
  const requests = useLessons("requests");
  const profile = useProfile();
  const competitionAccess = useCompetitionDevelopmentAccess();
  const locale =
    (i18n.resolvedLanguage ?? i18n.language) === "ar" ? "ar-JO" : "en-US";

  if (upcoming.loading || requests.loading || profile.loading) {
    return <PageSkeleton cards={4} />;
  }

  const error = upcoming.error ?? requests.error ?? profile.error;
  if (error) {
    return (
      <ErrorState
        message={error}
        retryLabel={t("common.tryAgain")}
        onRetry={() => {
          upcoming.refetch();
          requests.refetch();
          profile.refetch();
        }}
      />
    );
  }

  const lessonItems = upcoming.data ?? [];
  const requestItems = requests.data ?? [];
  const activeRiders = new Set(
    [...lessonItems, ...requestItems].map((lesson) => lesson.riderId),
  ).size;
  const todayKey = new Date().toLocaleDateString("en-CA");
  const todayLessons = lessonItems.filter(
    (lesson) =>
      new Date(lesson.dateTime).toLocaleDateString("en-CA") === todayKey,
  );
  const firstName =
    profile.data?.fullName.trim().split(/\s+/)[0] ||
    t("dashboard.coach.defaultName");
  const canOpenDevelopment = Boolean(
    competitionAccess.data?.canManage || competitionAccess.data?.canView,
  );

  return (
    <div>
      <PageHeader
        eyebrow={t("dashboard.coach.eyebrow")}
        title={t("dashboard.coach.title", { name: firstName })}
        description={t("dashboard.coach.description")}
        actions={
          <>
            <PrimaryButton onClick={() => navigate("/lessons")}>
              <CalendarDays className="size-4" aria-hidden="true" />
              {t("dashboard.coach.openSchedule")}
            </PrimaryButton>
            <OutlineButton onClick={() => navigate("/video-review")}>
              <Video className="size-4" aria-hidden="true" />
              {t("dashboard.coach.reviewVideo")}
            </OutlineButton>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={CalendarDays}
          label={t("dashboard.coach.todayLessons")}
          value={todayLessons.length}
          detail={t("dashboard.coach.todayLessonsDetail")}
        />
        <MetricCard
          icon={Clock3}
          label={t("dashboard.coach.upcoming")}
          value={lessonItems.length}
          detail={t("dashboard.coach.upcomingDetail")}
        />
        <MetricCard
          icon={UsersRound}
          label={t("dashboard.coach.activeRiders")}
          value={activeRiders}
          detail={t("dashboard.coach.activeRidersDetail")}
        />
        <MetricCard
          icon={ClipboardCheck}
          label={t("dashboard.coach.requests")}
          value={requestItems.length}
          detail={t("dashboard.coach.requestsDetail")}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <SurfaceCard className="overflow-hidden">
          <div className="flex items-start justify-between gap-4 border-b border-cream-200 px-5 py-5 sm:px-6">
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-primary-600">
                {t("dashboard.coach.scheduleEyebrow")}
              </p>
              <h2 className="mt-1 font-serif text-2xl text-espresso">
                {t("dashboard.coach.scheduleTitle")}
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                {t("dashboard.coach.scheduleDescription")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/lessons")}
              className="hidden items-center gap-1 text-sm font-bold text-primary-700 hover:text-primary-900 sm:inline-flex"
            >
              {t("common.viewAll")}
              <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
            </button>
          </div>
          <div className="divide-y divide-cream-200">
            {lessonItems.length ? (
              lessonItems.slice(0, 5).map((lesson) => (
                <CoachLessonRow key={lesson.id} lesson={lesson} locale={locale} />
              ))
            ) : (
              <EmptyState
                compact
                icon={CalendarDays}
                title={t("dashboard.coach.noLessonsTitle")}
                description={t("dashboard.coach.noLessonsDescription")}
                action={
                  <OutlineButton onClick={() => navigate("/lessons")}>
                    {t("dashboard.coach.openSchedule")}
                  </OutlineButton>
                }
              />
            )}
          </div>
        </SurfaceCard>

        <SurfaceCard className="overflow-hidden">
          <div className="border-b border-cream-200 px-5 py-5">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-primary-600">
              {t("dashboard.coach.requestsEyebrow")}
            </p>
            <h2 className="mt-1 font-serif text-2xl text-espresso">
              {t("dashboard.coach.requestsTitle")}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {t("dashboard.coach.requestsDescription")}
            </p>
          </div>
          <div className="space-y-3 p-5">
            {requestItems.length ? (
              requestItems.slice(0, 4).map((lesson) => (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => navigate("/lessons")}
                  className="flex w-full items-center gap-3 rounded-xl border border-cream-200 p-3 text-start transition-colors hover:border-primary-300 hover:bg-primary-50"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning-50 text-warning-700">
                    <Clock3 className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-espresso">
                      {lesson.riderName}
                    </span>
                    <span className="block truncate text-xs text-text-secondary">
                      {t(`lessons.types.${lesson.type}`)} ·{" "}
                      {formatDate(lesson.dateTime, locale, {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-primary-500 rtl:-scale-x-100" aria-hidden="true" />
                </button>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-cream-300 bg-cream-50 px-4 py-8 text-center">
                <CheckCircle2 className="mx-auto size-7 text-primary-500" aria-hidden="true" />
                <p className="mt-3 font-serif text-lg text-espresso">
                  {t("dashboard.coach.noRequestsTitle")}
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  {t("dashboard.coach.noRequestsDescription")}
                </p>
              </div>
            )}
          </div>
        </SurfaceCard>
      </div>

      {canOpenDevelopment ? (
        <SurfaceCard className="mt-6 flex flex-col gap-4 bg-primary-900 p-5 text-cream-50 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-primary-300">
              {t("dashboard.coach.focusEyebrow")}
            </p>
            <h2 className="mt-1 font-serif text-2xl text-white">
              {t("dashboard.coach.focusTitle")}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-primary-100">
              {t("dashboard.coach.focusDescription")}
            </p>
          </div>
          <OutlineButton
            className="border-primary-600 bg-primary-800 text-cream-50 hover:border-primary-400 hover:bg-primary-700 hover:text-white"
            onClick={() => navigate("/competition-development")}
          >
            {t("dashboard.coach.openDevelopment")}
            <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
          </OutlineButton>
        </SurfaceCard>
      ) : null}
    </div>
  );
}

function CoachLessonRow({
  lesson,
  locale,
}: {
  lesson: Lesson;
  locale: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-4 px-5 py-4 sm:px-6">
      <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-primary-50 px-2 py-2 text-center">
        <span className="text-xs font-bold uppercase tracking-wide text-primary-700">
          {formatDate(lesson.dateTime, locale, { weekday: "short" })}
        </span>
        <span className="font-serif text-xl text-primary-900">
          {formatDate(lesson.dateTime, locale, { day: "numeric" })}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-espresso">
          {lesson.riderName}
        </p>
        <p className="mt-1 truncate text-sm text-text-secondary">
          {t(`lessons.types.${lesson.type}`)}
          {lesson.horseName ? ` · ${lesson.horseName}` : ""}
        </p>
      </div>
      <div className="hidden shrink-0 text-end sm:block">
        <p className="font-semibold text-espresso">
          {formatDate(lesson.dateTime, locale, {
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
        <StatusBadge status={lesson.status} label={t(`status.${lesson.status}`)} />
      </div>
    </div>
  );
}

function RiderDashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useDashboardSummary();
  const locale =
    (i18n.resolvedLanguage ?? i18n.language) === "ar" ? "ar-JO" : "en-US";

  if (loading) return <PageSkeleton />;
  if (error)
    return (
      <ErrorState
        message={error}
        retryLabel={t("common.tryAgain")}
        onRetry={refetch}
      />
    );
  if (!data) {
    return (
      <EmptyState
        icon={Sparkles}
        title={t("dashboard.emptyTitle")}
        description={t("dashboard.emptyDescription")}
      />
    );
  }

  const isNew =
    data.horsesCount === 0 &&
    data.upcomingLessons.length === 0 &&
    data.recentAnalyses.length === 0 &&
    !data.activeMembership;
  const firstName =
    data.user.name.trim().split(/\s+/)[0] || t("dashboard.rider");

  return (
    <div>
      <PageHeader
        eyebrow={formatDate(new Date().toISOString(), locale, {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
        title={t("dashboard.greeting", { name: firstName })}
        description={t("dashboard.description")}
        actions={
          <>
            <PrimaryButton onClick={() => navigate("/analysis?upload=1")}>
              <Upload className="size-4" aria-hidden="true" />
              {t("dashboard.uploadVideo")}
            </PrimaryButton>
            <OutlineButton onClick={() => navigate("/lessons?book=1")}>
              <CalendarDays className="size-4" aria-hidden="true" />
              {t("dashboard.bookLesson")}
            </OutlineButton>
            <OutlineButton onClick={() => navigate("/billing")}>
              <ReceiptText className="size-4" aria-hidden="true" />
              {t("dashboard.viewInvoices")}
            </OutlineButton>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={CalendarDays}
          label={t("dashboard.upcomingLessons")}
          value={data.upcomingLessons.length}
          detail={
            data.upcomingLessons[0]
              ? formatDate(data.upcomingLessons[0].dateTime, locale, {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })
              : t("dashboard.noneScheduled")
          }
        />
        <MetricCard
          icon={CreditCard}
          label={t("dashboard.membership")}
          value={data.activeMembership?.planName ?? t("dashboard.noPlan")}
          detail={
            data.activeMembership ? (
              <StatusBadge status={data.activeMembership.status} />
            ) : (
              t("dashboard.explorePlans")
            )
          }
        />
        <MetricCard
          icon={Heart}
          label={t("dashboard.horses")}
          value={data.horsesCount}
          detail={t("dashboard.inStable")}
        />
        <MetricCard
          icon={ReceiptText}
          label={t("dashboard.outstanding")}
          value={formatCurrency(
            data.outstandingBalance.amount,
            data.outstandingBalance.currency,
            locale,
          )}
          detail={t("dashboard.invoiceCount", {
            count: data.outstandingBalance.invoiceCount,
          })}
        />
      </div>

      {isNew ? (
        <SurfaceCard className="mt-6 overflow-hidden">
          <div className="border-b border-cream-200 bg-primary-50 px-6 py-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-700">
              {t("dashboard.onboardingEyebrow")}
            </p>
            <h2 className="mt-1 text-2xl text-espresso">
              {t("dashboard.onboardingTitle")}
            </h2>
          </div>
          <div className="grid gap-3 p-6 sm:grid-cols-3">
            {[
              {
                icon: Circle,
                label: t("dashboard.addHorse"),
                path: "/horses?add=1",
              },
              {
                icon: Circle,
                label: t("dashboard.choosePlan"),
                path: "/membership",
              },
              {
                icon: Circle,
                label: t("dashboard.uploadFirstRide"),
                path: "/analysis?upload=1",
              },
            ].map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className="flex items-center gap-3 rounded-xl border border-cream-200 p-4 text-start transition-colors hover:border-primary-300 hover:bg-primary-50"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-cream-100 text-primary-600">
                  <item.icon className="size-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-bold text-espresso">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </SurfaceCard>
      ) : null}

      <div className="mt-6">
        <RiderSyncDashboard compact onOpen={() => navigate("/progress")} />
      </div>

      <SurfaceCard className="mt-6 p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl text-espresso">
              {t("dashboard.progressTitle")}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {t("dashboard.progressDescription")}
            </p>
          </div>
            <OutlineButton
              className="min-h-9 w-full px-3 py-2 sm:w-auto"
              onClick={() => navigate("/progress")}
            >
            {t("common.viewAll")}
          </OutlineButton>
        </div>
        {data.progressTrend.length ? (
          <div className="h-72" aria-label={t("dashboard.progressTitle")}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.progressTrend}
                margin={{ top: 10, right: 10, left: -22, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#B08A2E" stopOpacity={0.3} />
                    <stop
                      offset="100%"
                      stopColor="#B08A2E"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="#EAE1D3"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) =>
                    formatDate(String(value), locale, {
                      month: "short",
                      day: "numeric",
                    })
                  }
                  tick={{ fill: "#8A7A68", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: "#8A7A68", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  labelFormatter={(value) => formatDate(String(value), locale)}
                  contentStyle={{
                    border: "1px solid #EAE1D3",
                    borderRadius: 12,
                    color: "#3B2C20",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="#B08A2E"
                  strokeWidth={3}
                  fill="url(#scoreFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState
            compact
            icon={Sparkles}
            title={t("dashboard.noProgressTitle")}
            description={t("dashboard.noProgressDescription")}
          />
        )}
      </SurfaceCard>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SurfaceCard className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-cream-200 px-5 py-4">
            <h2 className="text-xl text-espresso">
              {t("dashboard.nextLessons")}
            </h2>
            <button
              type="button"
              onClick={() => navigate("/lessons")}
              className="text-sm font-bold text-primary-600 hover:text-primary-700"
            >
              {t("common.viewAll")}
            </button>
          </div>
          {data.upcomingLessons.length ? (
            <div className="divide-y divide-cream-200">
              {data.upcomingLessons.map((lesson) => (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => navigate("/lessons")}
                  className="flex w-full items-center gap-3 px-5 py-4 text-start transition-colors hover:bg-cream-50 sm:gap-4"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                    <CalendarDays className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-espresso">
                      {lesson.discipline}
                    </span>
                    <span className="block truncate text-sm text-text-secondary">
                      {lesson.trainerName}
                      {lesson.horseName ? ` · ${lesson.horseName}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-end text-xs font-semibold text-text-secondary">
                    {formatDate(lesson.dateTime, locale, {
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              compact
              icon={CalendarDays}
              title={t("dashboard.noLessonsTitle")}
              description={t("dashboard.noLessonsDescription")}
            />
          )}
        </SurfaceCard>

        <SurfaceCard className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-cream-200 px-5 py-4">
            <h2 className="text-xl text-espresso">
              {t("dashboard.recentAnalyses")}
            </h2>
            <button
              type="button"
              onClick={() => navigate("/analysis")}
              className="text-sm font-bold text-primary-600 hover:text-primary-700"
            >
              {t("common.viewAll")}
            </button>
          </div>
          {data.recentAnalyses.length ? (
            <div className="divide-y divide-cream-200">
              {data.recentAnalyses.map((analysis) => (
                <button
                  key={analysis.id}
                  type="button"
                  onClick={() => navigate(`/analysis/${analysis.id}`)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-start hover:bg-cream-50"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cream-100 text-primary-600">
                    <Video className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-espresso">
                      {analysis.title}
                    </span>
                    <span className="block truncate text-sm text-text-secondary">
                      {analysis.horseName ?? t("dashboard.noHorse")} ·{" "}
                      {formatDate(analysis.createdAt, locale)}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1.5">
                    <StatusBadge status={analysis.status} label={t(`status.${analysis.status}`)} />
                    {analysis.score !== null ? (
                      <span className="font-serif text-lg text-primary-700">
                        {analysis.score}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              compact
              icon={Video}
              title={t("dashboard.noAnalysesTitle")}
              description={t("dashboard.noAnalysesDescription")}
            />
          )}
        </SurfaceCard>
      </div>
    </div>
  );
}
