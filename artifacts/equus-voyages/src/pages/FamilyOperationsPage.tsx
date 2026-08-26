import { useTranslation } from "react-i18next";
import {
  EmptyState, ErrorState, formatCalendarDate, formatCurrency,
  PageHeader, PageSkeleton, SurfaceCard, StatusBadge
} from "@/components/EquiVistaUI";
import { useBatch8Operations } from "@/hooks/use-batch8-operations";
import { ShieldAlert, Users, CalendarClock } from "lucide-react";

export default function FamilyOperationsPage() {
  const { t, i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? i18n.language) === "ar" ? "ar-JO" : "en-US";

  const { data, loading, error, enabled, refetch } = useBatch8Operations('family');

  if (!enabled) {
    return (
      <div className="animate-in fade-in duration-500">
        <PageHeader
          eyebrow={t("familyOperations.eyebrow")}
          title={t("familyOperations.title")}
          description={t("familyOperations.description")}
        />
        <SurfaceCard className="mt-8 p-12 text-center border-dashed border-2 border-cream-300 bg-cream-50/50">
          <ShieldAlert className="size-10 mx-auto text-primary-400 mb-4" strokeWidth={1.5} />
          <h3 className="text-xl font-serif text-espresso">{t("familyOperations.disabledTitle")}</h3>
          <p className="mt-2 max-w-md mx-auto text-sm text-text-secondary leading-relaxed">
            {t("familyOperations.disabledDescription")}
          </p>
        </SurfaceCard>
      </div>
    );
  }

  if (loading) return <PageSkeleton cards={2} />;
  if (error) return <ErrorState message={error} onRetry={refetch} retryLabel={t("common.tryAgain")} />;
  if (!data) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        eyebrow={t("familyOperations.eyebrow")}
        title={t("familyOperations.title")}
        description={t("familyOperations.description")}
      />

      {data.familySummary.balances.length > 0 && (
        <section aria-labelledby="family-balance-heading">
          <h2
            id="family-balance-heading"
            className="mb-4 font-serif text-2xl text-espresso"
          >
            {t("familyOperations.familySummary")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.familySummary.balances.map((balance) => (
              <SurfaceCard key={balance.currency} className="p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-primary-600">
                  {balance.currency}
                </p>
                <p className="mt-2 font-serif text-2xl text-espresso">
                  {formatCurrency(
                    balance.outstandingBalance / 100,
                    balance.currency,
                    locale,
                  )}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {t("familyOperations.outstanding")}
                </p>
                {balance.overdueAmount > 0 && (
                  <p className="mt-3 text-sm font-semibold text-error-700">
                    {t("familyOperations.overdue")}:{" "}
                    {formatCurrency(
                      balance.overdueAmount / 100,
                      balance.currency,
                      locale,
                    )}
                  </p>
                )}
                {balance.nextPaymentDate && (
                  <p className="mt-2 text-xs text-text-secondary">
                    {t("familyOperations.nextPayment")}:{" "}
                    {formatCalendarDate(balance.nextPaymentDate, locale)}
                  </p>
                )}
              </SurfaceCard>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {data.riders.map((rider) => (
          <SurfaceCard key={rider.id} className="p-6 transition-shadow hover:shadow-md">
            <div className="flex items-start justify-between border-b border-cream-200 pb-4 mb-4">
              <div className="flex items-center gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-primary-200 bg-primary-50 text-primary-600">
                  <Users className="size-5" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-espresso">{rider.name}</h3>
                  <p className="text-xs font-medium text-text-secondary mt-0.5 capitalize">
                    {t(`familyOperations.relationships.${rider.relationship}`)} • {t(`familyOperations.statuses.${rider.relationshipStatus}`)}
                  </p>
                </div>
              </div>
              <StatusBadge status={rider.membershipStatus} label={t(`familyOperations.statuses.${rider.membershipStatus}`)} />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center rounded-lg bg-cream-50/50 px-3 py-2">
                <span className="text-sm font-medium text-text-secondary">{t("familyOperations.package")}</span>
                <span className="text-sm font-bold text-espresso">{rider.packageName}</span>
              </div>
              <div className="flex justify-between items-center rounded-lg bg-cream-50/50 px-3 py-2">
                <span className="text-sm font-medium text-text-secondary">{t("familyOperations.credits")}</span>
                <span className="text-sm font-bold text-espresso">{rider.creditsRemaining}</span>
              </div>
              {rider.waitlistCount > 0 && (
                <div className="flex justify-between items-center rounded-lg bg-warning-50 px-3 py-2 border border-warning-200/50">
                  <span className="text-sm font-medium text-warning-700">{t("familyOperations.waitlist")}</span>
                  <span className="text-sm font-bold text-warning-700">{rider.waitlistCount}</span>
                </div>
              )}
              {rider.renewalDate && (
                <div className="flex justify-between items-center rounded-lg bg-cream-50/50 px-3 py-2">
                  <span className="text-sm font-medium text-text-secondary">{t("familyOperations.renewal")}</span>
                  <div className="flex items-center gap-1.5">
                    <CalendarClock className="size-3.5 text-primary-500" />
                    <span className="text-sm font-bold text-espresso">{formatCalendarDate(rider.renewalDate, locale)}</span>
                  </div>
                </div>
              )}

              {!rider.financialAccess && (
                <div className="rounded-lg border border-cream-200 bg-cream-50 px-3 py-2 text-sm text-text-secondary">
                  {t("familyOperations.financialRestricted")}
                </div>
              )}

              {rider.financials.map((financial) => (
                <div
                  key={financial.currency}
                  className="mt-5 border-t border-cream-200 pt-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <span className="block text-xs font-bold uppercase tracking-wider text-primary-600">
                        {financial.currency} · {t("familyOperations.outstanding")}
                      </span>
                      <span className="mt-1 block font-serif text-xl text-espresso">
                        {formatCurrency(
                          financial.outstandingBalance / 100,
                          financial.currency,
                          locale,
                        )}
                      </span>
                      {financial.overdueAmount > 0 && (
                        <span className="mt-1 block text-sm font-semibold text-error-700">
                          {t("familyOperations.overdue")}:{" "}
                          {formatCurrency(
                            financial.overdueAmount / 100,
                            financial.currency,
                            locale,
                          )}
                        </span>
                      )}
                    </div>
                    <div className="max-w-xs text-end">
                      <span className="block text-xs font-bold text-text-secondary">
                        {t("familyOperations.paymentStatus")}:{" "}
                        {t(
                          `familyOperations.statuses.${financial.paymentLinkStatus}`,
                          { defaultValue: financial.paymentLinkStatus },
                        )}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-text-secondary">
                        {t("familyOperations.nonProcessingNotice")}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SurfaceCard>
        ))}

        {data.riders.length === 0 && (
          <div className="lg:col-span-2">
            <EmptyState
              icon={Users}
              title={t("familyOperations.noRiders")}
              description=""
            />
          </div>
        )}
      </div>
    </div>
  );
}
