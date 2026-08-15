import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  FileSignature,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  ErrorState,
  MetricCard,
  OutlineButton,
  PageHeader,
  PageSkeleton,
  PrimaryButton,
  StatusBadge,
  SurfaceCard,
} from "@/components/EquiVistaUI";
import { useAuth } from "@/contexts/AuthContext";
import {
  useComplianceActions,
  useComplianceAdminSummary,
  useComplianceRiders,
  useRiderCompliancePortal,
} from "@/hooks/use-compliance";
import type { ComplianceDocumentStatus } from "@/hooks/types";
import { resolvePortalPersona } from "@/lib/portal-persona";

const inputClass =
  "mt-2 min-h-11 w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100";

export default function SafetyPage() {
  const { t, i18n } = useTranslation();
  const { activeOrganization } = useAuth();
  const persona = resolvePortalPersona(activeOrganization?.roles);
  const riders = useComplianceRiders();
  const admin = useComplianceAdminSummary(persona === "academy_admin");
  const [riderId, setRiderId] = useState<string | null>(null);
  const portal = useRiderCompliancePortal(riderId);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [signing, setSigning] = useState<ComplianceDocumentStatus | null>(null);
  const [typedName, setTypedName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [medicalAttention, setMedicalAttention] = useState(false);
  const arabic = (i18n.resolvedLanguage ?? i18n.language) === "ar";

  useEffect(() => {
    if (!riderId && riders.data?.length) setRiderId(riders.data[0].id);
  }, [riderId, riders.data]);
  useEffect(() => {
    setDateOfBirth(portal.data?.dateOfBirth ?? "");
  }, [portal.data?.dateOfBirth]);

  const refresh = () => {
    portal.refetch();
    admin.refetch();
  };
  const actions = useComplianceActions(refresh);
  const selectedRider = useMemo(
    () => riders.data?.find((rider) => rider.id === riderId),
    [riderId, riders.data],
  );

  if (riders.loading || (riderId && portal.loading)) return <PageSkeleton />;
  if (riders.error)
    return (
      <ErrorState
        message={riders.error}
        retryLabel={t("common.tryAgain")}
        onRetry={riders.refetch}
      />
    );

  return (
    <div>
      <PageHeader
        eyebrow={t("safety.eyebrow")}
        title={t("safety.title")}
        description={t("safety.description")}
      />

      {persona === "academy_admin" && admin.data ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <MetricCard
            icon={Users}
            label={t("safety.admin.riders")}
            value={admin.data.riders.length}
            detail={t("safety.admin.ridersHelp")}
          />
          <MetricCard
            icon={CheckCircle2}
            label={t("safety.admin.lessonReady")}
            value={
              admin.data.riders.filter((rider) => rider.lessonReady).length
            }
            detail={t("safety.admin.lessonReadyHelp")}
          />
          <MetricCard
            icon={AlertTriangle}
            label={t("safety.admin.reviewRequired")}
            value={admin.data.medicalReviewRequired}
            detail={t("safety.admin.reviewRequiredHelp")}
          />
        </div>
      ) : null}

      {riders.data?.length ? (
        <SurfaceCard className="mb-6 p-5">
          <label className="block text-sm font-bold text-espresso">
            {t("safety.rider")}
            <select
              className={inputClass}
              value={riderId ?? ""}
              onChange={(event) => setRiderId(event.target.value)}
            >
              {riders.data.map((rider) => (
                <option key={rider.id} value={rider.id}>
                  {rider.name}
                </option>
              ))}
            </select>
          </label>
        </SurfaceCard>
      ) : null}

      {portal.error ? (
        <ErrorState
          message={portal.error}
          retryLabel={t("common.tryAgain")}
          onRetry={portal.refetch}
        />
      ) : null}

      {portal.data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <MetricCard
              icon={FileSignature}
              label={t("safety.lessonReadiness")}
              value={t(
                portal.data.lessonReady
                  ? "safety.ready"
                  : "safety.actionRequired",
              )}
              detail={t("safety.lessonReadinessHelp")}
            />
            <MetricCard
              icon={CalendarClock}
              label={t("safety.renewalReadiness")}
              value={t(
                portal.data.renewalReady
                  ? "safety.ready"
                  : "safety.actionRequired",
              )}
              detail={t("safety.renewalReadinessHelp")}
            />
          </div>

          <SurfaceCard className="mt-6 p-5 sm:p-6">
            <h2 className="text-2xl text-espresso">{t("safety.ageTitle")}</h2>
            <p className="mt-2 text-sm text-text-secondary">
              {t("safety.ageDescription")}
            </p>
            <div className="mt-4 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1 text-sm font-bold text-espresso">
                {t("safety.dateOfBirth")}
                <input
                  type="date"
                  className={inputClass}
                  value={dateOfBirth}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setDateOfBirth(event.target.value)}
                />
              </label>
              <PrimaryButton
                disabled={
                  !dateOfBirth ||
                  actions.submitting ||
                  !riderId ||
                  persona === "default"
                }
                onClick={() =>
                  riderId && actions.setDateOfBirth(riderId, dateOfBirth)
                }
              >
                {t("common.save")}
              </PrimaryButton>
            </div>
            {persona === "default" ? (
              <p className="mt-3 text-xs font-semibold text-text-secondary">
                {t("safety.ageStaffOnly")}
              </p>
            ) : null}
          </SurfaceCard>

          <div className="mt-6 space-y-4">
            {portal.data.documents.map((document) => (
              <SurfaceCard key={document.templateId} className="p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl text-espresso">
                        {arabic ? document.titleAr : document.titleEn}
                      </h2>
                      <StatusBadge
                        status={
                          document.medicalReviewStatus === "review_required"
                            ? "pending"
                            : document.status === "signed"
                              ? "active"
                              : "pending"
                        }
                        label={t(
                          document.medicalReviewStatus === "review_required"
                            ? "safety.medicalReviewPending"
                            : `safety.status.${document.status}`,
                        )}
                      />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-text-secondary">
                      {arabic ? document.bodyAr : document.bodyEn}
                    </p>
                    <p className="mt-3 text-xs font-semibold text-text-secondary">
                      {t("safety.version", { version: document.version })}
                      {document.validUntil
                        ? ` · ${t("safety.validUntil", {
                            date: new Intl.DateTimeFormat(
                              arabic ? "ar-JO" : "en-US",
                              { dateStyle: "medium" },
                            ).format(new Date(document.validUntil)),
                          })}`
                        : ""}
                    </p>
                    {document.receiptKey ? (
                      <p className="mt-1 break-all text-xs text-text-secondary">
                        {t("safety.receipt")}: {document.receiptKey}
                      </p>
                    ) : null}
                  </div>
                  <PrimaryButton
                    disabled={!dateOfBirth || actions.submitting}
                    onClick={() => {
                      setSigning(document);
                      setTypedName("");
                      setAccepted(false);
                      setMedicalAttention(false);
                    }}
                  >
                    <FileSignature className="size-4" aria-hidden="true" />
                    {t(
                      document.status === "signed"
                        ? "safety.signAgain"
                        : "safety.sign",
                    )}
                  </PrimaryButton>
                </div>
                {persona === "academy_admin" &&
                document.medicalReviewStatus === "review_required" &&
                document.submissionId ? (
                  <div className="mt-5 flex flex-wrap gap-2 border-t border-cream-200 pt-4">
                    <OutlineButton
                      disabled={actions.submitting}
                      onClick={() =>
                        actions.reviewMedical(
                          document.submissionId!,
                          "approved",
                        )
                      }
                    >
                      {t("safety.admin.approveMedical")}
                    </OutlineButton>
                    <OutlineButton
                      disabled={actions.submitting}
                      onClick={() =>
                        actions.reviewMedical(
                          document.submissionId!,
                          "rejected",
                        )
                      }
                    >
                      {t("safety.admin.rejectMedical")}
                    </OutlineButton>
                  </div>
                ) : null}
              </SurfaceCard>
            ))}
          </div>
        </>
      ) : null}

      {signing && riderId ? (
        <SurfaceCard className="mt-6 border-primary-300 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <ShieldCheck
              className="size-6 text-primary-600"
              aria-hidden="true"
            />
            <h2 className="text-2xl text-espresso">
              {t("safety.signatureTitle")}
            </h2>
          </div>
          <p className="mt-2 text-sm text-text-secondary">
            {t("safety.signatureDescription", {
              rider: selectedRider?.name ?? "",
            })}
          </p>
          {signing.documentType === "medical_safety" ? (
            <label className="mt-5 flex items-start gap-3 rounded-xl border border-cream-200 p-4 text-sm text-espresso">
              <input
                type="checkbox"
                checked={medicalAttention}
                onChange={(event) => setMedicalAttention(event.target.checked)}
                className="mt-0.5 size-4"
              />
              <span>{t("safety.medicalAttention")}</span>
            </label>
          ) : null}
          <label className="mt-5 block text-sm font-bold text-espresso">
            {t("safety.typedName")}
            <input
              className={inputClass}
              value={typedName}
              onChange={(event) => setTypedName(event.target.value)}
              autoComplete="name"
            />
          </label>
          <label className="mt-4 flex items-start gap-3 text-sm text-espresso">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-0.5 size-4"
            />
            <span>
              {arabic ? signing.consentTextAr : signing.consentTextEn}
            </span>
          </label>
          <div className="mt-5 flex flex-wrap gap-2">
            <PrimaryButton
              disabled={
                !accepted || typedName.trim().length < 2 || actions.submitting
              }
              onClick={async () => {
                const saved = await actions.sign(
                  riderId,
                  signing,
                  typedName,
                  medicalAttention,
                );
                if (saved) setSigning(null);
              }}
            >
              {actions.submitting
                ? t("common.saving")
                : t("safety.signAndSubmit")}
            </PrimaryButton>
            <OutlineButton onClick={() => setSigning(null)}>
              {t("common.cancel")}
            </OutlineButton>
          </div>
        </SurfaceCard>
      ) : null}

      {actions.error ? (
        <div className="mt-5">
          <ErrorState message={actions.error} />
        </div>
      ) : null}
    </div>
  );
}
