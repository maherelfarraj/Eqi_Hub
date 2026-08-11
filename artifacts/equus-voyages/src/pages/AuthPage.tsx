import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe2,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

type AuthView =
  | "signIn"
  | "signUp"
  | "forgotPassword"
  | "updatePassword"
  | "checkEmail"
  | "passwordUpdated";

type ConfirmationKind = "signUp" | "reset";

interface FieldErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthPage() {
  const { t, i18n } = useTranslation();
  const { signIn, signUp, resetPassword, updatePassword } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isRecoveryRoute = location.pathname.endsWith("/update-password");

  const [view, setView] = useState<AuthView>(
    isRecoveryRoute ? "updatePassword" : "signIn",
  );
  const [confirmationKind, setConfirmationKind] =
    useState<ConfirmationKind>("signUp");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isRtl = (i18n.resolvedLanguage ?? i18n.language) === "ar";

  const switchView = (nextView: AuthView) => {
    setView(nextView);
    setError("");
    setFieldErrors({});
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const authErrorMessage = (message: string) => {
    const normalized = message.toLowerCase();

    if (normalized.includes("invalid login credentials")) {
      return t("auth.errors.invalidCredentials");
    }
    if (normalized.includes("email not confirmed")) {
      return t("auth.errors.emailNotConfirmed");
    }
    if (
      normalized.includes("already registered") ||
      normalized.includes("already been registered")
    ) {
      return t("auth.errors.alreadyRegistered");
    }
    if (
      normalized.includes("rate limit") ||
      normalized.includes("too many requests")
    ) {
      return t("auth.errors.rateLimited");
    }
    if (
      normalized.includes("session") ||
      normalized.includes("recovery") ||
      normalized.includes("token")
    ) {
      return t("auth.errors.recoveryExpired");
    }

    return t("auth.errors.generic");
  };

  const validateEmail = () => {
    if (!email.trim()) return t("auth.validation.emailRequired");
    if (!emailPattern.test(email.trim())) {
      return t("auth.validation.emailInvalid");
    }
    return "";
  };

  const validatePassword = (value: string) => {
    if (!value) return t("auth.validation.passwordRequired");
    if (value.length < 8) return t("auth.validation.passwordTooShort");
    return "";
  };

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {
      email: validateEmail() || undefined,
      password: !password ? t("auth.validation.passwordRequired") : undefined,
    };
    setFieldErrors(nextErrors);
    setError("");

    if (Object.values(nextErrors).some(Boolean)) return;

    setLoading(true);
    const result = await signIn(email.trim(), password);
    setLoading(false);

    if (result.error) {
      setError(authErrorMessage(result.error));
      return;
    }

    navigate("/dashboard", { replace: true });
  };

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const passwordError = validatePassword(password);
    const nextErrors: FieldErrors = {
      fullName:
        fullName.trim().length < 2
          ? t("auth.validation.fullNameRequired")
          : undefined,
      email: validateEmail() || undefined,
      password: passwordError || undefined,
      confirmPassword:
        password !== confirmPassword
          ? t("auth.validation.passwordMismatch")
          : undefined,
    };
    setFieldErrors(nextErrors);
    setError("");

    if (Object.values(nextErrors).some(Boolean)) return;

    setLoading(true);
    const result = await signUp(email.trim(), password, fullName.trim());
    setLoading(false);

    if (result.error) {
      setError(authErrorMessage(result.error));
      return;
    }

    setConfirmationKind("signUp");
    setView("checkEmail");
  };

  const handleResetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const emailError = validateEmail();
    setFieldErrors({ email: emailError || undefined });
    setError("");

    if (emailError) return;

    setLoading(true);
    const result = await resetPassword(email.trim());
    setLoading(false);

    if (result.error) {
      setError(authErrorMessage(result.error));
      return;
    }

    setConfirmationKind("reset");
    setView("checkEmail");
  };

  const handleUpdatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const passwordError = validatePassword(password);
    const nextErrors: FieldErrors = {
      password: passwordError || undefined,
      confirmPassword:
        password !== confirmPassword
          ? t("auth.validation.passwordMismatch")
          : undefined,
    };
    setFieldErrors(nextErrors);
    setError("");

    if (Object.values(nextErrors).some(Boolean)) return;

    setLoading(true);
    const result = await updatePassword(password);
    setLoading(false);

    if (result.error) {
      setError(authErrorMessage(result.error));
      return;
    }

    setView("passwordUpdated");
  };

  const toggleLanguage = async () => {
    await i18n.changeLanguage(isRtl ? "en" : "ar");
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cream-50 px-4 py-10 sm:px-6">
      <div
        className="pointer-events-none absolute -start-28 top-16 size-72 rounded-full border border-primary-500/15"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -end-20 bottom-10 size-56 rounded-full border border-primary-500/10"
        aria-hidden="true"
      />

      <button
        type="button"
        onClick={toggleLanguage}
        className="absolute end-4 top-4 inline-flex items-center gap-2 rounded-full border border-cream-200 bg-white px-4 py-2 text-sm font-semibold text-text-secondary shadow-sm transition-colors hover:text-espresso sm:end-6 sm:top-6"
      >
        <Globe2 className="size-4 text-primary-500" aria-hidden="true" />
        {isRtl ? t("common.english") : t("common.arabic")}
      </button>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-7 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-primary-500 bg-white font-serif text-2xl text-primary-600 shadow-sm">
            E
          </div>
          <h1 className="mt-4 font-serif text-4xl text-espresso">
            {t("app.name")}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            {t("auth.secureAccess")}
          </p>
        </div>

        <section className="rounded-2xl border border-cream-200 bg-white p-6 shadow-sm sm:p-8">
          {(view === "signIn" || view === "signUp") && (
            <div
              className="mb-7 grid grid-cols-2 rounded-xl bg-cream-100 p-1"
              role="tablist"
              aria-label={t("auth.accountAccess")}
            >
              <button
                type="button"
                role="tab"
                aria-selected={view === "signIn"}
                onClick={() => switchView("signIn")}
                className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                  view === "signIn"
                    ? "bg-white text-espresso shadow-sm"
                    : "text-text-secondary hover:text-espresso"
                }`}
              >
                {t("auth.signIn")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === "signUp"}
                onClick={() => switchView("signUp")}
                className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                  view === "signUp"
                    ? "bg-white text-espresso shadow-sm"
                    : "text-text-secondary hover:text-espresso"
                }`}
              >
                {t("auth.createAccount")}
              </button>
            </div>
          )}

          {error && (
            <div
              className="mb-5 flex items-start gap-3 rounded-xl border border-error-500/20 bg-error-50 p-3 text-sm text-error-700"
              role="alert"
              aria-live="assertive"
            >
              <AlertCircle
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>{error}</span>
            </div>
          )}

          {view === "signIn" && (
            <form onSubmit={handleSignIn} noValidate>
              <AuthHeading
                title={t("auth.signInTitle")}
                description={t("auth.signInDescription")}
              />

              <div className="mt-6 space-y-4">
                <AuthInput
                  id="sign-in-email"
                  label={t("auth.email")}
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder={t("auth.emailPlaceholder")}
                  autoComplete="email"
                  icon={Mail}
                  error={fieldErrors.email}
                />
                <PasswordInput
                  id="sign-in-password"
                  label={t("auth.password")}
                  value={password}
                  onChange={setPassword}
                  placeholder={t("auth.passwordPlaceholder")}
                  autoComplete="current-password"
                  visible={showPassword}
                  onToggle={() => setShowPassword((current) => !current)}
                  error={fieldErrors.password}
                  showLabel={t("auth.showPassword")}
                  hideLabel={t("auth.hidePassword")}
                />
              </div>

              <button
                type="button"
                onClick={() => switchView("forgotPassword")}
                className="mt-3 text-sm font-semibold text-primary-600 hover:text-primary-700"
              >
                {t("auth.forgotPassword")}
              </button>

              <SubmitButton loading={loading} label={t("auth.signIn")} />
            </form>
          )}

          {view === "signUp" && (
            <form onSubmit={handleSignUp} noValidate>
              <AuthHeading
                title={t("auth.createAccountTitle")}
                description={t("auth.createAccountDescription")}
              />

              <div className="mt-6 space-y-4">
                <AuthInput
                  id="sign-up-name"
                  label={t("auth.fullName")}
                  type="text"
                  value={fullName}
                  onChange={setFullName}
                  placeholder={t("auth.fullNamePlaceholder")}
                  autoComplete="name"
                  icon={UserRound}
                  error={fieldErrors.fullName}
                />
                <AuthInput
                  id="sign-up-email"
                  label={t("auth.email")}
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder={t("auth.emailPlaceholder")}
                  autoComplete="email"
                  icon={Mail}
                  error={fieldErrors.email}
                />
                <PasswordInput
                  id="sign-up-password"
                  label={t("auth.password")}
                  value={password}
                  onChange={setPassword}
                  placeholder={t("auth.passwordPlaceholder")}
                  autoComplete="new-password"
                  visible={showPassword}
                  onToggle={() => setShowPassword((current) => !current)}
                  error={fieldErrors.password}
                  showLabel={t("auth.showPassword")}
                  hideLabel={t("auth.hidePassword")}
                />
                <PasswordInput
                  id="sign-up-confirm-password"
                  label={t("auth.confirmPassword")}
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder={t("auth.confirmPasswordPlaceholder")}
                  autoComplete="new-password"
                  visible={showConfirmPassword}
                  onToggle={() => setShowConfirmPassword((current) => !current)}
                  error={fieldErrors.confirmPassword}
                  showLabel={t("auth.showPassword")}
                  hideLabel={t("auth.hidePassword")}
                />
              </div>

              <SubmitButton loading={loading} label={t("auth.createAccount")} />
            </form>
          )}

          {view === "forgotPassword" && (
            <form onSubmit={handleResetPassword} noValidate>
              <AuthHeading
                title={t("auth.forgotPasswordTitle")}
                description={t("auth.forgotPasswordDescription")}
              />

              <div className="mt-6">
                <AuthInput
                  id="reset-email"
                  label={t("auth.email")}
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder={t("auth.emailPlaceholder")}
                  autoComplete="email"
                  icon={Mail}
                  error={fieldErrors.email}
                />
              </div>

              <SubmitButton loading={loading} label={t("auth.sendResetLink")} />
              <BackButton
                label={t("auth.backToSignIn")}
                onClick={() => switchView("signIn")}
              />
            </form>
          )}

          {view === "updatePassword" && (
            <form onSubmit={handleUpdatePassword} noValidate>
              <AuthHeading
                title={t("auth.updatePasswordTitle")}
                description={t("auth.updatePasswordDescription")}
              />

              <div className="mt-6 space-y-4">
                <PasswordInput
                  id="new-password"
                  label={t("auth.newPassword")}
                  value={password}
                  onChange={setPassword}
                  placeholder={t("auth.passwordPlaceholder")}
                  autoComplete="new-password"
                  visible={showPassword}
                  onToggle={() => setShowPassword((current) => !current)}
                  error={fieldErrors.password}
                  showLabel={t("auth.showPassword")}
                  hideLabel={t("auth.hidePassword")}
                />
                <PasswordInput
                  id="confirm-new-password"
                  label={t("auth.confirmPassword")}
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder={t("auth.confirmPasswordPlaceholder")}
                  autoComplete="new-password"
                  visible={showConfirmPassword}
                  onToggle={() => setShowConfirmPassword((current) => !current)}
                  error={fieldErrors.confirmPassword}
                  showLabel={t("auth.showPassword")}
                  hideLabel={t("auth.hidePassword")}
                />
              </div>

              <SubmitButton
                loading={loading}
                label={t("auth.updatePassword")}
              />
            </form>
          )}

          {view === "checkEmail" && (
            <ConfirmationPanel
              title={t(
                confirmationKind === "signUp"
                  ? "auth.checkEmailTitle"
                  : "auth.resetEmailTitle",
              )}
              description={t(
                confirmationKind === "signUp"
                  ? "auth.checkEmailDescription"
                  : "auth.resetEmailDescription",
                { email: email.trim() },
              )}
              actionLabel={t("auth.backToSignIn")}
              onAction={() => switchView("signIn")}
            />
          )}

          {view === "passwordUpdated" && (
            <ConfirmationPanel
              title={t("auth.passwordUpdatedTitle")}
              description={t("auth.passwordUpdatedDescription")}
              actionLabel={t("auth.continueToDashboard")}
              onAction={() => navigate("/dashboard", { replace: true })}
            />
          )}

          <div className="mt-7 flex items-center justify-center gap-2 border-t border-cream-200 pt-5 text-xs text-text-secondary">
            <ShieldCheck
              className="size-4 text-success-500"
              aria-hidden="true"
            />
            {t("auth.privacyNote")}
          </div>
        </section>

        <nav
          className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-semibold text-primary-700"
          aria-label={t("legal.navigationLabel")}
        >
          <Link
            className="hover:text-primary-800 hover:underline"
            to="/legal/terms"
          >
            {t("legal.nav.terms")}
          </Link>
          <Link
            className="hover:text-primary-800 hover:underline"
            to="/legal/privacy"
          >
            {t("legal.nav.privacy")}
          </Link>
          <Link
            className="hover:text-primary-800 hover:underline"
            to="/legal/refunds"
          >
            {t("legal.nav.refunds")}
          </Link>
          <Link
            className="hover:text-primary-800 hover:underline"
            to="/legal/contact"
          >
            {t("legal.nav.contact")}
          </Link>
        </nav>
        <p className="mt-3 text-center text-[0.7rem] leading-5 text-text-secondary">
          {t("legal.companyLine")}
        </p>
      </div>
    </main>
  );
}

interface AuthHeadingProps {
  title: string;
  description: string;
}

function AuthHeading({ title, description }: AuthHeadingProps) {
  return (
    <div>
      <h2 className="font-serif text-2xl text-espresso">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-text-secondary">
        {description}
      </p>
    </div>
  );
}

interface AuthInputProps {
  id: string;
  label: string;
  type: "email" | "text";
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
  icon: typeof Mail;
  error?: string;
}

function AuthInput({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  icon: Icon,
  error,
}: AuthInputProps) {
  const errorId = `${id}-error`;

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-semibold text-espresso"
      >
        {label}
      </label>
      <div className="relative">
        <Icon
          className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-text-secondary"
          aria-hidden="true"
        />
        <input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="h-12 w-full rounded-xl border border-cream-200 bg-white ps-10 pe-4 text-sm text-espresso shadow-sm outline-none transition-colors placeholder:text-text-secondary/70 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15"
        />
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

interface PasswordInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
  visible: boolean;
  onToggle: () => void;
  error?: string;
  showLabel: string;
  hideLabel: string;
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  visible,
  onToggle,
  error,
  showLabel,
  hideLabel,
}: PasswordInputProps) {
  const errorId = `${id}-error`;

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-semibold text-espresso"
      >
        {label}
      </label>
      <div className="relative">
        <LockKeyhole
          className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-text-secondary"
          aria-hidden="true"
        />
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="h-12 w-full rounded-xl border border-cream-200 bg-white ps-10 pe-11 text-sm text-espresso shadow-sm outline-none transition-colors placeholder:text-text-secondary/70 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-full p-2 text-text-secondary transition-colors hover:bg-cream-100 hover:text-espresso"
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

function FieldError({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} className="mt-1.5 text-xs font-medium text-error-600">
      {children}
    </p>
  );
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  const { t } = useTranslation();

  return (
    <button
      type="submit"
      disabled={loading}
      className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading && (
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      )}
      {loading ? t("common.loading") : label}
    </button>
  );
}

function BackButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 w-full text-center text-sm font-semibold text-primary-600 hover:text-primary-700"
    >
      {label}
    </button>
  );
}

interface ConfirmationPanelProps {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}

function ConfirmationPanel({
  title,
  description,
  actionLabel,
  onAction,
}: ConfirmationPanelProps) {
  return (
    <div className="py-4 text-center" role="status" aria-live="polite">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-50 text-success-700">
        <CheckCircle2 className="size-7" aria-hidden="true" />
      </div>
      <h2 className="mt-5 font-serif text-2xl text-espresso">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-text-secondary">
        {description}
      </p>
      <button
        type="button"
        onClick={onAction}
        className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary-500 px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-600"
      >
        {actionLabel}
      </button>
    </div>
  );
}
