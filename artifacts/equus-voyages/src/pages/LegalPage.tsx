import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  FileText,
  Globe2,
  Mail,
  MapPin,
  MessageCircleMore,
  Phone,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";

const documents = ["terms", "privacy", "refunds", "contact"] as const;
type LegalDocument = (typeof documents)[number];

const sectionIds: Record<LegalDocument, readonly string[]> = {
  terms: [
    "operator",
    "services",
    "accounts",
    "memberships",
    "ai",
    "acceptableUse",
    "availability",
    "termination",
    "liability",
    "law",
  ],
  privacy: [
    "controller",
    "collected",
    "purposes",
    "video",
    "payments",
    "sharing",
    "retention",
    "rights",
    "minors",
  ],
  refunds: [
    "overview",
    "cancellation",
    "eligible",
    "notEligible",
    "lessons",
    "request",
    "processing",
  ],
  contact: ["support", "company", "payments", "privacy", "security"],
};

const documentIcons = {
  terms: FileText,
  privacy: ShieldCheck,
  refunds: RefreshCcw,
  contact: MessageCircleMore,
} satisfies Record<LegalDocument, typeof FileText>;

function isLegalDocument(value: string | undefined): value is LegalDocument {
  return documents.includes(value as LegalDocument);
}

export default function LegalPage() {
  const { document } = useParams<{ document: string }>();
  const { t, i18n } = useTranslation();
  const isRtl = (i18n.resolvedLanguage ?? i18n.language) === "ar";

  if (!isLegalDocument(document)) {
    return <Navigate to="/legal/terms" replace />;
  }

  const Icon = documentIcons[document];

  const toggleLanguage = async () => {
    await i18n.changeLanguage(isRtl ? "en" : "ar");
  };

  return (
    <main className="min-h-screen bg-cream-50 text-espresso">
      <header className="border-b border-cream-200 bg-white/90">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            to="/auth"
            className="flex items-center gap-3"
            aria-label={t("legal.backToSignIn")}
          >
            <span className="flex size-10 items-center justify-center rounded-full border border-primary-500 bg-white font-serif text-lg text-primary-600 shadow-sm">
              E
            </span>
            <span>
              <span className="block font-serif text-xl leading-none">
                {t("app.name")}
              </span>
              <span className="mt-1 block text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-primary-600">
                {t("app.tagline")}
              </span>
            </span>
          </Link>
          <button
            type="button"
            onClick={toggleLanguage}
            className="inline-flex items-center gap-2 rounded-full border border-cream-200 bg-white px-4 py-2 text-sm font-semibold text-text-secondary shadow-sm transition-colors hover:text-espresso"
          >
            <Globe2 className="size-4 text-primary-500" aria-hidden="true" />
            {isRtl ? t("common.english") : t("common.arabic")}
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <Link
          to="/auth"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-800"
        >
          <ArrowLeft
            className={`size-4 ${isRtl ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
          {t("legal.backToSignIn")}
        </Link>

        <nav
          className="mt-6 grid gap-2 rounded-2xl border border-cream-200 bg-cream-100 p-2 sm:grid-cols-4"
          aria-label={t("legal.navigationLabel")}
        >
          {documents.map((item) => (
            <Link
              key={item}
              to={`/legal/${item}`}
              aria-current={item === document ? "page" : undefined}
              className={`rounded-xl px-4 py-3 text-center text-sm font-semibold transition-colors ${
                item === document
                  ? "bg-white text-primary-700 shadow-sm"
                  : "text-text-secondary hover:bg-white/70 hover:text-espresso"
              }`}
            >
              {t(`legal.nav.${item}`)}
            </Link>
          ))}
        </nav>

        <article className="mt-6 overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-sm">
          <div className="border-b border-cream-200 bg-cream-100/70 px-6 py-8 sm:px-10 sm:py-10">
            <div className="flex size-12 items-center justify-center rounded-full border border-primary-300 bg-white text-primary-600 shadow-sm">
              <Icon className="size-5" aria-hidden="true" />
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
              {t("legal.eyebrow")}
            </p>
            <h1 className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">
              {t(`legal.documents.${document}.title`)}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-text-secondary sm:text-base">
              {t(`legal.documents.${document}.introduction`)}
            </p>
            <p className="mt-4 text-xs font-semibold text-text-secondary">
              {t("legal.lastUpdated")}
            </p>
          </div>

          <div className="space-y-5 px-6 py-8 sm:px-10 sm:py-10">
            {sectionIds[document].map((sectionId) => (
              <section
                key={sectionId}
                className="rounded-2xl border border-cream-200 bg-cream-50 p-5 sm:p-6"
              >
                <h2 className="font-serif text-2xl">
                  {t(`legal.documents.${document}.sections.${sectionId}.title`)}
                </h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-text-secondary">
                  {t(`legal.documents.${document}.sections.${sectionId}.body`)}
                </p>
              </section>
            ))}

            {document === "contact" ? (
              <section
                className="grid gap-3 sm:grid-cols-3"
                aria-label={t("legal.contactDetails")}
              >
                <a
                  href="mailto:admin@equivista.net"
                  className="rounded-2xl border border-cream-200 bg-white p-5 text-sm shadow-sm transition-colors hover:border-primary-300"
                >
                  <Mail
                    className="size-5 text-primary-600"
                    aria-hidden="true"
                  />
                  <span className="mt-3 block font-semibold text-espresso">
                    admin@equivista.net
                  </span>
                </a>
                <a
                  href="tel:+96264736800"
                  className="rounded-2xl border border-cream-200 bg-white p-5 text-sm shadow-sm transition-colors hover:border-primary-300"
                >
                  <Phone
                    className="size-5 text-primary-600"
                    aria-hidden="true"
                  />
                  <span
                    className="mt-3 block font-semibold text-espresso"
                    dir="ltr"
                  >
                    +962 6 473 6800
                  </span>
                </a>
                <div className="rounded-2xl border border-cream-200 bg-white p-5 text-sm shadow-sm">
                  <MapPin
                    className="size-5 text-primary-600"
                    aria-hidden="true"
                  />
                  <span className="mt-3 block font-semibold text-espresso">
                    {t("legal.address")}
                  </span>
                </div>
              </section>
            ) : null}
          </div>
        </article>

        <footer className="py-7 text-center text-xs leading-6 text-text-secondary">
          <p>{t("legal.companyLine")}</p>
          <p>{t("legal.registrationLine")}</p>
        </footer>
      </div>
    </main>
  );
}
