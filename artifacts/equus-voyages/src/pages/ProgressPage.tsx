import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  Award,
  CalendarRange,
  ChartNoAxesCombined,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  EmptyState,
  ErrorState,
  formatDate,
  MetricCard,
  PageHeader,
  PageSkeleton,
  StatusBadge,
  SurfaceCard,
} from "@/components/EquiVistaUI";
import { RiderSyncDashboard } from "@/components/RiderSyncDashboard";
import { useProgressMetrics, useSessionHistory } from "@/hooks/use-progress";

type Period = 30 | 90 | 365;

export default function ProgressPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>(90);
  const metricsQuery = useProgressMetrics(period);
  const historyQuery = useSessionHistory();
  const locale = (i18n.resolvedLanguage ?? i18n.language) === "ar" ? "ar-JO" : "en-US";

  if (metricsQuery.loading && historyQuery.loading) return <PageSkeleton />;

  const metrics = metricsQuery.data;
  const sessions = historyQuery.data ?? [];
  const chartError = metricsQuery.error;
  const historyError = historyQuery.error;
  const improvementPositive = (metrics?.improvementPct ?? 0) >= 0;

  return (
    <div>
      <PageHeader
        eyebrow={t("progress.eyebrow")}
        title={t("progress.title")}
        description={t("progress.description")}
        actions={
          <div className="inline-flex w-full rounded-xl border border-cream-200 bg-cream-50/50 p-1 shadow-inner sm:w-auto" role="tablist" aria-label={t("progress.period") }>
            {([30, 90, 365] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={period === value}
                onClick={() => setPeriod(value)}
                className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold transition-all duration-200 sm:flex-none ${period === value ? "bg-primary-600 text-white shadow-sm" : "text-text-secondary hover:bg-white hover:text-espresso"}`}
              >
                {t(`progress.period${value}`)}
              </button>
            ))}
          </div>
        }
      />

      <RiderSyncDashboard />

      {chartError ? <div className="mt-6"><ErrorState message={chartError} /></div> : null}

      {metricsQuery.loading ? (
        <PageSkeleton cards={4} />
      ) : metrics ? (
        <>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={Target} label={t("progress.averageScore")} value={metrics.averageScore.toFixed(1)} detail={t("progress.outOf100")} />
            <MetricCard
              icon={improvementPositive ? TrendingUp : TrendingDown}
              label={t("progress.improvement")}
              value={<span className={improvementPositive ? "text-success-700" : "text-error-700"}>{improvementPositive ? "+" : ""}{metrics.improvementPct.toFixed(1)}%</span>}
              detail={t("progress.overPeriod")}
            />
            <MetricCard icon={Activity} label={t("progress.sessions")} value={metrics.sessionsCount} detail={t("progress.analyzedRides")} />
            <MetricCard icon={Award} label={t("progress.topDiscipline")} value={metrics.topDiscipline ?? t("common.notAvailable")} detail={t("progress.mostPracticed")} />
          </div>

          <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-2">
            <SurfaceCard className="min-w-0 p-5 transition-all duration-300 hover:border-primary-200 hover:shadow-md sm:p-6">
              <h2 className="font-serif text-2xl text-espresso">{t("progress.scoreTrend")}</h2>
              <p className="mt-1 text-sm text-text-secondary">{t("progress.scoreTrendDescription")}</p>
              {metrics.scoreOverTime.length ? (
                <div className="mt-5 h-72" aria-label={t("progress.scoreTrend")}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metrics.scoreOverTime} margin={{ top: 10, right: 12, left: -22, bottom: 0 }}>
                      <CartesianGrid stroke="#EAE1D3" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={(value) => formatDate(String(value), locale, { month: "short", day: "numeric" })} tick={{ fill: "#8A7A68", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fill: "#8A7A68", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip labelFormatter={(value) => formatDate(String(value), locale)} contentStyle={{ border: "1px solid #EAE1D3", borderRadius: 12, color: "#3B2C20", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                      <Line type="monotone" dataKey="score" stroke="#2b6045" strokeWidth={3} dot={{ fill: "#2b6045", strokeWidth: 0, r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState compact icon={ChartNoAxesCombined} title={t("progress.noScoresTitle")} description={t("progress.noScoresDescription")} />
              )}
            </SurfaceCard>

            <SurfaceCard className="min-w-0 p-5 transition-all duration-300 hover:border-primary-200 hover:shadow-md sm:p-6">
              <h2 className="font-serif text-2xl text-espresso">{t("progress.categoryScores")}</h2>
              <p className="mt-1 text-sm text-text-secondary">{t("progress.categoryDescription")}</p>
              {metrics.categoryScores.length ? (
                <div className="mt-5 h-72" aria-label={t("progress.categoryScores")}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.categoryScores} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                      <CartesianGrid stroke="#EAE1D3" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="category" tick={{ fill: "#8A7A68", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fill: "#8A7A68", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ border: "1px solid #EAE1D3", borderRadius: 12, color: "#3B2C20", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} cursor={{ fill: '#f6f3eb' }} />
                      <Bar dataKey="score" fill="#2b6045" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState compact icon={Target} title={t("progress.noCategoriesTitle")} description={t("progress.noCategoriesDescription")} />
              )}
            </SurfaceCard>
          </div>

        </>
      ) : (
        <EmptyState icon={ChartNoAxesCombined} title={t("progress.emptyTitle")} description={t("progress.emptyDescription")} />
      )}

      <SurfaceCard className="mt-6 overflow-hidden transition-all duration-300 hover:border-primary-200 hover:shadow-md">
        <div className="border-b border-cream-200 px-5 py-4 sm:px-6">
          <h2 className="font-serif text-2xl text-espresso">{t("progress.sessionHistory")}</h2>
          <p className="mt-1 text-sm text-text-secondary">{t("progress.sessionDescription")}</p>
        </div>
        {historyError ? <div className="p-5"><ErrorState message={historyError} /></div> : historyQuery.loading ? (
          <div className="space-y-3 p-5" role="status">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-cream-100" />)}</div>
        ) : sessions.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-start text-sm">
              <thead className="bg-cream-50 text-xs uppercase tracking-[0.08em] text-text-secondary">
                <tr>
                  <th className="px-5 py-3 text-start font-bold">{t("common.date")}</th>
                  <th className="px-5 py-3 text-start font-bold">{t("progress.horse")}</th>
                  <th className="px-5 py-3 text-start font-bold">{t("progress.discipline")}</th>
                  <th className="px-5 py-3 text-start font-bold">{t("progress.score")}</th>
                  <th className="px-5 py-3 text-start font-bold">{t("common.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {sessions.map((session) => (
                    <tr
                      key={session.id}
                      onClick={() => navigate(`/analysis/${session.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          navigate(`/analysis/${session.id}`);
                        }
                      }}
                      tabIndex={0}
                      role="link"
                      aria-label={t("progress.openSession", {
                        date: formatDate(session.date, locale),
                      })}
                      className="cursor-pointer transition-colors hover:bg-cream-50 focus:bg-cream-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                    >
                    <td className="px-5 py-4 font-semibold text-espresso">{formatDate(session.date, locale)}</td>
                    <td className="px-5 py-4 text-text-secondary">{session.horseName ?? t("common.notAvailable")}</td>
                    <td className="px-5 py-4 text-text-secondary">{session.discipline}</td>
                    <td className="px-5 py-4 font-serif text-lg text-primary-700">{session.score ?? "—"}</td>
                    <td className="px-5 py-4"><StatusBadge status={session.status} label={t(`status.${session.status}`)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState compact icon={CalendarRange} title={t("progress.noSessionsTitle")} description={t("progress.noSessionsDescription")} />
        )}
      </SurfaceCard>
    </div>
  );
}
