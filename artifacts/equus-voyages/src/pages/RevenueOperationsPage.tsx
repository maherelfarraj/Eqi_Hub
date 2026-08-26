import { useTranslation } from "react-i18next";
import {
  ErrorState, formatCalendarDate, formatCurrency,
  MetricCard, PageHeader, PageSkeleton, SurfaceCard, StatusBadge
} from "@/components/EquiVistaUI";
import { useBatch8Operations } from "@/hooks/use-batch8-operations";
import { Wallet, ShieldAlert, TrendingUp, AlertCircle, AlertTriangle, Users, CalendarClock, Receipt } from "lucide-react";

export default function RevenueOperationsPage() {
  const { t, i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? i18n.language) === "ar" ? "ar-JO" : "en-US";

  const { data, loading, error, enabled, refetch } = useBatch8Operations('revenue');

  if (!enabled) {
    return (
      <div className="animate-in fade-in duration-500">
        <PageHeader
          eyebrow={t("revenueOperations.eyebrow")}
          title={t("revenueOperations.title")}
          description={t("revenueOperations.description")}
        />
        <SurfaceCard className="mt-8 p-12 text-center border-dashed border-2 border-cream-300 bg-cream-50/50">
          <ShieldAlert className="size-10 mx-auto text-primary-400 mb-4" strokeWidth={1.5} />
          <h3 className="text-xl font-serif text-espresso">{t("revenueOperations.disabledTitle")}</h3>
          <p className="mt-2 max-w-md mx-auto text-sm text-text-secondary leading-relaxed">
            {t("revenueOperations.disabledDescription")}
          </p>
        </SurfaceCard>
      </div>
    );
  }

  if (loading) return <PageSkeleton cards={4} />;
  if (error) return <ErrorState message={error} onRetry={refetch} retryLabel={t("common.tryAgain")} />;
  if (!data) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        eyebrow={t("revenueOperations.eyebrow")}
        title={t("revenueOperations.title")}
        description={t("revenueOperations.description")}
      />

      {data.summaries.map((summary) => (
        <section key={summary.currency} aria-labelledby={`revenue-${summary.currency}`}>
          <h2
            id={`revenue-${summary.currency}`}
            className="mb-4 font-serif text-2xl text-espresso"
          >
            {t("revenueOperations.snapshotTitle", {
              currency: summary.currency,
            })}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={TrendingUp}
              label={t("revenueOperations.metrics.collected")}
              value={formatCurrency(summary.collectedThisPeriod / 100, summary.currency, locale)}
            />
            <MetricCard
              icon={Receipt}
              label={t("revenueOperations.metrics.outstanding")}
              value={formatCurrency(summary.outstanding / 100, summary.currency, locale)}
            />
            <MetricCard
              icon={AlertCircle}
              label={t("revenueOperations.metrics.overdue")}
              value={formatCurrency(summary.overdue / 100, summary.currency, locale)}
              detail={<span className="text-error-600 font-medium flex items-center gap-1.5"><AlertTriangle className="size-3" /> {t("revenueOperations.metrics.highRisk")}: {summary.highRiskRenewals}</span>}
            />
            <MetricCard
              icon={Users}
              label={t("revenueOperations.metrics.activeMemberships")}
              value={summary.activeMemberships}
              detail={<span className="text-text-secondary">{summary.renewalsNext30Days} {t("revenueOperations.metrics.renewals")}</span>}
            />
          </div>
        </section>
      ))}

      {data.summaries.length === 0 && (
        <SurfaceCard className="p-8 text-center">
          <Wallet className="mx-auto size-8 text-primary-400" />
          <p className="mt-3 text-sm text-text-secondary">
            {t("revenueOperations.noSnapshots")}
          </p>
        </SurfaceCard>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <SurfaceCard className="p-6 flex flex-col">
          <div className="flex items-center gap-4 mb-6 pb-4 border-b border-cream-200">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-error-50 text-error-600 border border-error-100">
              <AlertTriangle className="size-6" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-2xl text-espresso font-serif">
                {t("revenueOperations.collections.title")}
              </h2>
              <p className="text-sm text-text-secondary mt-1">
                {t("revenueOperations.collections.description")}
              </p>
            </div>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {data.collections.map((c) => (
              <div key={c.invoiceNumber} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-cream-200 bg-white hover:border-cream-300 transition-colors">
                <div>
                  <p className="font-bold text-espresso">{c.riderName}</p>
                  <p className="text-xs font-mono text-text-secondary mt-1 tracking-tight">
                    {t("revenueOperations.collections.invoice")} {c.invoiceNumber}
                  </p>
                </div>
                <div className="mt-3 sm:mt-0 flex flex-col sm:items-end gap-1">
                  <p className="font-serif text-lg text-error-700">
                    {formatCurrency(c.amount / 100, c.currency, locale)}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-error-500">{c.daysOverdue} {t("revenueOperations.collections.daysOverdue")}</span>
                    <StatusBadge
                      status={c.status}
                      label={t(`revenueOperations.collections.statuses.${c.status}`)}
                    />
                  </div>
                </div>
              </div>
            ))}
            {data.collections.length === 0 && (
              <p className="text-sm text-text-secondary py-8 text-center">{t("common.empty")}</p>
            )}
          </div>
        </SurfaceCard>

        <SurfaceCard className="p-6 flex flex-col">
          <div className="flex items-center gap-4 mb-6 pb-4 border-b border-cream-200">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600 border border-primary-100">
              <CalendarClock className="size-6" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-2xl text-espresso font-serif">
                {t("revenueOperations.pipeline.title")}
              </h2>
              <p className="text-sm text-text-secondary mt-1">
                {t("revenueOperations.pipeline.description")}
              </p>
            </div>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {data.renewals.map((r, i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-cream-200 bg-white hover:border-cream-300 transition-colors">
                <div>
                  <p className="font-bold text-espresso">{r.riderName}</p>
                  <p className="text-xs font-medium text-text-secondary mt-1">{r.packageName}</p>
                  <p className="text-xs text-text-secondary mt-1.5 flex items-center gap-1.5">
                    <CalendarClock className="size-3.5" />
                    {t("revenueOperations.pipeline.date")}: {formatCalendarDate(r.renewalDate, locale)}
                  </p>
                </div>
                <div className="mt-3 sm:mt-0 flex flex-col sm:items-end gap-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-wider ${
                    r.riskLevel === 'high' ? 'bg-error-50 text-error-700 border border-error-200/50' :
                    r.riskLevel === 'medium' ? 'bg-warning-50 text-warning-700 border border-warning-200/50' :
                    'bg-success-50 text-success-700 border border-success-200/50'
                  }`}>
                    {t(`revenueOperations.riskLevels.${r.riskLevel}`)}
                  </span>
                  {r.reason && (
                    <span className="text-xs text-text-secondary text-right max-w-[200px] truncate" title={r.reason}>
                      {t(`revenueOperations.reasons.${r.reason}`, {
                        defaultValue: r.reason,
                      })}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {data.renewals.length === 0 && (
              <p className="text-sm text-text-secondary py-8 text-center">{t("common.empty")}</p>
            )}
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
