import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  AlertCircle,
  ClipboardList,
  HeartPulse,
  Info,
  Search,
  Warehouse,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useHorses } from "@/hooks/use-horses";
import {
  EmptyState,
  ErrorState,
  MetricCard,
  PageHeader,
  PageSkeleton,
  StatusBadge,
  SurfaceCard,
} from "@/components/EquiVistaUI";

export default function StableOperationsPage() {
  const { t } = useTranslation();
  const { hasRole } = useAuth();
  const { data: horses, loading, error, refetch } = useHorses();
  const [searchQuery, setSearchQuery] = useState("");

  const canViewStaffPreview =
    hasRole("platform_admin") ||
    hasRole("academy_admin") ||
    hasRole("coach");

  const metrics = useMemo(() => {
    if (!horses) return { active: 0, resting: 0, welfare: 0, pending: 0 };
    return {
      active: horses.filter((h) => h.status === "active").length,
      resting: horses.filter((h) => h.status === "resting").length,
      welfare: Math.floor(horses.length * 0.1), // Derived mock data for preview
      pending: horses.length * 2, // Derived mock data
    };
  }, [horses]);

  const filteredHorses = useMemo(() => {
    if (!horses) return [];
    if (!searchQuery) return horses;
    return horses.filter((h) =>
      h.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [horses, searchQuery]);

  if (loading) return <PageSkeleton cards={4} />;

  if (error) {
    return (
      <ErrorState
        message={t("common.errorLoading")}
        retryLabel={t("common.tryAgain")}
        onRetry={refetch}
      />
    );
  }

  // View for rider-only personas showing safe approved availability messaging
  if (!canViewStaffPreview) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader
          eyebrow={t("stableOperations.eyebrow")}
          title={t("stableOperations.title")}
        />
        <SurfaceCard className="p-8">
          <div className="flex flex-col items-center text-center">
            <span className="mb-6 flex size-16 items-center justify-center rounded-full bg-primary-50 text-primary-600">
              <Warehouse className="size-8" />
            </span>
            <p className="max-w-md text-text-secondary">
              {t("stableOperations.riderMessage")}
            </p>
          </div>
        </SurfaceCard>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t("stableOperations.eyebrow")}
        title={t("stableOperations.title")}
        description={t("stableOperations.description")}
      />

      {/* Read-Only Preview Notice */}
      <div className="rounded-xl border border-primary-200 bg-primary-50 p-4">
        <div className="flex gap-3">
          <Info className="mt-0.5 size-5 shrink-0 text-primary-600" />
          <p className="text-sm text-primary-800">
            {t("stableOperations.description")}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={HeartPulse}
          label={t("stableOperations.metrics.activeHorses")}
          value={metrics.active}
          detail={t("stableOperations.metricDetails.activeInStable")}
        />
        <MetricCard
          icon={AlertCircle}
          label={t("stableOperations.metrics.welfareHolds")}
          value={metrics.welfare}
          detail={t("stableOperations.metricDetails.veterinaryReview")}
        />
        <MetricCard
          icon={Activity}
          label={t("stableOperations.metrics.workload")}
          value={`${horses?.length ? Math.round((horses.length * 3.5)) : 0} hrs`}
          detail={t("stableOperations.metricDetails.lessonsScheduled")}
        />
        <MetricCard
          icon={ClipboardList}
          label={t("stableOperations.metrics.pendingTasks")}
          value={metrics.pending}
          detail={t("stableOperations.metricDetails.careActions")}
        />
      </div>

      <SurfaceCard>
        <div className="border-b border-cream-200 p-5 sm:flex sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif text-lg text-espresso">
              {t("stableOperations.horseList.title")}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {t("stableOperations.horseList.description")}
            </p>
          </div>
          <div className="mt-4 sm:ml-4 sm:mt-0">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="size-4 text-text-secondary" />
              </div>
              <input
                type="text"
                className="block w-full rounded-xl border border-cream-300 bg-white py-2 pl-10 pr-3 text-sm placeholder:text-text-secondary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:text-sm"
                placeholder={t("stableOperations.horseList.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {filteredHorses.length === 0 ? (
          <EmptyState
            icon={Warehouse}
            title={t("stableOperations.horseList.noHorses")}
            description=""
            compact
          />
        ) : (
          <ul className="divide-y divide-cream-100">
            {filteredHorses.map((horse) => {
              // Derive mock welfare hold status for preview purposes
              const isWelfareHold = horse.id.charCodeAt(0) % 5 === 0; // Deterministic random-ish boolean
              const displayStatus = isWelfareHold
                ? "welfareHold"
                : horse.status === "active"
                  ? "available"
                  : horse.status;

              return (
                <li
                  key={horse.id}
                  className="flex items-center justify-between p-5 transition-colors hover:bg-cream-50"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    {horse.photoUrl ? (
                      <img
                        src={horse.photoUrl}
                        alt=""
                        className="size-12 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-cream-100 font-serif text-lg text-text-secondary">
                        {horse.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-espresso">
                        {horse.name}
                      </p>
                      <p className="truncate text-sm text-text-secondary">
                        {horse.breed ?? "Unknown breed"} ·{" "}
                        {t("stableOperations.horseList.riderCount", {
                          count: horse.riderNames?.length ?? 0,
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="ml-4 shrink-0">
                    <StatusBadge
                      status={isWelfareHold ? "failed" : horse.status === "active" ? "active" : "pending"}
                      label={t(`stableOperations.status.${displayStatus}`)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SurfaceCard>
    </div>
  );
}
