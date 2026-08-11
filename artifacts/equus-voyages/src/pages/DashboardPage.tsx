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
  CalendarDays,
  Circle,
  CreditCard,
  Heart,
  ReceiptText,
  Sparkles,
  Upload,
  Video,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
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
import { useDashboardSummary } from "@/hooks/use-dashboard";

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useDashboardSummary();
  const locale = (i18n.resolvedLanguage ?? i18n.language) === "ar" ? "ar-JO" : "en-US";

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState message={error} retryLabel={t("common.tryAgain")} onRetry={refetch} />;
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
  const firstName = data.user.name.trim().split(/\s+/)[0] || t("dashboard.rider");

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
          detail={data.upcomingLessons[0] ? formatDate(data.upcomingLessons[0].dateTime, locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : t("dashboard.noneScheduled")}
        />
        <MetricCard
          icon={CreditCard}
          label={t("dashboard.membership")}
          value={data.activeMembership?.planName ?? t("dashboard.noPlan")}
          detail={data.activeMembership ? <StatusBadge status={data.activeMembership.status} /> : t("dashboard.explorePlans")}
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
          value={formatCurrency(data.outstandingBalance.amount, data.outstandingBalance.currency, locale)}
          detail={t("dashboard.invoiceCount", { count: data.outstandingBalance.invoiceCount })}
        />
      </div>

      {isNew ? (
        <SurfaceCard className="mt-6 overflow-hidden">
          <div className="border-b border-cream-200 bg-primary-50 px-6 py-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-700">{t("dashboard.onboardingEyebrow")}</p>
            <h2 className="mt-1 text-2xl text-espresso">{t("dashboard.onboardingTitle")}</h2>
          </div>
          <div className="grid gap-3 p-6 sm:grid-cols-3">
            {[
              { icon: Circle, label: t("dashboard.addHorse"), path: "/horses?add=1" },
              { icon: Circle, label: t("dashboard.choosePlan"), path: "/membership" },
              { icon: Circle, label: t("dashboard.uploadFirstRide"), path: "/analysis?upload=1" },
            ].map((item) => (
              <button key={item.path} type="button" onClick={() => navigate(item.path)} className="flex items-center gap-3 rounded-xl border border-cream-200 p-4 text-start transition-colors hover:border-primary-300 hover:bg-primary-50">
                <span className="flex size-9 items-center justify-center rounded-full bg-cream-100 text-primary-600">
                  <item.icon className="size-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-bold text-espresso">{item.label}</span>
              </button>
            ))}
          </div>
        </SurfaceCard>
      ) : null}

      <SurfaceCard className="mt-6 p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-2xl text-espresso">{t("dashboard.progressTitle")}</h2>
            <p className="mt-1 text-sm text-text-secondary">{t("dashboard.progressDescription")}</p>
          </div>
          <OutlineButton onClick={() => navigate("/progress")} className="min-h-9 px-3 py-2">
            {t("common.viewAll")}
          </OutlineButton>
        </div>
        {data.progressTrend.length ? (
          <div className="h-72" aria-label={t("dashboard.progressTitle")}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.progressTrend} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#B08A2E" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#B08A2E" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#EAE1D3" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(value) => formatDate(String(value), locale, { month: "short", day: "numeric" })} tick={{ fill: "#8A7A68", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "#8A7A68", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip labelFormatter={(value) => formatDate(String(value), locale)} contentStyle={{ border: "1px solid #EAE1D3", borderRadius: 12, color: "#3B2C20" }} />
                <Area type="monotone" dataKey="score" stroke="#B08A2E" strokeWidth={3} fill="url(#scoreFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState compact icon={Sparkles} title={t("dashboard.noProgressTitle")} description={t("dashboard.noProgressDescription")} />
        )}
      </SurfaceCard>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SurfaceCard className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-cream-200 px-5 py-4">
            <h2 className="text-xl text-espresso">{t("dashboard.nextLessons")}</h2>
            <button type="button" onClick={() => navigate("/lessons")} className="text-sm font-bold text-primary-600 hover:text-primary-700">{t("common.viewAll")}</button>
          </div>
          {data.upcomingLessons.length ? (
            <div className="divide-y divide-cream-200">
              {data.upcomingLessons.map((lesson) => (
                <button key={lesson.id} type="button" onClick={() => navigate("/lessons")} className="flex w-full items-center gap-4 px-5 py-4 text-start hover:bg-cream-50">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><CalendarDays className="size-5" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-espresso">{lesson.discipline}</span>
                    <span className="block truncate text-sm text-text-secondary">{lesson.trainerName}{lesson.horseName ? ` · ${lesson.horseName}` : ""}</span>
                  </span>
                  <span className="text-end text-xs font-semibold text-text-secondary">{formatDate(lesson.dateTime, locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState compact icon={CalendarDays} title={t("dashboard.noLessonsTitle")} description={t("dashboard.noLessonsDescription")} />
          )}
        </SurfaceCard>

        <SurfaceCard className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-cream-200 px-5 py-4">
            <h2 className="text-xl text-espresso">{t("dashboard.recentAnalyses")}</h2>
            <button type="button" onClick={() => navigate("/analysis")} className="text-sm font-bold text-primary-600 hover:text-primary-700">{t("common.viewAll")}</button>
          </div>
          {data.recentAnalyses.length ? (
            <div className="divide-y divide-cream-200">
              {data.recentAnalyses.map((analysis) => (
                <button key={analysis.id} type="button" onClick={() => navigate(`/analysis/${analysis.id}`)} className="flex w-full items-center gap-4 px-5 py-4 text-start hover:bg-cream-50">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cream-100 text-primary-600"><Video className="size-5" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-espresso">{analysis.title}</span>
                    <span className="block truncate text-sm text-text-secondary">{analysis.horseName ?? t("dashboard.noHorse")} · {formatDate(analysis.createdAt, locale)}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1.5">
                    <StatusBadge status={analysis.status} />
                    {analysis.score !== null ? <span className="font-serif text-lg text-primary-700">{analysis.score}</span> : null}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState compact icon={Video} title={t("dashboard.noAnalysesTitle")} description={t("dashboard.noAnalysesDescription")} />
          )}
        </SurfaceCard>
      </div>
    </div>
  );
}
