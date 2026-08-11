import type { LucideIcon } from "lucide-react";
import { AlertTriangle, LoaderCircle, X } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-primary-600">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-3xl leading-tight text-espresso sm:text-4xl">{title}</h1>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-text-secondary sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function PrimaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-55 ${className}`}
    >
      {children}
    </button>
  );
}

export function OutlineButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cream-300 bg-white px-4 py-2.5 text-sm font-bold text-espresso shadow-sm transition-colors hover:border-primary-400 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-55 ${className}`}
    >
      {children}
    </button>
  );
}

export function SurfaceCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-cream-200 bg-white shadow-sm ${className}`}>
      {children}
    </section>
  );
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <SurfaceCard className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-secondary">
            {label}
          </p>
          <div className="mt-2 font-serif text-2xl text-espresso">{value}</div>
          {detail ? <div className="mt-2 text-xs text-text-secondary">{detail}</div> : null}
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
    </SurfaceCard>
  );
}

export function PageSkeleton({ cards = 4 }: { cards?: number }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-label={t("common.loading")} className="animate-pulse space-y-6">
      <div className="h-9 w-64 rounded-lg bg-cream-200" />
      <div className="h-4 w-full max-w-xl rounded bg-cream-100" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: cards }, (_, index) => (
          <div key={index} className="h-32 rounded-2xl border border-cream-200 bg-white" />
        ))}
      </div>
      <div className="h-80 rounded-2xl border border-cream-200 bg-white" />
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "px-5 py-10" : "min-h-72 px-6 py-14"}`}>
      <span className="mb-4 flex size-12 items-center justify-center rounded-full border border-primary-200 bg-primary-50 text-primary-600">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h2 className="font-serif text-xl text-espresso">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-text-secondary">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-error-500/25 bg-error-50 p-6" role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-error-500" aria-hidden="true" />
        <div>
          <p className="font-semibold text-error-700">{message}</p>
          {onRetry && retryLabel ? (
            <button type="button" onClick={onRetry} className="mt-3 text-sm font-bold text-error-700 underline underline-offset-4">
              {retryLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const statusTone: Record<string, string> = {
  active: "bg-success-50 text-success-700",
  analyzed: "bg-success-50 text-success-700",
  completed: "bg-success-50 text-success-700",
  confirmed: "bg-success-50 text-success-700",
  paid: "bg-success-50 text-success-700",
  trialing: "bg-primary-50 text-primary-700",
  processing: "bg-primary-50 text-primary-700",
  pending: "bg-warning-50 text-warning-700",
  uploaded: "bg-warning-50 text-warning-700",
  open: "bg-warning-50 text-warning-700",
  resting: "bg-warning-50 text-warning-700",
  failed: "bg-error-50 text-error-700",
  overdue: "bg-error-50 text-error-700",
  past_due: "bg-error-50 text-error-700",
  cancelled: "bg-cream-100 text-text-secondary",
  retired: "bg-cream-100 text-text-secondary",
  void: "bg-cream-100 text-text-secondary",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-[0.08em] ${statusTone[status] ?? "bg-cream-100 text-text-secondary"}`}>
      {label ?? status.replaceAll("_", " ")}
    </span>
  );
}

export function ProgressMeter({ value, label }: { value: number; label: string }) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs font-semibold text-text-secondary">
        <span>{label}</span>
        <span>{Math.round(safe)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-cream-200">
        <div className="h-full rounded-full bg-primary-500 transition-[width]" style={{ width: `${safe}%` }} />
      </div>
    </div>
  );
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  const { t } = useTranslation();
  if (!open) return null;
  const width = size === "xl" ? "max-w-4xl" : size === "lg" ? "max-w-2xl" : "max-w-lg";
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-espresso/30 p-4" role="presentation" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="equivista-modal-title"
        className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-cream-200 bg-white shadow-xl ${width}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-5 border-b border-cream-200 px-6 py-5">
          <div>
            <h2 id="equivista-modal-title" className="text-2xl text-espresso">{title}</h2>
            {description ? <p className="mt-1 text-sm text-text-secondary">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-text-secondary hover:bg-cream-100" aria-label={t("common.close")}>
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>
        <div className="p-6">{children}</div>
        {footer ? <footer className="flex flex-wrap justify-end gap-2 border-t border-cream-200 px-6 py-4">{footer}</footer> : null}
      </section>
    </div>
  );
}

export function BusyLabel({ label }: { label: string }) {
  return (
    <>
      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      {label}
    </>
  );
}

export const formatCurrency = (amount: number, currency: string, locale: string) =>
  new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);

export const formatDate = (value: string | null | undefined, locale: string, options?: Intl.DateTimeFormatOptions) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, options ?? { day: "numeric", month: "short", year: "numeric" }).format(date);
};

export const fieldClass =
  "mt-1.5 min-h-11 w-full rounded-xl border border-cream-300 bg-white px-3.5 py-2.5 text-sm text-espresso outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100";

export const labelClass = "text-xs font-bold uppercase tracking-[0.1em] text-text-secondary";
