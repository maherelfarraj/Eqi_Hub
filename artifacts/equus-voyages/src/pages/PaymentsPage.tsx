import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  EmptyState,
  ErrorState,
  Modal,
  OutlineButton,
  PageHeader,
  PageSkeleton,
  PrimaryButton,
  SurfaceCard,
  fieldClass,
  formatCurrency,
  labelClass,
} from "@/components/EquiVistaUI";
import {
  useCheckout,
  usePaymentMethods,
} from "@/hooks/use-payments";
import type { PaymentMethod } from "@/hooks/types";

function methodName(method: PaymentMethod, fallback: string) {
  return method.brand?.trim() || fallback;
}

export default function PaymentsPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isCheckout = location.pathname.endsWith("/checkout");
  const planId = isCheckout ? searchParams.get("plan") : null;

  return isCheckout ? <CheckoutView planId={planId} /> : <SavedMethodsView />;
}

function SavedMethodsView() {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = usePaymentMethods();
  const [providerOpen, setProviderOpen] = useState(false);

  const methods = data ?? [];

  if (loading) return <PageSkeleton cards={3} />;
  if (error) {
    return (
      <ErrorState
        message={error}
        retryLabel={t("common.retry")}
        onRetry={refetch}
      />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={t("payments.eyebrow")}
        title={t("payments.title")}
        description={t("payments.description")}
        actions={
          <PrimaryButton type="button" onClick={() => setProviderOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            {t("payments.addMethod")}
          </PrimaryButton>
        }
      />

      <ProviderBoundary />

      <SurfaceCard className="mt-6 overflow-hidden">
        <div className="border-b border-cream-200 px-5 py-4 sm:px-6">
          <h2 className="font-serif text-xl text-espresso">
            {t("payments.savedMethods")}
          </h2>
        </div>

        {methods.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title={t("payments.emptyTitle")}
            description={t("payments.emptyDescription")}
            compact
            action={
              <OutlineButton
                type="button"
                onClick={() => setProviderOpen(true)}
              >
                <Plus className="size-4" aria-hidden="true" />
                {t("payments.addMethod")}
              </OutlineButton>
            }
          />
        ) : (
          <div className="divide-y divide-cream-200">
            {methods.map((method) => (
              <div
                key={method.id}
                className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                    <CreditCard className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold capitalize text-espresso">
                        {methodName(method, t("payments.card"))}
                      </p>
                      <p className="text-sm text-text-secondary">
                        {t("payments.cardEnding", {
                          last4: method.last4 ?? "••••",
                        })}
                      </p>
                      {method.isDefault ? (
                        <span className="rounded-full bg-success-50 px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-[0.08em] text-success-700">
                          {t("payments.default")}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-text-secondary">
                      {t("payments.expires", {
                        month: method.expMonth
                          ? String(method.expMonth).padStart(2, "0")
                          : "—",
                        year: method.expYear ?? "—",
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 sm:justify-end">
                  {!method.isDefault ? (
                    <OutlineButton
                      type="button"
                      disabled
                    >
                      <CheckCircle2 className="size-4" aria-hidden="true" />
                      {t("payments.setDefault")}
                    </OutlineButton>
                  ) : null}
                  <OutlineButton
                    type="button"
                    disabled
                    className="text-error-600 hover:border-error-500/40 hover:bg-error-50"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    {t("payments.remove")}
                  </OutlineButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>

      <ProviderModal
        open={providerOpen}
        onClose={() => setProviderOpen(false)}
      />
    </>
  );
}

function CheckoutView({ planId }: { planId: string | null }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const {
    data: methodsData,
    loading: methodsLoading,
    error: methodsError,
    refetch: refetchMethods,
  } = usePaymentMethods();
  const {
    data: checkout,
    loading: checkoutLoading,
    error: checkoutError,
  } = useCheckout(planId);
  const [selectedMethodId, setSelectedMethodId] = useState("");
  const [providerOpen, setProviderOpen] = useState(false);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const methods = methodsData ?? [];

  const selected =
    selectedMethodId || methods.find((method) => method.isDefault)?.id || "";

  const price = checkout?.plan.price ?? 0;
  const discountPct = checkout?.appliedPromo?.discountPct ?? 0;
  const discount = (price * discountPct) / 100;
  const total = Math.max(0, price - discount);

  if (methodsLoading || checkoutLoading) return <PageSkeleton cards={2} />;
  if (methodsError || checkoutError) {
    return (
      <ErrorState
        message={methodsError ?? checkoutError ?? t("common.error")}
        retryLabel={methodsError ? t("common.retry") : undefined}
        onRetry={methodsError ? refetchMethods : undefined}
      />
    );
  }

  if (!planId || !checkout) {
    return (
      <SurfaceCard>
        <EmptyState
          icon={CreditCard}
          title={t("payments.invalidPlanTitle")}
          description={t("payments.invalidPlanDescription")}
          action={
            <PrimaryButton
              type="button"
              onClick={() => navigate("/membership")}
            >
              <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
              {t("payments.backToMembership")}
            </PrimaryButton>
          }
        />
      </SurfaceCard>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={t("payments.eyebrow")}
        title={t("payments.checkoutTitle")}
        description={t("payments.checkoutDescription")}
      />

      <ProviderBoundary />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <SurfaceCard className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-serif text-xl text-espresso">
                {t("payments.choosePaymentMethod")}
              </h2>
              <LockKeyhole
                className="size-5 text-primary-600"
                aria-hidden="true"
              />
            </div>

            {methods.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title={t("payments.emptyTitle")}
                description={t("payments.checkoutEmptyDescription")}
                compact
                action={
                  <OutlineButton
                    type="button"
                    onClick={() => setProviderOpen(true)}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    {t("payments.addMethod")}
                  </OutlineButton>
                }
              />
            ) : (
              <fieldset className="mt-5 space-y-3">
                <legend className="sr-only">
                  {t("payments.choosePaymentMethod")}
                </legend>
                {methods.map((method) => (
                  <label
                    key={method.id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-cream-200 p-4 transition-colors hover:border-primary-300 has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50"
                  >
                    <input
                      type="radio"
                      name="payment-method"
                      value={method.id}
                      checked={selected === method.id}
                      onChange={() => setSelectedMethodId(method.id)}
                      className="size-4 accent-primary-500"
                    />
                    <CreditCard
                      className="size-5 shrink-0 text-primary-600"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold capitalize text-espresso">
                        {methodName(method, t("payments.card"))} ·{" "}
                        {method.last4 ?? "••••"}
                      </span>
                      <span className="mt-0.5 block text-xs text-text-secondary">
                        {t("payments.expires", {
                          month: method.expMonth
                            ? String(method.expMonth).padStart(2, "0")
                            : "—",
                          year: method.expYear ?? "—",
                        })}
                      </span>
                    </span>
                    {method.isDefault ? (
                      <span className="text-xs font-bold text-success-700">
                        {t("payments.default")}
                      </span>
                    ) : null}
                  </label>
                ))}
              </fieldset>
            )}
          </SurfaceCard>

          <SurfaceCard className="p-5 sm:p-6">
            <form onSubmit={(event) => event.preventDefault()}>
              <label htmlFor="promo-code" className={labelClass}>
                {t("payments.promoCode")}
              </label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  id="promo-code"
                  type="text"
                  value=""
                  readOnly
                  placeholder={t("payments.promoPlaceholder")}
                  className={`${fieldClass} mt-0 flex-1`}
                  disabled
                />
                <OutlineButton
                  type="submit"
                  disabled
                >
                  {t("payments.providerUnavailable")}
                </OutlineButton>
              </div>
              {checkout.appliedPromo ? (
                <p className="mt-2 text-xs font-semibold text-success-700">
                  {t("payments.promoApplied", {
                    code: checkout.appliedPromo.code,
                  })}
                </p>
              ) : null}
            </form>
          </SurfaceCard>
        </div>

        <SurfaceCard className="h-fit p-5 sm:p-6">
          <h2 className="font-serif text-xl text-espresso">
            {t("payments.orderSummary")}
          </h2>
          <div className="mt-5 border-b border-cream-200 pb-5">
            <p className="font-semibold text-espresso">{checkout.plan.name}</p>
            <p className="mt-1 text-sm text-text-secondary">
              {t("payments.billingCycle", {
                interval: t(`payments.interval.${checkout.plan.interval}`),
              })}
            </p>
          </div>
          <dl className="space-y-3 py-5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-text-secondary">{t("payments.subtotal")}</dt>
              <dd className="font-semibold text-espresso">
                {formatCurrency(price, checkout.plan.currency, locale)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-text-secondary">{t("payments.discount")}</dt>
              <dd className="font-semibold text-success-700">
                −{formatCurrency(discount, checkout.plan.currency, locale)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-cream-200 pt-4">
              <dt className="font-bold text-espresso">{t("payments.total")}</dt>
              <dd className="font-serif text-xl text-espresso">
                {formatCurrency(total, checkout.plan.currency, locale)}
              </dd>
            </div>
          </dl>
          <PrimaryButton
            type="button"
            disabled
            className="w-full"
          >
            <LockKeyhole className="size-4" aria-hidden="true" />
            {t("payments.providerUnavailable")}
          </PrimaryButton>
          {!selected ? (
            <p className="mt-2 text-center text-xs text-warning-700">
              {t("payments.selectMethod")}
            </p>
          ) : null}
          <p className="mt-4 text-center text-xs leading-5 text-text-secondary">
            {t("payments.checkoutUnavailable")}
          </p>
        </SurfaceCard>
      </div>

      <ProviderModal
        open={providerOpen}
        onClose={() => setProviderOpen(false)}
      />
    </>
  );
}

function ProviderBoundary() {
  const { t } = useTranslation();

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-warning-500/25 bg-warning-50 p-4 text-sm text-warning-700">
      <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-bold">{t("payments.secureBoundaryTitle")}</p>
        <p className="mt-1 leading-6">
          {t("payments.secureBoundaryDescription")}
        </p>
      </div>
    </div>
  );
}

function ProviderModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Modal
      open={open}
      title={t("payments.providerUnavailableTitle")}
      description={t("payments.providerUnavailableDescription")}
      onClose={onClose}
      footer={
        <PrimaryButton type="button" onClick={onClose}>
          {t("common.confirm")}
        </PrimaryButton>
      }
    >
      <div className="flex items-start gap-3 rounded-xl border border-primary-200 bg-primary-50 p-4 text-sm leading-6 text-primary-700">
        <LockKeyhole className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        {t("payments.providerUnavailable")}
      </div>
    </Modal>
  );
}
