import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Crown,
  Gauge,
  Sparkles,
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
  ProgressMeter,
  StatusBadge,
  SurfaceCard,
  formatCurrency,
  formatDate,
} from "@/components/EquiVistaUI";
import {
  useCurrentMembership,
  useManageMembership,
  useMembershipPlans,
} from "@/hooks/use-membership";
import type { MembershipPlan } from "@/hooks/types";

type Confirmation =
  | { action: "upgrade"; plan: MembershipPlan }
  | { action: "cancel" }
  | null;

function usagePercent(used: number, allowed: number) {
  if (allowed <= 0) return 0;
  return (used / allowed) * 100;
}

export default function MembershipPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const plans = useMembershipPlans();
  const current = useCurrentMembership();
  const manage = useManageMembership();
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [success, setSuccess] = useState("");

  const choosePlan = (plan: MembershipPlan) => {
    setSuccess("");
    if (!current.data) {
      navigate(`/payments/checkout?plan=${encodeURIComponent(plan.id)}`);
      return;
    }
    if (current.data.planName !== plan.name) {
      setConfirmation({ action: "upgrade", plan });
    }
  };

  const confirmAction = async () => {
    if (!confirmation) return;
    const completed =
      confirmation.action === "upgrade"
        ? await manage.upgrade(confirmation.plan.id)
        : await manage.cancel();
    if (!completed) return;

    setSuccess(
      t(
        confirmation.action === "upgrade"
          ? "membership.upgradeSuccess"
          : "membership.cancelSuccess",
      ),
    );
    setConfirmation(null);
    current.refetch();
  };

  if (plans.loading || current.loading) return <PageSkeleton cards={3} />;

  const pageError = plans.error || current.error;

  return (
    <section>
      <PageHeader
        eyebrow={t("membership.eyebrow")}
        title={t("membership.title")}
        description={t("membership.description")}
      />

      {success ? (
        <div
          className="mb-5 rounded-xl border border-success-500/25 bg-success-50 px-4 py-3 text-sm font-semibold text-success-700"
          role="status"
        >
          {success}
        </div>
      ) : null}

      {pageError ? (
        <ErrorState message={pageError} />
      ) : (
        <>
          {current.data?.status === "past_due" ? (
            <div
              className="mb-5 flex flex-col gap-4 rounded-2xl border border-error-500/25 bg-error-50 p-5 sm:flex-row sm:items-center sm:justify-between"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-error-500" aria-hidden="true" />
                <div>
                  <p className="font-bold text-error-700">
                    {t("membership.pastDueTitle")}
                  </p>
                  <p className="mt-1 text-sm text-error-700">
                    {t("membership.pastDueDescription")}
                  </p>
                </div>
              </div>
              <OutlineButton
                type="button"
                className="border-error-500/30 text-error-700"
                onClick={() => navigate("/payments")}
              >
                {t("membership.updatePayment")}
              </OutlineButton>
            </div>
          ) : null}

          {current.data ? (
            <SurfaceCard className="mb-8 overflow-hidden">
              <div className="border-b border-cream-200 bg-cream-50 p-6 sm:p-7">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-4">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-500 text-white">
                      <Crown className="size-6" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-700">
                        {t("membership.currentPlan")}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <h2 className="text-2xl text-espresso">
                          {current.data.planName}
                        </h2>
                        <StatusBadge
                          status={current.data.status}
                          label={t(`status.${current.data.status}`)}
                        />
                      </div>
                      <p className="mt-2 flex items-center gap-2 text-sm text-text-secondary">
                        <CalendarClock className="size-4 text-primary-500" aria-hidden="true" />
                        {current.data.renewsAt
                          ? t("membership.renewsOn", {
                              date: formatDate(current.data.renewsAt, locale, {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              }),
                            })
                          : t("membership.renewalUnavailable")}
                      </p>
                    </div>
                  </div>
                  <OutlineButton
                    type="button"
                    className="text-error-700"
                    onClick={() => {
                      setSuccess("");
                      setConfirmation({ action: "cancel" });
                    }}
                    disabled={manage.working}
                  >
                    {t("membership.cancelMembership")}
                  </OutlineButton>
                </div>
              </div>
              <div className="grid gap-6 p-6 sm:grid-cols-2 sm:p-7">
                <ProgressMeter
                  value={usagePercent(
                    current.data.lessonsUsed,
                    current.data.lessonsAllowed,
                  )}
                  label={t("membership.lessonsUsage", {
                    used: current.data.lessonsUsed,
                    total: current.data.lessonsAllowed,
                  })}
                />
                <ProgressMeter
                  value={usagePercent(
                    current.data.analysesUsed,
                    current.data.analysesAllowed,
                  )}
                  label={t("membership.analysesUsage", {
                    used: current.data.analysesUsed,
                    total: current.data.analysesAllowed,
                  })}
                />
              </div>
            </SurfaceCard>
          ) : (
            <SurfaceCard className="mb-8">
              <EmptyState
                icon={Sparkles}
                title={t("membership.noPlanTitle")}
                description={t("membership.noPlanDescription")}
                compact
              />
            </SurfaceCard>
          )}

          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
              {t("membership.plansEyebrow")}
            </p>
            <h2 className="mt-2 text-2xl text-espresso sm:text-3xl">
              {t("membership.plansTitle")}
            </h2>
          </div>

          {plans.data.length === 0 ? (
            <SurfaceCard>
              <EmptyState
                icon={Gauge}
                title={t("membership.emptyPlansTitle")}
                description={t("membership.emptyPlansDescription")}
              />
            </SurfaceCard>
          ) : (
            <div className="grid gap-5 lg:grid-cols-3">
              {plans.data.map((plan) => {
                const isCurrent = current.data?.planName === plan.name;
                return (
                  <article
                    key={plan.id}
                    className={`relative flex min-h-full flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                      plan.highlighted
                        ? "border-2 border-primary-500"
                        : "border-cream-200"
                    }`}
                  >
                    {plan.highlighted ? (
                      <span className="absolute end-4 top-4 rounded-full bg-primary-500 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-white">
                        {t("membership.mostPopular")}
                      </span>
                    ) : null}
                    <div className={plan.highlighted ? "pe-24" : ""}>
                      <h3 className="text-2xl text-espresso">{plan.name}</h3>
                      <p className="mt-3 text-3xl font-bold text-espresso">
                        {formatCurrency(plan.price, plan.currency, locale)}
                        <span className="ms-1 text-sm font-medium text-text-secondary">
                          / {t(`membership.intervals.${plan.interval}`)}
                        </span>
                      </p>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-cream-50 p-3 text-center">
                      <div>
                        <p className="font-serif text-xl text-espresso">
                          {plan.lessonsPerMonth}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {t("membership.lessonsPerMonth")}
                        </p>
                      </div>
                      <div className="border-s border-cream-200 ps-3">
                        <p className="font-serif text-xl text-espresso">
                          {plan.analysesPerMonth}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {t("membership.analysesPerMonth")}
                        </p>
                      </div>
                    </div>

                    <ul className="my-6 flex-1 space-y-3">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2.5 text-sm text-text-secondary">
                          <Check className="mt-0.5 size-4 shrink-0 text-primary-600" aria-hidden="true" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {isCurrent ? (
                      <OutlineButton type="button" disabled className="w-full">
                        {t("membership.currentPlanButton")}
                      </OutlineButton>
                    ) : (
                      <PrimaryButton
                        type="button"
                        className="w-full"
                        onClick={() => choosePlan(plan)}
                        disabled={manage.working}
                      >
                        {current.data
                          ? t("membership.upgradeTo", { plan: plan.name })
                          : t("membership.choosePlan", { plan: plan.name })}
                      </PrimaryButton>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {manage.error ? (
        <div className="mt-5">
          <ErrorState message={manage.error} />
        </div>
      ) : null}

      <Modal
        open={confirmation !== null}
        title={
          confirmation?.action === "upgrade"
            ? t("membership.confirmUpgradeTitle")
            : t("membership.confirmCancelTitle")
        }
        description={
          confirmation?.action === "upgrade"
            ? t("membership.confirmUpgradeDescription", {
                plan: confirmation.plan.name,
              })
            : t("membership.confirmCancelDescription")
        }
        onClose={() => {
          if (!manage.working) setConfirmation(null);
        }}
        footer={
          <>
            <OutlineButton
              type="button"
              onClick={() => setConfirmation(null)}
              disabled={manage.working}
            >
              {t("common.cancel")}
            </OutlineButton>
            <PrimaryButton
              type="button"
              onClick={confirmAction}
              disabled={manage.working}
              className={confirmation?.action === "cancel" ? "bg-error-500 hover:bg-error-600" : ""}
            >
              {manage.working ? (
                <BusyLabel label={t("common.working")} />
              ) : confirmation?.action === "upgrade" ? (
                t("membership.confirmUpgrade")
              ) : (
                t("membership.confirmCancel")
              )}
            </PrimaryButton>
          </>
        }
      >
        <div className="rounded-xl border border-warning-500/25 bg-warning-50 p-4 text-sm leading-6 text-warning-700">
          {confirmation?.action === "upgrade"
            ? t("membership.upgradeConsequence")
            : t("membership.cancelConsequence")}
        </div>
      </Modal>
    </section>
  );
}
