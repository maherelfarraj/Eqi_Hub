import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CalendarClock,
  CircleDollarSign,
  Download,
  FileText,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  EmptyState,
  ErrorState,
  MetricCard,
  Modal,
  OutlineButton,
  PageHeader,
  PageSkeleton,
  PrimaryButton,
  StatusBadge,
  SurfaceCard,
  formatCurrency,
  formatDate,
} from "@/components/EquiVistaUI";
import { useInvoice, useInvoices } from "@/hooks/use-billing";
import type { Invoice, InvoiceStatus } from "@/hooks/types";

type InvoiceFilter = "all" | InvoiceStatus;

const filters: InvoiceFilter[] = ["all", "paid", "open", "overdue", "void"];

export default function BillingPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { data, loading, error } = useInvoices();
  const [filter, setFilter] = useState<InvoiceFilter>("all");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const invoices = data ?? [];

  const summary = useMemo(() => {
    const outstandingInvoices = invoices.filter(
      (invoice) => invoice.status === "open" || invoice.status === "overdue",
    );
    const outstandingCurrency = outstandingInvoices[0]?.currency ?? "USD";
    const outstanding = {
      amount: outstandingInvoices
        .filter((invoice) => invoice.currency === outstandingCurrency)
        .reduce((total, invoice) => total + invoice.amount, 0),
      currency: outstandingCurrency,
    };

    const now = new Date();
    const paidThisMonthInvoices = invoices.filter((invoice) => {
      if (invoice.status !== "paid") return false;
      const issueDate = new Date(invoice.issueDate);
      return (
        !Number.isNaN(issueDate.getTime()) &&
        issueDate.getFullYear() === now.getFullYear() &&
        issueDate.getMonth() === now.getMonth()
      );
    });
    const paidCurrency = paidThisMonthInvoices[0]?.currency ?? "USD";
    const paidThisMonth = {
      amount: paidThisMonthInvoices
        .filter((invoice) => invoice.currency === paidCurrency)
        .reduce((total, invoice) => total + invoice.amount, 0),
      currency: paidCurrency,
    };

    const nextPayment = [...invoices]
      .filter(
        (invoice) =>
          (invoice.status === "open" || invoice.status === "overdue") &&
          Boolean(invoice.dueDate),
      )
      .sort((left, right) =>
        String(left.dueDate).localeCompare(String(right.dueDate)),
      )[0];

    return { outstanding, paidThisMonth, nextPayment };
  }, [invoices]);

  const visibleInvoices = useMemo(
    () =>
      filter === "all"
        ? invoices
        : invoices.filter((invoice) => invoice.status === filter),
    [filter, invoices],
  );

  const overdueCount = invoices.filter(
    (invoice) => invoice.status === "overdue",
  ).length;

  if (loading) return <PageSkeleton cards={3} />;
  if (error) return <ErrorState message={error} />;

  return (
    <>
      <PageHeader
        eyebrow={t("billing.eyebrow")}
        title={t("billing.title")}
        description={t("billing.description")}
      />

      {overdueCount > 0 ? (
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-error-500/25 bg-error-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold text-error-700">
              {t("billing.overdueTitle", { count: overdueCount })}
            </p>
            <p className="mt-1 text-sm text-error-700">
              {t("billing.overdueDescription")}
            </p>
          </div>
          <PrimaryButton type="button" onClick={() => navigate("/payments")}>
            {t("billing.payNow")}
          </PrimaryButton>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          icon={CircleDollarSign}
          label={t("billing.outstanding")}
          value={formatCurrency(
            summary.outstanding.amount,
            summary.outstanding.currency,
            locale,
          )}
          detail={t("billing.openInvoiceCount", {
            count: invoices.filter(
              (invoice) =>
                invoice.status === "open" || invoice.status === "overdue",
            ).length,
          })}
        />
        <MetricCard
          icon={WalletCards}
          label={t("billing.paidThisMonth")}
          value={formatCurrency(
            summary.paidThisMonth.amount,
            summary.paidThisMonth.currency,
            locale,
          )}
        />
        <MetricCard
          icon={CalendarClock}
          label={t("billing.nextPayment")}
          value={
            summary.nextPayment
              ? formatCurrency(
                  summary.nextPayment.amount,
                  summary.nextPayment.currency,
                  locale,
                )
              : t("billing.noPaymentDue")
          }
          detail={
            summary.nextPayment
              ? formatDate(summary.nextPayment.dueDate, locale)
              : t("billing.accountCurrent")
          }
        />
      </div>

      <SurfaceCard className="mt-6 overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-cream-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="font-serif text-xl text-espresso">
              {t("billing.invoiceHistory")}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {t("billing.invoiceHistoryDescription")}
            </p>
          </div>
          <div
            className="flex flex-wrap gap-2"
            aria-label={t("billing.filterLabel")}
          >
            {filters.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={filter === item}
                onClick={() => setFilter(item)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize transition-colors ${
                  filter === item
                    ? "bg-primary-500 text-white"
                    : "bg-cream-100 text-text-secondary hover:bg-primary-50 hover:text-primary-700"
                }`}
              >
                {t(`billing.filters.${item}`)}
              </button>
            ))}
          </div>
        </div>

        {invoices.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title={t("billing.emptyTitle")}
            description={t("billing.emptyDescription")}
            compact
          />
        ) : visibleInvoices.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={t("billing.filteredEmptyTitle")}
            description={t("billing.filteredEmptyDescription")}
            compact
            action={
              <OutlineButton type="button" onClick={() => setFilter("all")}>
                {t("billing.clearFilter")}
              </OutlineButton>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-start text-sm">
              <thead className="bg-cream-50 text-xs uppercase tracking-[0.08em] text-text-secondary">
                <tr>
                  <th className="px-6 py-3 text-start">
                    {t("billing.number")}
                  </th>
                  <th className="px-4 py-3 text-start">{t("billing.date")}</th>
                  <th className="px-4 py-3 text-start">
                    {t("billing.descriptionColumn")}
                  </th>
                  <th className="px-4 py-3 text-start">
                    {t("billing.amount")}
                  </th>
                  <th className="px-4 py-3 text-start">
                    {t("billing.status")}
                  </th>
                  <th className="px-6 py-3 text-end">
                    {t("billing.download")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {visibleInvoices.map((invoice) => (
                  <InvoiceRow
                    key={invoice.id}
                    invoice={invoice}
                    locale={locale}
                    onOpen={() => setSelectedInvoiceId(invoice.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>

      <InvoiceDetailModal
        invoiceId={selectedInvoiceId}
        locale={locale}
        onClose={() => setSelectedInvoiceId(undefined)}
      />
    </>
  );
}

function InvoiceRow({
  invoice,
  locale,
  onOpen,
}: {
  invoice: Invoice;
  locale: string;
  onOpen: () => void;
}) {
  const { t } = useTranslation();

  return (
    <tr className="transition-colors hover:bg-cream-50/70">
      <td className="px-6 py-4">
        <button
          type="button"
          onClick={onOpen}
          className="font-bold text-primary-700 hover:underline"
        >
          {invoice.number}
        </button>
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-text-secondary">
        {formatDate(invoice.issueDate, locale)}
      </td>
      <td className="max-w-xs truncate px-4 py-4 text-espresso">
        {invoice.description ?? t("billing.membershipInvoice")}
      </td>
      <td className="whitespace-nowrap px-4 py-4 font-semibold text-espresso">
        {formatCurrency(invoice.amount, invoice.currency, locale)}
      </td>
      <td className="px-4 py-4">
        <StatusBadge
          status={invoice.status}
          label={t(`billing.statuses.${invoice.status}`)}
        />
      </td>
      <td className="px-6 py-4 text-end">
        {invoice.pdfUrl ? (
          <a
            href={invoice.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-full p-2 text-primary-700 hover:bg-primary-50"
            aria-label={t("billing.downloadInvoice", {
              number: invoice.number,
            })}
          >
            <Download className="size-4" aria-hidden="true" />
          </a>
        ) : (
          <span className="text-text-secondary" aria-label={t("billing.noPdf")}>
            —
          </span>
        )}
      </td>
    </tr>
  );
}

function InvoiceDetailModal({
  invoiceId,
  locale,
  onClose,
}: {
  invoiceId: string | undefined;
  locale: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data, loading, error } = useInvoice(invoiceId);

  return (
    <Modal
      open={Boolean(invoiceId)}
      title={data?.number ?? t("billing.invoiceDetails")}
      description={
        data
          ? formatDate(data.issueDate, locale)
          : t("billing.invoiceDetailsDescription")
      }
      onClose={onClose}
      size="lg"
      footer={
        data?.pdfUrl ? (
          <a
            href={data.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-600"
          >
            <Download className="size-4" aria-hidden="true" />
            {t("billing.downloadPdf")}
          </a>
        ) : undefined
      }
    >
      {loading ? (
        <div className="animate-pulse space-y-3" role="status">
          <div className="h-16 rounded-xl bg-cream-100" />
          <div className="h-16 rounded-xl bg-cream-100" />
          <div className="h-28 rounded-xl bg-cream-100" />
        </div>
      ) : error ? (
        <ErrorState message={error} />
      ) : !data ? (
        <EmptyState
          icon={FileText}
          title={t("billing.detailUnavailableTitle")}
          description={t("billing.detailUnavailableDescription")}
          compact
        />
      ) : (
        <div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-cream-50 p-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-text-secondary">
                {t("billing.status")}
              </p>
              <div className="mt-2">
                <StatusBadge
                  status={data.status}
                  label={t(`billing.statuses.${data.status}`)}
                />
              </div>
            </div>
            <div className="text-end">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-text-secondary">
                {t("billing.total")}
              </p>
              <p className="mt-1 font-serif text-2xl text-espresso">
                {formatCurrency(data.total, data.currency, locale)}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-cream-200">
            <table className="w-full text-sm">
              <thead className="bg-cream-50 text-xs uppercase tracking-[0.08em] text-text-secondary">
                <tr>
                  <th className="px-4 py-3 text-start">{t("billing.item")}</th>
                  <th className="px-3 py-3 text-end">
                    {t("billing.quantity")}
                  </th>
                  <th className="px-3 py-3 text-end">
                    {t("billing.unitPrice")}
                  </th>
                  <th className="px-4 py-3 text-end">
                    {t("billing.lineTotal")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {data.lines.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-text-secondary"
                    >
                      {t("billing.noLineItems")}
                    </td>
                  </tr>
                ) : (
                  data.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-4 py-3 text-espresso">{line.label}</td>
                      <td className="px-3 py-3 text-end text-text-secondary">
                        {line.qty}
                      </td>
                      <td className="px-3 py-3 text-end text-text-secondary">
                        {formatCurrency(line.unitPrice, data.currency, locale)}
                      </td>
                      <td className="px-4 py-3 text-end font-semibold text-espresso">
                        {formatCurrency(line.total, data.currency, locale)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <dl className="ms-auto mt-5 max-w-sm space-y-2 text-sm">
            <div className="flex justify-between gap-5">
              <dt className="text-text-secondary">{t("billing.subtotal")}</dt>
              <dd className="font-semibold text-espresso">
                {formatCurrency(data.subtotal, data.currency, locale)}
              </dd>
            </div>
            <div className="flex justify-between gap-5">
              <dt className="text-text-secondary">{t("billing.tax")}</dt>
              <dd className="font-semibold text-espresso">
                {formatCurrency(data.tax, data.currency, locale)}
              </dd>
            </div>
            <div className="flex justify-between gap-5 border-t border-cream-200 pt-3">
              <dt className="font-bold text-espresso">{t("billing.total")}</dt>
              <dd className="font-serif text-xl text-espresso">
                {formatCurrency(data.total, data.currency, locale)}
              </dd>
            </div>
          </dl>

          <p className="mt-5 text-sm text-text-secondary">
            {data.paymentMethodLast4
              ? t("billing.paidWith", { last4: data.paymentMethodLast4 })
              : t("billing.paymentMethodUnavailable")}
          </p>
        </div>
      )}
    </Modal>
  );
}
