import {
  Award,
  BookOpenCheck,
  Medal,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  EmptyState,
  ErrorState,
  OutlineButton,
  PageSkeleton,
  ProgressMeter,
  SurfaceCard,
} from "@/components/EquiVistaUI";
import { useRiderSyncDashboard } from "@/hooks/use-rider-sync";

const COMPONENTS = [
  ["safetyWelfareScore", "safetyWelfare", 25],
  ["rhythmControlScore", "rhythmControl", 20],
  ["balancePositionScore", "balancePosition", 20],
  ["partnershipScore", "partnership", 20],
  ["trainingConsistencyScore", "trainingConsistency", 10],
  ["reflectionFeedbackScore", "reflectionFeedback", 5],
] as const;

export function RiderSyncDashboard({
  compact = false,
  onOpen,
}: {
  compact?: boolean;
  onOpen?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { data, loading, error, refetch } = useRiderSyncDashboard();
  const arabic = (i18n.resolvedLanguage ?? i18n.language) === "ar";

  if (loading)
    return compact ? (
      <div className="h-44 animate-pulse rounded-2xl bg-cream-100" />
    ) : (
      <PageSkeleton cards={3} />
    );
  if (error)
    return (
      <ErrorState
        message={error}
        retryLabel={t("common.tryAgain")}
        onRetry={refetch}
      />
    );
  if (!data?.snapshot) {
    return (
      <EmptyState
        compact={compact}
        icon={Sparkles}
        title={t("riderSync.emptyTitle")}
        description={t("riderSync.emptyDescription")}
      />
    );
  }

  const snapshot = data.snapshot;
  const currentTitle =
    [...data.titles].reverse().find((title) => title.unlockedAt) ??
    data.titles[0];
  const nextTitle = data.titles.find((title) => !title.unlockedAt);
  const titleProgress =
    nextTitle && currentTitle
      ? Math.max(
          0,
          Math.min(
            100,
            ((snapshot.overallScore - currentTitle.minScore) /
              Math.max(1, nextTitle.minScore - currentTitle.minScore)) *
              100,
          ),
        )
      : 100;
  const titleName = currentTitle
    ? arabic
      ? currentTitle.nameAr
      : currentTitle.name
    : t("riderSync.startingTitle");

  if (compact) {
    return (
      <SurfaceCard className="overflow-hidden">
        <div className="border-b border-cream-200 bg-gradient-to-r from-primary-50 to-cream-50 px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full border border-primary-200 bg-white text-primary-700">
                <Medal className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-700">
                  {t("riderSync.title")}
                </p>
                <h2 className="text-xl text-espresso">{titleName}</h2>
              </div>
            </div>
            <span className="font-serif text-4xl text-primary-700">
              {snapshot.overallScore}
            </span>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <ProgressMeter
            value={titleProgress}
            label={
              nextTitle
                ? t("riderSync.nextTitle", {
                    name: arabic ? nextTitle.nameAr : nextTitle.name,
                  })
                : t("riderSync.highestTitle")
            }
          />
          <p className="text-sm text-text-secondary">
            <span className="font-bold text-espresso">
              {t("riderSync.nextFocus")}:
            </span>{" "}
            {data.latestReport?.nextFocus ??
              t("riderSync.awaitingCoachEvidence")}
          </p>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-text-secondary">
              {t("riderSync.privateBaseline")}
            </p>
            {onOpen ? (
              <OutlineButton onClick={onOpen} className="min-h-9 px-3 py-2">
                {t("riderSync.viewJourney")}
              </OutlineButton>
            ) : null}
          </div>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <section className="mt-6" aria-labelledby="ridersync-heading">
      <SurfaceCard className="overflow-hidden">
        <div className="grid gap-6 bg-gradient-to-br from-primary-50 via-white to-cream-50 p-6 lg:grid-cols-[220px_1fr]">
          <div className="flex flex-col items-center justify-center rounded-2xl border border-primary-200 bg-white p-6 text-center shadow-sm">
            <span className="flex size-16 items-center justify-center rounded-full border-2 border-primary-300 bg-cream-50 text-primary-700">
              <Medal className="size-8" aria-hidden="true" />
            </span>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-primary-700">
              {t("riderSync.score")}
            </p>
            <p className="font-serif text-6xl text-espresso">
              {snapshot.overallScore}
            </p>
            <p className="text-sm font-bold text-primary-700">{titleName}</p>
          </div>
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="ridersync-heading" className="text-3xl text-espresso">
                  {t("riderSync.title")}
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-text-secondary">
                  {t("riderSync.description")}
                </p>
              </div>
              <ShieldCheck
                className="size-7 shrink-0 text-primary-600"
                aria-hidden="true"
              />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {COMPONENTS.map(([key, label, weight]) => (
                <ProgressMeter
                  key={key}
                  value={snapshot[key]}
                  label={`${t(`riderSync.components.${label}`)} · ${weight}%`}
                />
              ))}
            </div>
            <div className="mt-5">
              <ProgressMeter
                value={titleProgress}
                label={
                  nextTitle
                    ? t("riderSync.nextTitle", {
                        name: arabic ? nextTitle.nameAr : nextTitle.name,
                      })
                    : t("riderSync.highestTitle")
                }
              />
            </div>
          </div>
        </div>
      </SurfaceCard>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SurfaceCard className="p-6">
          <div className="flex items-center gap-3">
            <Award className="size-6 text-primary-600" aria-hidden="true" />
            <div>
              <h3 className="text-2xl text-espresso">
                {t("riderSync.badges")}
              </h3>
              <p className="text-sm text-text-secondary">
                {t("riderSync.badgesHelp")}
              </p>
            </div>
          </div>
          {data.badges.length ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {data.badges.map((badge) => (
                <div
                  key={badge.id}
                  className="rounded-2xl border border-primary-200 bg-primary-50/50 p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-full bg-white text-primary-700">
                      <Medal className="size-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-bold text-espresso">
                        {arabic ? badge.nameAr : badge.name}
                      </p>
                      <p className="text-xs uppercase tracking-wide text-primary-700">
                        {t(`riderSync.tiers.${badge.tier}`)}
                      </p>
                    </div>
                  </div>
                  {badge.awardMessage ? (
                    <p className="mt-3 text-sm text-text-secondary">
                      {badge.awardMessage}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm text-text-secondary">
              {t("riderSync.noBadges")}
            </p>
          )}
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <div className="flex items-center gap-3">
            <BookOpenCheck
              className="size-6 text-primary-600"
              aria-hidden="true"
            />
            <div>
              <h3 className="text-2xl text-espresso">
                {t("riderSync.coachFocus")}
              </h3>
              <p className="text-sm text-text-secondary">
                {t("riderSync.coachFocusHelp")}
              </p>
            </div>
          </div>
          {data.latestReport ? (
            <div className="mt-5 space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-primary-700">
                  {t("riderSync.strengths")}
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  {data.latestReport.strengths.join(" · ") ||
                    data.latestReport.summary}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-primary-700">
                  {t("riderSync.nextFocus")}
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  {data.latestReport.nextFocus}
                </p>
              </div>
              {data.latestReport.homework ? (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-primary-700">
                    {t("riderSync.homework")}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {data.latestReport.homework}
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-5 text-sm text-text-secondary">
              {t("riderSync.awaitingCoachEvidence")}
            </p>
          )}
        </SurfaceCard>
      </div>

      <SurfaceCard className="mt-6 p-6">
        <div className="flex items-center gap-3">
          <Target className="size-6 text-primary-600" aria-hidden="true" />
          <div>
            <h3 className="text-2xl text-espresso">
              {t("riderSync.competencies")}
            </h3>
            <p className="text-sm text-text-secondary">
              {t("riderSync.competenciesHelp", {
                count: snapshot.evidenceCount,
              })}
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.competencies.map((item) => (
            <div
              key={item.code}
              className="rounded-xl border border-cream-200 p-4"
            >
              <p className="font-bold text-espresso">{item.name}</p>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-text-secondary">{item.category}</span>
                <span className="rounded-full bg-primary-50 px-2 py-1 font-bold text-primary-700">
                  {t(`riderSync.stages.${item.stage}`)}
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-5 rounded-xl bg-cream-50 p-3 text-xs text-text-secondary">
          {t("riderSync.safetyNote")}
        </p>
      </SurfaceCard>
    </section>
  );
}
