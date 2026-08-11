import { ArrowLeft, Compass } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-xl rounded-2xl border border-cream-200 bg-white p-8 text-center shadow-sm sm:p-12">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-primary-300 bg-primary-50 text-primary-700">
          <Compass className="size-7" aria-hidden="true" />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-primary-600">
          {t("notFound.eyebrow")}
        </p>
        <h1 className="mt-2 font-serif text-4xl text-espresso">
          {t("notFound.title")}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-text-secondary">
          {t("notFound.description")}
        </p>
        <Link
          to="/dashboard"
          className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
          {t("notFound.backToDashboard")}
        </Link>
      </div>
    </div>
  );
}
