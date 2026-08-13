import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Camera,
  Check,
  Globe2,
  KeyRound,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  BusyLabel,
  ErrorState,
  fieldClass,
  formatDate,
  labelClass,
  Modal,
  OutlineButton,
  PageHeader,
  PageSkeleton,
  PrimaryButton,
  StatusBadge,
  SurfaceCard,
} from "@/components/EquiVistaUI";
import { useAuth } from "@/contexts/AuthContext";
import {
  useNotificationPrefs,
  useProfile,
  useUpdateNotificationPrefs,
  useUpdateProfile,
} from "@/hooks/use-profile";
import type { NotificationPrefs } from "@/hooks/types";
import { getSafeAvatarUrl, isAllowedAvatarFile } from "@/lib/avatar-security";

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const profileQuery = useProfile();
  const prefsQuery = useNotificationPrefs();
  const profileMutation = useUpdateProfile();
  const prefsMutation = useUpdateNotificationPrefs();
  const { updatePassword, signOut } = useAuth();
  const avatarInput = useRef<HTMLInputElement>(null);
  const [profileDraft, setProfileDraft] = useState({ fullName: "", phone: "" });
  const [ridingDraft, setRidingDraft] = useState({ discipline: "", skillLevel: "", goals: "" });
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const locale = (i18n.resolvedLanguage ?? i18n.language) === "ar" ? "ar-JO" : "en-US";

  useEffect(() => {
    if (!profileQuery.data) return;
    setProfileDraft({ fullName: profileQuery.data.fullName, phone: profileQuery.data.phone ?? "" });
    setRidingDraft({
      discipline: profileQuery.data.discipline ?? "",
      skillLevel: profileQuery.data.skillLevel ?? "",
      goals: profileQuery.data.goals ?? "",
    });
  }, [profileQuery.data]);

  useEffect(() => {
    if (prefsQuery.data) setPrefs(prefsQuery.data);
  }, [prefsQuery.data]);

  useEffect(() => {
    if (!avatar) {
      setAvatarPreviewUrl(null);
      return;
    }

    const previewUrl = URL.createObjectURL(avatar);
    setAvatarPreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [avatar]);

  if (profileQuery.loading && prefsQuery.loading) return <PageSkeleton />;

  const saveProfile = async () => {
    setActionError(null);
    const ok = await profileMutation.update({
      fullName: profileDraft.fullName.trim(),
      phone: profileDraft.phone.trim(),
      avatar: avatar ?? undefined,
    });
    if (ok) {
      setAvatar(null);
      setNotice(t("settings.profileSaved"));
      profileQuery.refetch();
    }
  };

  const saveRiding = async () => {
    setActionError(null);
    const ok = await profileMutation.update({
      discipline: ridingDraft.discipline,
      skillLevel: ridingDraft.skillLevel,
      goals: ridingDraft.goals.trim(),
    });
    if (ok) {
      setNotice(t("settings.ridingSaved"));
      profileQuery.refetch();
    }
  };

  const updatePrefs = async (patch: Partial<NotificationPrefs>) => {
    if (!prefs) return;
    const previous = prefs;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setActionError(null);
    try {
      await prefsMutation.update(patch);
      setNotice(t("settings.notificationsSaved"));
    } catch (error) {
      setPrefs(previous);
      setActionError(error instanceof Error ? error.message : t("common.requestFailed"));
    }
  };

  const changeLanguage = async (language: "en" | "ar") => {
    const previous = i18n.resolvedLanguage ?? i18n.language;
    setActionError(null);
    await i18n.changeLanguage(language);
    const ok = await profileMutation.update({ locale: language });
    if (!ok) {
      await i18n.changeLanguage(previous);
      setActionError(profileMutation.error ?? t("common.requestFailed"));
      return;
    }
    profileQuery.refetch();
    setNotice(t("settings.languageSaved"));
  };

  const submitPassword = async () => {
    setActionError(null);
    if (password.length < 8) {
      setActionError(t("auth.validation.passwordTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      setActionError(t("auth.validation.passwordMismatch"));
      return;
    }
    setPasswordSaving(true);
    const result = await updatePassword(password);
    setPasswordSaving(false);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setPassword("");
    setConfirmPassword("");
    setPasswordOpen(false);
    setNotice(t("settings.passwordSaved"));
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  const profile = profileQuery.data;
  const storedAvatarUrl = getSafeAvatarUrl(profile?.avatarUrl, window.location.origin);
  const displayedAvatarUrl = avatarPreviewUrl ?? storedAvatarUrl;

  return (
    <div>
      <PageHeader eyebrow={t("settings.eyebrow")} title={t("settings.title")} description={t("settings.description")} />

      {profileQuery.error ? <ErrorState message={profileQuery.error} retryLabel={t("common.tryAgain")} onRetry={profileQuery.refetch} /> : null}
      {prefsQuery.error ? <div className="mt-4"><ErrorState message={prefsQuery.error} /></div> : null}
      {profileMutation.error || actionError ? <div className="mt-4"><ErrorState message={profileMutation.error ?? actionError ?? t("common.requestFailed")} /></div> : null}
      {notice ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-success-500/25 bg-success-50 px-4 py-3 text-sm font-semibold text-success-700" role="status">
          <Check className="size-4" aria-hidden="true" />{notice}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SurfaceCard className="p-6">
          <div className="mb-6 flex items-start gap-4">
            <div className="relative">
              <div className="flex size-20 items-center justify-center overflow-hidden rounded-full border border-cream-200 bg-cream-100 text-primary-600">
                {displayedAvatarUrl ? <img src={displayedAvatarUrl} alt="" className="size-full object-cover" /> : <UserRound className="size-8" aria-hidden="true" />}
              </div>
              <button type="button" onClick={() => avatarInput.current?.click()} className="absolute -bottom-1 -end-1 flex size-8 items-center justify-center rounded-full border border-cream-200 bg-white text-primary-600 shadow-sm" aria-label={t("settings.changeAvatar")}>
                <Camera className="size-4" aria-hidden="true" />
              </button>
              <input
                ref={avatarInput}
                type="file"
                accept="image/gif,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  const selected = event.target.files?.[0] ?? null;
                  if (selected && !isAllowedAvatarFile(selected)) {
                    setAvatar(null);
                    setActionError(t("settings.invalidAvatarType"));
                    event.target.value = "";
                    return;
                  }
                  setActionError(null);
                  setAvatar(selected);
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-600">{t("settings.profile")}</p>
              <h2 className="mt-1 truncate text-2xl text-espresso">{profile?.fullName || t("settings.yourProfile")}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {profile ? <StatusBadge status="active" label={t(`settings.roles.${profile.role}`)} /> : null}
                <span className="text-xs text-text-secondary">{t("settings.memberSince", { date: formatDate(profile?.joinedAt, locale, { month: "long", year: "numeric" }) })}</span>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <label className="block"><span className={labelClass}>{t("auth.fullName")}</span><input className={fieldClass} value={profileDraft.fullName} onChange={(event) => setProfileDraft((current) => ({ ...current, fullName: event.target.value }))} /></label>
            <label className="block"><span className={labelClass}>{t("auth.email")}</span><input className={`${fieldClass} bg-cream-50`} value={profile?.email ?? ""} disabled /></label>
            <label className="block"><span className={labelClass}>{t("settings.phone")}</span><input className={fieldClass} value={profileDraft.phone} onChange={(event) => setProfileDraft((current) => ({ ...current, phone: event.target.value }))} /></label>
          </div>
          <div className="mt-5 flex justify-end"><PrimaryButton onClick={saveProfile} disabled={profileMutation.saving || !profileDraft.fullName.trim()}>{profileMutation.saving ? <BusyLabel label={t("common.saving")} /> : t("common.saveChanges")}</PrimaryButton></div>
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary-50 text-primary-600"><ShieldCheck className="size-5" aria-hidden="true" /></span>
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-600">{t("settings.riding")}</p><h2 className="text-2xl text-espresso">{t("settings.ridingProfile")}</h2></div>
          </div>
          <div className="space-y-4">
            <label className="block"><span className={labelClass}>{t("settings.discipline")}</span><select className={fieldClass} value={ridingDraft.discipline} onChange={(event) => setRidingDraft((current) => ({ ...current, discipline: event.target.value }))}><option value="">{t("common.selectOption")}</option><option value="Flatwork">{t("settings.disciplines.flatwork")}</option><option value="Show jumping">{t("settings.disciplines.showJumping")}</option><option value="Dressage">{t("settings.disciplines.dressage")}</option></select></label>
            <label className="block"><span className={labelClass}>{t("settings.skillLevel")}</span><select className={fieldClass} value={ridingDraft.skillLevel} onChange={(event) => setRidingDraft((current) => ({ ...current, skillLevel: event.target.value }))}><option value="">{t("common.selectOption")}</option><option value="Beginner">{t("settings.skills.beginner")}</option><option value="Intermediate">{t("settings.skills.intermediate")}</option><option value="Advanced">{t("settings.skills.advanced")}</option><option value="Professional">{t("settings.skills.professional")}</option></select></label>
            <label className="block"><span className={labelClass}>{t("settings.goals")}</span><textarea className={`${fieldClass} min-h-28 resize-y`} value={ridingDraft.goals} onChange={(event) => setRidingDraft((current) => ({ ...current, goals: event.target.value }))} /></label>
          </div>
          <div className="mt-5 flex justify-end"><PrimaryButton onClick={saveRiding} disabled={profileMutation.saving}>{profileMutation.saving ? <BusyLabel label={t("common.saving")} /> : t("common.saveChanges")}</PrimaryButton></div>
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary-50 text-primary-600"><Bell className="size-5" aria-hidden="true" /></span>
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-600">{t("settings.notifications")}</p><h2 className="text-2xl text-espresso">{t("settings.notificationPreferences")}</h2></div>
          </div>
          {prefs ? (
            <>
              <div className="mb-5 grid grid-cols-3 rounded-xl border border-cream-200 bg-cream-50 p-1" role="radiogroup" aria-label={t("settings.channel")}>
                {(["email", "push", "both"] as const).map((channel) => <button key={channel} type="button" role="radio" aria-checked={prefs.channel === channel} onClick={() => updatePrefs({ channel })} className={`rounded-lg px-2 py-2 text-sm font-bold ${prefs.channel === channel ? "bg-white text-primary-700 shadow-sm" : "text-text-secondary"}`}>{t(`settings.channels.${channel}`)}</button>)}
              </div>
              <div className="divide-y divide-cream-200">
                {(["lessonReminders", "analysisReady", "paymentReceipts", "marketing"] as const).map((key) => (
                  <label key={key} className="flex cursor-pointer items-center justify-between gap-4 py-4">
                    <span><span className="block text-sm font-bold text-espresso">{t(`settings.notificationLabels.${key}`)}</span><span className="mt-1 block text-xs text-text-secondary">{t(`settings.notificationDescriptions.${key}`)}</span></span>
                    <button type="button" role="switch" aria-checked={prefs[key]} onClick={() => updatePrefs({ [key]: !prefs[key] })} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${prefs[key] ? "bg-primary-500" : "bg-cream-300"}`}><span className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition-all ${prefs[key] ? "end-1" : "start-1"}`} /></button>
                  </label>
                ))}
              </div>
            </>
          ) : <p className="text-sm text-text-secondary">{t("settings.noNotificationPrefs")}</p>}
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary-50 text-primary-600"><KeyRound className="size-5" aria-hidden="true" /></span>
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-600">{t("settings.security")}</p><h2 className="text-2xl text-espresso">{t("settings.accountSecurity")}</h2></div>
          </div>
          <div className="space-y-3">
            <button type="button" onClick={() => setPasswordOpen(true)} className="flex w-full items-center justify-between rounded-xl border border-cream-200 p-4 text-start hover:border-primary-300 hover:bg-primary-50"><span><span className="block text-sm font-bold text-espresso">{t("settings.changePassword")}</span><span className="mt-1 block text-xs text-text-secondary">{t("settings.changePasswordDescription")}</span></span><KeyRound className="size-5 text-primary-600" aria-hidden="true" /></button>
            <button type="button" onClick={handleSignOut} className="flex w-full items-center justify-between rounded-xl border border-error-500/20 p-4 text-start hover:bg-error-50"><span><span className="block text-sm font-bold text-error-700">{t("settings.signOutCurrent")}</span><span className="mt-1 block text-xs text-text-secondary">{t("settings.signOutCurrentDescription")}</span></span><LogOut className="size-5 text-error-500" aria-hidden="true" /></button>
          </div>
          <div className="mt-6 border-t border-cream-200 pt-5">
            <div className="mb-3 flex items-center gap-2"><Globe2 className="size-5 text-primary-600" aria-hidden="true" /><h3 className="font-sans text-sm font-bold text-espresso">{t("settings.language")}</h3></div>
            <div className="grid grid-cols-2 rounded-xl border border-cream-200 bg-cream-50 p-1">
              <button type="button" onClick={() => changeLanguage("en")} className={`rounded-lg px-3 py-2.5 text-sm font-bold ${(i18n.resolvedLanguage ?? i18n.language) === "en" ? "bg-white text-primary-700 shadow-sm" : "text-text-secondary"}`}>English</button>
              <button type="button" onClick={() => changeLanguage("ar")} className={`rounded-lg px-3 py-2.5 text-sm font-bold ${(i18n.resolvedLanguage ?? i18n.language) === "ar" ? "bg-white text-primary-700 shadow-sm" : "text-text-secondary"}`}>العربية</button>
            </div>
          </div>
        </SurfaceCard>
      </div>

      <Modal open={passwordOpen} title={t("settings.changePassword")} description={t("settings.passwordDialogDescription")} onClose={() => setPasswordOpen(false)} footer={<><OutlineButton onClick={() => setPasswordOpen(false)}>{t("common.cancel")}</OutlineButton><PrimaryButton onClick={submitPassword} disabled={passwordSaving}>{passwordSaving ? <BusyLabel label={t("common.saving")} /> : t("settings.updatePassword")}</PrimaryButton></>}>
        <div className="space-y-4">
          <label className="block"><span className={labelClass}>{t("auth.newPassword")}</span><input type="password" className={fieldClass} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <label className="block"><span className={labelClass}>{t("auth.confirmPassword")}</span><input type="password" className={fieldClass} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
        </div>
      </Modal>
    </div>
  );
}
