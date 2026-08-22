import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BusyLabel,
  ErrorState,
  PrimaryButton,
  SurfaceCard,
} from "@/components/EquiVistaUI";
import { useAuth } from "@/contexts/AuthContext";
import { useAcademyOnboardingActions } from "@/hooks/use-academy-onboarding";

export default function OnboardingInvitePage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshRoles } = useAuth();
  const actions = useAcademyOnboardingActions();
  const [accepted, setAccepted] = useState(false);
  const token = new URLSearchParams(location.search).get("invite") ?? "";
  const validShape = /^[a-f0-9]{64}$/.test(token);

  const accept = async () => {
    if (!validShape) return;
    const organizationId = await actions.claimInvitation(token);
    if (!organizationId) return;
    await refreshRoles();
    setAccepted(true);
    navigate("/onboarding/accept", { replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream-50 px-4 py-10">
      <SurfaceCard className="w-full max-w-lg p-8 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary-50 text-primary-600">
          {accepted ? <CheckCircle2 className="size-7" /> : <ShieldCheck className="size-7" />}
        </span>
        <h1 className="mt-5 font-serif text-3xl text-espresso">
          {accepted
            ? t("organization.onboarding.acceptedTitle")
            : t("organization.onboarding.acceptTitle")}
        </h1>
        <p className="mt-3 text-sm text-text-secondary">
          {accepted
            ? t("organization.onboarding.acceptedDescription")
            : t("organization.onboarding.acceptDescription")}
        </p>

        {!validShape && !accepted ? (
          <div className="mt-6 text-start">
            <ErrorState message={t("organization.onboarding.invalidInvite")} />
          </div>
        ) : null}
        {actions.error ? (
          <div className="mt-6 text-start"><ErrorState message={actions.error} /></div>
        ) : null}

        <div className="mt-7">
          {accepted ? (
            <PrimaryButton onClick={() => navigate("/dashboard", { replace: true })}>
              {t("organization.onboarding.continue")}
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={accept} disabled={!validShape || actions.working}>
              {actions.working ? <BusyLabel label={t("common.working")} /> : t("organization.onboarding.accept")}
            </PrimaryButton>
          )}
        </div>
      </SurfaceCard>
    </main>
  );
}
