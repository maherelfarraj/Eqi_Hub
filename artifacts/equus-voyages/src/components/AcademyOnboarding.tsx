import { useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { Download, FileCheck2, Upload, UserPlus, XCircle } from "lucide-react";
import {
  BusyLabel,
  ErrorState,
  fieldClass,
  labelClass,
  OutlineButton,
  PrimaryButton,
  StatusBadge,
  SurfaceCard,
} from "@/components/EquiVistaUI";
import {
  type AcademyOnboardingEntry,
  useAcademyOnboardingActions,
  useAcademyOnboardingBatches,
} from "@/hooks/use-academy-onboarding";
import {
  academyInvitationExportCsv,
  academyOnboardingTemplateCsv,
  parseAcademyOnboardingCsv,
} from "@/lib/academy-onboarding-csv.mjs";

function downloadCsv(filename: string, contents: string) {
  const url = URL.createObjectURL(
    new Blob([contents], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AcademyOnboarding({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation();
  const batches = useAcademyOnboardingBatches(organizationId);
  const actions = useAcademyOnboardingActions();
  const [name, setName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [entries, setEntries] = useState<AcademyOnboardingEntry[]>([]);
  const [localErrors, setLocalErrors] = useState<
    Array<{ row: number; field: string; message: string }>
  >([]);
  const [preview, setPreview] = useState<{
    valid: boolean;
    rowCount: number;
    existingAccountCount: number;
    errors: Array<{ row: number; field: string; message: string }>;
  } | null>(null);
  const [generatedCsv, setGeneratedCsv] = useState<string | null>(null);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const result = parseAcademyOnboardingCsv(await file.text());
    setEntries(result.entries);
    setLocalErrors(result.errors);
    setPreview(null);
    setGeneratedCsv(null);
    actions.clearError();
  };

  const runPreview = async () => {
    if (localErrors.length || entries.length === 0) return;
    setPreview(await actions.preview(organizationId, entries));
  };

  const createBatch = async () => {
    if (!preview?.valid) return;
    const invitations = await actions.createBatch({
      organizationId,
      name: name.trim(),
      entries,
      expiresInDays,
    });
    if (!invitations) return;
    const exportCsv = academyInvitationExportCsv(
      invitations,
      window.location.origin,
    );
    setGeneratedCsv(exportCsv);
    downloadCsv(`equivista-invitations-${Date.now()}.csv`, exportCsv);
    setEntries([]);
    setLocalErrors([]);
    setPreview(null);
    setName("");
    batches.refetch();
  };

  const closeBatch = async (batchId: string) => {
    const revoked = await actions.closeBatch(organizationId, batchId);
    if (revoked === null) return;
    batches.refetch();
  };

  const errors = [...localErrors, ...(preview?.errors ?? [])];

  return (
    <SurfaceCard className="mt-6 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-cream-200 px-6 py-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-600">
            {t("organization.onboarding.eyebrow")}
          </p>
          <h2 className="mt-1 text-2xl text-espresso">
            {t("organization.onboarding.title")}
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">
            {t("organization.onboarding.description")}
          </p>
        </div>
        <OutlineButton
          onClick={() =>
            downloadCsv("equivista-onboarding-template.csv", academyOnboardingTemplateCsv())
          }
        >
          <Download className="size-4" aria-hidden="true" />
          {t("organization.onboarding.template")}
        </OutlineButton>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-5">
          {actions.error ? <ErrorState message={actions.error} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>{t("organization.onboarding.batchName")}</span>
              <input
                className={fieldClass}
                value={name}
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="block">
              <span className={labelClass}>{t("organization.onboarding.expiry")}</span>
              <input
                type="number"
                min={1}
                max={30}
                className={fieldClass}
                value={expiresInDays}
                onChange={(event) => {
                  setExpiresInDays(Number(event.target.value));
                  setPreview(null);
                }}
              />
            </label>
          </div>

          <label className="flex cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-primary-300 bg-primary-50/40 px-4 py-6 text-sm font-semibold text-primary-700 hover:bg-primary-50">
            <Upload className="size-5" aria-hidden="true" />
            {t("organization.onboarding.chooseCsv")}
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={handleFile} />
          </label>

          {entries.length ? (
            <p className="text-sm font-semibold text-espresso">
              {t("organization.onboarding.rowsLoaded", { count: entries.length })}
            </p>
          ) : null}

          {errors.length ? (
            <div className="rounded-xl border border-error-500/20 bg-error-50 p-4" role="alert">
              <p className="font-semibold text-error-700">
                {t("organization.onboarding.validationFailed")}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-error-700">
                {errors.slice(0, 8).map((error, index) => (
                  <li key={`${error.row}-${error.field}-${index}`}>
                    {error.row ? `${t("organization.onboarding.row")} ${error.row}: ` : ""}
                    {error.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {preview?.valid ? (
            <div className="flex items-start gap-3 rounded-xl border border-success-500/25 bg-success-50 p-4 text-sm text-success-700" role="status">
              <FileCheck2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <span>
                {t("organization.onboarding.previewPassed", {
                  count: preview.rowCount,
                  existing: preview.existingAccountCount,
                })}
              </span>
            </div>
          ) : null}

          {generatedCsv ? (
            <div className="rounded-xl border border-warning-500/25 bg-warning-50 p-4 text-sm text-warning-800" role="status">
              <p className="font-semibold">{t("organization.onboarding.downloaded")}</p>
              <p className="mt-1">{t("organization.onboarding.secretWarning")}</p>
              <button
                type="button"
                className="mt-3 font-semibold text-primary-700 underline"
                onClick={() => downloadCsv("equivista-invitations.csv", generatedCsv)}
              >
                {t("organization.onboarding.downloadAgain")}
              </button>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <OutlineButton
              onClick={runPreview}
              disabled={actions.working || entries.length === 0 || localErrors.length > 0}
            >
              {actions.working ? <BusyLabel label={t("common.working")} /> : t("organization.onboarding.dryRun")}
            </OutlineButton>
            <PrimaryButton
              onClick={createBatch}
              disabled={
                actions.working ||
                !preview?.valid ||
                name.trim().length < 2 ||
                expiresInDays < 1 ||
                expiresInDays > 30
              }
            >
              <UserPlus className="size-4" aria-hidden="true" />
              {t("organization.onboarding.createInvitations")}
            </PrimaryButton>
          </div>
        </div>

        <div>
          <h3 className="font-serif text-xl text-espresso">
            {t("organization.onboarding.history")}
          </h3>
          {batches.error ? <div className="mt-3"><ErrorState message={batches.error} /></div> : null}
          <div className="mt-3 space-y-3">
            {(batches.data ?? []).map((batch) => (
              <div key={batch.id} className="rounded-xl border border-cream-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-espresso">{batch.name}</p>
                    <p className="mt-1 text-xs text-text-secondary">
                      {new Date(batch.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <StatusBadge
                    status={batch.status === "active" ? "active" : "cancelled"}
                    label={t(`organization.onboarding.statuses.${batch.status}`)}
                  />
                </div>
                <p className="mt-3 text-sm text-text-secondary">
                  {t("organization.onboarding.batchCounts", {
                    total: batch.rowCount,
                    pending: batch.pendingCount,
                    accepted: batch.acceptedCount,
                    revoked: batch.revokedCount,
                  })}
                </p>
                {batch.status === "active" ? (
                  <button
                    type="button"
                    onClick={() => closeBatch(batch.id)}
                    disabled={actions.working}
                    className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-error-700 disabled:opacity-50"
                  >
                    <XCircle className="size-4" aria-hidden="true" />
                    {t("organization.onboarding.closeBatch")}
                  </button>
                ) : null}
              </div>
            ))}
            {!batches.loading && !(batches.data ?? []).length ? (
              <p className="rounded-xl bg-cream-50 p-4 text-sm text-text-secondary">
                {t("organization.onboarding.noBatches")}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}
