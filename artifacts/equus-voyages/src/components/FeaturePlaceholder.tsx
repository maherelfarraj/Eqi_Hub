import type { LucideIcon } from "lucide-react";
import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

interface FeaturePlaceholderProps {
  icon: LucideIcon;
  titleKey: string;
}

export default function FeaturePlaceholder({
  icon: Icon,
  titleKey,
}: FeaturePlaceholderProps) {
  const { t } = useTranslation();

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-600">
          {t("foundation.eyebrow")}
        </p>
        <h1 className="mt-2 font-serif text-3xl text-espresso sm:text-4xl">
          {t(titleKey)}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
          {t("foundation.introduction")}
        </p>
      </div>

      <div className="rounded-2xl border border-cream-200 bg-white p-8 shadow-sm sm:p-12">
        <div className="mx-auto flex max-w-lg flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
            <Icon className="size-7" />
          </div>
          <h2 className="mt-5 font-serif text-2xl text-espresso">
            {t("foundation.readyTitle")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            {t("foundation.readyDescription")}
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-success-500/20 bg-success-50 px-4 py-2 text-xs font-semibold text-success-700">
            <ShieldCheck className="size-4" />
            {t("foundation.secureWorkspace")}
          </div>
        </div>
      </div>
    </section>
  );
}
