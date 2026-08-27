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
    <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-primary-600">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-serif text-3xl text-espresso sm:text-4xl tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-3 text-sm leading-relaxed text-text-secondary sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-3">{actions}</div> : null}
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
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-700 hover:shadow disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
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
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-espresso shadow-sm transition-all hover:border-primary-400 hover:bg-cream-50 hover:text-primary-800 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
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
    <section className={`rounded-xl border border-cream-200 bg-white shadow-sm transition-shadow ${className}`}>
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
    <SurfaceCard className="p-6 relative overflow-hidden group">
      {/* Subtle background decoration */}
      <div className="absolute -right-6 -top-6 text-primary-50 opacity-50 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12 pointer-events-none">
        <Icon className="size-32" aria-hidden="true" />
      </div>
      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-text-secondary">
            {label}
          </p>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-cream-100 text-primary-600">
            <Icon className="size-4" aria-hidden="true" />
          </span>
        </div>
        <div>
          <div className="font-serif text-3xl text-espresso tracking-tight">{value}</div>
          {detail ? <div className="mt-1.5 text-sm font-medium text-text-secondary">{detail}</div> : null}
        </div>
      </div>
    </SurfaceCard>
  );
}

export function PageSkeleton({ cards = 4 }: { cards?: number }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-label={t("common.loading", { defaultValue: "Loading..." })} className="animate-pulse space-y-8">
      <div className="space-y-3">
        <div className="h-10 w-64 rounded-lg bg-cream-200" />
        <div className="h-5 w-full max-w-xl rounded-lg bg-cream-100" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: cards }, (_, index) => (
          <div key={index} className="h-36 rounded-xl border border-cream-200 bg-white shadow-sm" />
        ))}
      </div>
      <div className="h-96 rounded-xl border border-cream-200 bg-white shadow-sm" />
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
    <div className={`flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-cream-300 bg-cream-50/50 ${compact ? "px-5 py-8" : "min-h-[20rem] px-6 py-14"}`}>
      <span className="mb-5 flex size-14 items-center justify-center rounded-xl bg-white shadow-sm border border-cream-200 text-primary-600">
        <Icon className="size-6" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <h2 className="font-serif text-xl text-espresso">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-text-secondary">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
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
    <div className="rounded-xl border border-error-200 bg-error-50 p-5 shadow-sm" role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-error-600" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-error-800">{message}</p>
          {onRetry && retryLabel ? (
            <button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-error-700 hover:text-error-800 transition-colors">
              {retryLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const statusTone: Record<string, string> = {
  active: "bg-success-50 text-success-700 border-success-200",
  analyzed: "bg-success-50 text-success-700 border-success-200",
  completed: "bg-success-50 text-success-700 border-success-200",
  confirmed: "bg-success-50 text-success-700 border-success-200",
  paid: "bg-success-50 text-success-700 border-success-200",
  trialing: "bg-primary-50 text-primary-700 border-primary-200",
  processing: "bg-primary-50 text-primary-700 border-primary-200",
  pending: "bg-warning-50 text-warning-700 border-warning-200",
  uploaded: "bg-warning-50 text-warning-700 border-warning-200",
  open: "bg-warning-50 text-warning-700 border-warning-200",
  resting: "bg-warning-50 text-warning-700 border-warning-200",
  failed: "bg-error-50 text-error-700 border-error-200",
  overdue: "bg-error-50 text-error-700 border-error-200",
  past_due: "bg-error-50 text-error-700 border-error-200",
  cancelled: "bg-cream-100 text-text-secondary border-cream-200",
  retired: "bg-cream-100 text-text-secondary border-cream-200",
  void: "bg-cream-100 text-text-secondary border-cream-200",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.1em] shadow-sm ${statusTone[status] ?? "bg-cream-100 text-text-secondary border-cream-200"}`}>
      {label ?? status.replaceAll("_", " ")}
    </span>
  );
}

export function ProgressMeter({ value, label }: { value: number; label: string }) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="mb-2 flex justify-between text-xs font-semibold text-espresso">
        <span>{label}</span>
        <span className="text-text-secondary">{Math.round(safe)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-cream-200">
        <div className="h-full rounded-full bg-primary-600 transition-all duration-500 ease-out" style={{ width: `${safe}%` }} />
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-espresso/40 backdrop-blur-sm p-4" role="presentation" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="equivista-modal-title"
        className={`max-h-[90vh] flex flex-col w-full overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-2xl ${width}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-5 border-b border-cream-200 px-6 py-5 bg-cream-50/50">
          <div>
            <h2 id="equivista-modal-title" className="font-serif text-2xl text-espresso tracking-tight">{title}</h2>
            {description ? <p className="mt-1 text-sm text-text-secondary">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-text-secondary hover:bg-cream-200 hover:text-espresso transition-colors" aria-label={t("common.close", { defaultValue: "Close" })}>
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">{children}</div>
        {footer ? <footer className="shrink-0 flex flex-wrap justify-end gap-3 border-t border-cream-200 px-6 py-4 bg-cream-50/50">{footer}</footer> : null}
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

export const formatCalendarDate = (
  value: string | null | undefined,
  locale: string,
) =>
  formatDate(value, locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

export const fieldClass =
  "mt-1.5 min-h-10 w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-espresso outline-none transition-all focus:border-primary-500 focus:ring-1 focus:ring-primary-500 placeholder:text-cream-400";

export const labelClass = "text-[0.7rem] font-bold uppercase tracking-[0.1em] text-espresso";
