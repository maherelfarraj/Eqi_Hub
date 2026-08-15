import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Heart,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
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
import {
  useGuardianApprovalActions,
  useGuardianPortal,
  useGuardianRelationships,
} from "@/hooks/use-guardian-view";

export default function GuardianViewPage() {
  const { t, i18n } = useTranslation();
  const locale =
    (i18n.resolvedLanguage ?? i18n.language) === "ar" ? "ar-JO" : "en-US";
  const relationships = useGuardianRelationships();
  const [riderId, setRiderId] = useState<string | null>(null);

  useEffect(() => {
    const links = relationships.data ?? [];
    if (!riderId || !links.some((link) => link.riderId === riderId)) {
      setRiderId(
        links.find(
          (link) => link.verificationStatus === "verified" && link.active,
        )?.riderId ??
          links[0]?.riderId ??
          null,
      );
    }
  }, [relationships.data, riderId]);

  const portal = useGuardianPortal(riderId);
  const actions = useGuardianApprovalActions(portal.refetch);
  const currentLink = (relationships.data ?? []).find(
    (link) => link.riderId === riderId,
  );
  const pending = useMemo(
    () =>
      (portal.data?.approvals ?? []).filter(
        (item) => item.status === "pending",
      ),
    [portal.data?.approvals],
  );

  if (relationships.loading) return <PageSkeleton />;
  if (relationships.error)
    return (
      <ErrorState
        message={relationships.error}
        retryLabel={t("common.tryAgain")}
        onRetry={relationships.refetch}
      />
    );
  if (!(relationships.data ?? []).length) {
    return (
      <EmptyState
        icon={Users}
        title={t("guardianView.emptyTitle")}
        description={t("guardianView.emptyDescription")}
      />
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow={t("guardianView.eyebrow")}
        title={t("guardianView.title")}
        description={t("guardianView.description")}
      />

      <SurfaceCard className="mb-6 p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-primary-700">
          {t("guardianView.chooseRider")}
        </p>
        <div className="flex flex-wrap gap-2">
          {(relationships.data ?? []).map((link) => (
            <button
              key={`${link.guardianId}:${link.riderId}`}
              type="button"
              onClick={() => setRiderId(link.riderId)}
              className={`rounded-xl border px-4 py-3 text-start transition-colors ${
                riderId === link.riderId
                  ? "border-primary-400 bg-primary-50 text-primary-800"
                  : "border-cream-200 bg-white text-espresso hover:border-primary-300"
              }`}
            >
              <span className="block text-sm font-bold">{link.riderName}</span>
              <span className="mt-1 block text-xs text-text-secondary">
                {t(`guardianView.relationships.${link.relationshipType}`)} ·{" "}
                {t(`guardianView.statuses.${link.verificationStatus}`)}
              </span>
            </button>
          ))}
        </div>
      </SurfaceCard>

      {currentLink?.verificationStatus !== "verified" || !currentLink.active ? (
        <SurfaceCard className="border-warning-200 bg-warning-50 p-6">
          <div className="flex items-start gap-3">
            <Clock3
              className="mt-0.5 size-5 text-warning-700"
              aria-hidden="true"
            />
            <div>
              <h2 className="text-xl text-espresso">
                {t("guardianView.reviewTitle")}
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                {t("guardianView.reviewDescription")}
              </p>
            </div>
          </div>
        </SurfaceCard>
      ) : portal.loading ? (
        <PageSkeleton cards={4} />
      ) : portal.error ? (
        <ErrorState
          message={portal.error}
          retryLabel={t("common.tryAgain")}
          onRetry={portal.refetch}
        />
      ) : portal.data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={Sparkles}
              label={t("guardianView.riderSyncScore")}
              value={portal.data.riderSync.snapshot?.overallScore ?? "—"}
              detail={
                portal.data.riderSync.titles
                  .filter((title) => title.unlockedAt)
                  .at(-1)?.name ?? t("guardianView.awaitingEvidence")
              }
            />
            <MetricCard
              icon={CheckCircle2}
              label={t("guardianView.attendance")}
              value={portal.data.attendance.completed}
              detail={t("guardianView.completedLessons")}
            />
            <MetricCard
              icon={CalendarDays}
              label={t("guardianView.scheduled")}
              value={portal.data.attendance.scheduled}
              detail={t("guardianView.upcomingLessons")}
            />
            <MetricCard
              icon={FileCheck2}
              label={t("guardianView.pendingApprovals")}
              value={pending.length}
              detail={t("guardianView.guardianActions")}
            />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <SurfaceCard className="p-6">
              <div className="flex items-center gap-3">
                <ShieldCheck
                  className="size-6 text-primary-600"
                  aria-hidden="true"
                />
                <div>
                  <h2 className="text-2xl text-espresso">
                    {t("guardianView.weeklySummary")}
                  </h2>
                  <p className="text-sm text-text-secondary">
                    {t("guardianView.weeklySummaryHelp")}
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-4 text-sm">
                <div>
                  <p className="font-bold text-espresso">
                    {t("guardianView.strengths")}
                  </p>
                  <p className="mt-1 text-text-secondary">
                    {portal.data.riderSync.latestReport?.strengths.join(
                      " · ",
                    ) || t("guardianView.awaitingEvidence")}
                  </p>
                </div>
                <div>
                  <p className="font-bold text-espresso">
                    {t("guardianView.positiveFocus")}
                  </p>
                  <p className="mt-1 text-text-secondary">
                    {portal.data.riderSync.latestReport?.nextFocus ||
                      t("guardianView.awaitingEvidence")}
                  </p>
                </div>
                <p className="rounded-xl bg-cream-50 p-3 text-xs text-text-secondary">
                  {t("guardianView.privateBoundary")}
                </p>
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-6">
              <div className="flex items-center gap-3">
                <Heart className="size-6 text-primary-600" aria-hidden="true" />
                <h2 className="text-2xl text-espresso">
                  {t("guardianView.horsesAndLessons")}
                </h2>
              </div>
              <div className="mt-5 space-y-3">
                {portal.data.horses.map((horse) => (
                  <div
                    key={horse.id}
                    className="flex items-center justify-between rounded-xl border border-cream-200 p-3"
                  >
                    <span className="font-bold text-espresso">
                      {horse.name}
                    </span>
                    <StatusBadge
                      status={horse.status}
                      label={t(`guardianView.horseStatuses.${horse.status}`)}
                    />
                  </div>
                ))}
                {portal.data.lessons.slice(0, 4).map((lesson) => (
                  <div
                    key={lesson.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-cream-200 p-3"
                  >
                    <div>
                      <p className="font-bold text-espresso">{lesson.type}</p>
                      <p className="text-xs text-text-secondary">
                        {formatDate(lesson.dateTime, locale, {
                          day: "numeric",
                          month: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <StatusBadge status={lesson.status} />
                  </div>
                ))}
                {!portal.data.horses.length && !portal.data.lessons.length ? (
                  <p className="text-sm text-text-secondary">
                    {t("guardianView.noActivity")}
                  </p>
                ) : null}
              </div>
            </SurfaceCard>
          </div>

          <SurfaceCard className="mt-6 p-6">
            <div className="flex items-center gap-3">
              <FileCheck2
                className="size-6 text-primary-600"
                aria-hidden="true"
              />
              <div>
                <h2 className="text-2xl text-espresso">
                  {t("guardianView.approvals")}
                </h2>
                <p className="text-sm text-text-secondary">
                  {t("guardianView.approvalsHelp")}
                </p>
              </div>
            </div>
            {actions.error ? (
              <div className="mt-4">
                <ErrorState message={actions.error} />
              </div>
            ) : null}
            <div className="mt-5 space-y-3">
              {portal.data.approvals.map((approval) => (
                <div
                  key={approval.id}
                  className="flex flex-col gap-3 rounded-xl border border-cream-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-espresso">
                        {approval.summary}
                      </p>
                      <StatusBadge
                        status={approval.status}
                        label={t(
                          `guardianView.approvalStatuses.${approval.status}`,
                        )}
                      />
                    </div>
                    <p className="mt-1 text-xs text-text-secondary">
                      {t(`guardianView.approvalTypes.${approval.approvalType}`)}{" "}
                      · {formatDate(approval.requestedAt, locale)}
                    </p>
                  </div>
                  {approval.status === "pending" ? (
                    <div className="flex gap-2">
                      <OutlineButton
                        disabled={actions.submitting}
                        onClick={() =>
                          void actions.respond(approval.id, "declined")
                        }
                      >
                        <XCircle className="size-4" />
                        {t("guardianView.decline")}
                      </OutlineButton>
                      <PrimaryButton
                        disabled={actions.submitting}
                        onClick={() =>
                          void actions.respond(approval.id, "approved")
                        }
                      >
                        <CheckCircle2 className="size-4" />
                        {t("guardianView.approve")}
                      </PrimaryButton>
                    </div>
                  ) : null}
                </div>
              ))}
              {!portal.data.approvals.length ? (
                <p className="text-sm text-text-secondary">
                  {t("guardianView.noApprovals")}
                </p>
              ) : null}
            </div>
          </SurfaceCard>

          {portal.data.relationship.permissions.viewFinancials ? (
            <SurfaceCard className="mt-6 p-6">
              <div className="flex items-center gap-3">
                <ReceiptText
                  className="size-6 text-primary-600"
                  aria-hidden="true"
                />
                <h2 className="text-2xl text-espresso">
                  {t("guardianView.invoices")}
                </h2>
              </div>
              <div className="mt-5 space-y-3">
                {portal.data.invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-cream-200 p-4"
                  >
                    <div>
                      <p className="font-bold text-espresso">
                        {invoice.number}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {formatDate(invoice.issueDate, locale)}
                      </p>
                    </div>
                    <div className="text-end">
                      <p className="font-serif text-lg text-espresso">
                        {formatCurrency(
                          invoice.totalCents / 100,
                          invoice.currency,
                          locale,
                        )}
                      </p>
                      <StatusBadge status={invoice.status} />
                    </div>
                  </div>
                ))}
                {!portal.data.invoices.length ? (
                  <p className="text-sm text-text-secondary">
                    {t("guardianView.noInvoices")}
                  </p>
                ) : null}
              </div>
            </SurfaceCard>
          ) : null}

          <SurfaceCard className="mt-6 p-6">
            <div className="flex items-center gap-3">
              <Clock3 className="size-6 text-primary-600" aria-hidden="true" />
              <div>
                <h2 className="text-2xl text-espresso">
                  {t("guardianView.accessHistory")}
                </h2>
                <p className="text-sm text-text-secondary">
                  {t("guardianView.accessHistoryHelp")}
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {portal.data.accessHistory.slice(0, 8).map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-cream-200 p-3"
                >
                  <span className="text-sm font-bold text-espresso">
                    {t(`guardianView.eventTypes.${event.eventType}`)}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {formatDate(event.occurredAt, locale, {
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
              {!portal.data.accessHistory.length ? (
                <p className="text-sm text-text-secondary">
                  {t("guardianView.noAccessHistory")}
                </p>
              ) : null}
            </div>
          </SurfaceCard>
        </>
      ) : null}
    </div>
  );
}
