import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Building2,
  Check,
  Pencil,
  Plus,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import {
  BusyLabel,
  EmptyState,
  ErrorState,
  fieldClass,
  labelClass,
  Modal,
  OutlineButton,
  PageHeader,
  PageSkeleton,
  PrimaryButton,
  StatusBadge,
  SurfaceCard,
} from "@/components/EquiVistaUI";
import { AcademyOnboarding } from "@/components/AcademyOnboarding";
import { useAuth } from "@/contexts/AuthContext";
import {
  type OrganizationMember,
  useOrganizationActions,
  useOrganizationMembers,
} from "@/hooks/use-organization";

const memberRoleOptions = [
  "academy_admin",
  "coach",
  "rider",
  "guardian",
  "horse_owner",
  "stable_manager",
  "accountant",
  "competition_manager",
] as const;

const organizationTypes = [
  "academy",
  "stable",
  "federation",
  "competition_center",
  "private_trainer",
] as const;

const emptyMemberDraft = {
  email: "",
  status: "active" as OrganizationMember["status"],
  roles: ["rider"],
};

export default function OrganizationPage() {
  const { t } = useTranslation();
  const {
    roles,
    organizations,
    activeOrganization,
    setActiveOrganization,
    refreshRoles,
    hasRole,
  } = useAuth();
  const platformAdmin = hasRole("platform_admin");
  const canManage =
    platformAdmin ||
    roles.some(
      (role) =>
        role.branch_id === activeOrganization?.id &&
        role.role_name === "academy_admin",
    );
  const membersQuery = useOrganizationMembers(
    canManage ? activeOrganization?.id : undefined,
  );
  const actions = useOrganizationActions();
  const [createOpen, setCreateOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [createDraft, setCreateDraft] = useState({
    name: "",
    slug: "",
    organizationType: "academy",
  });
  const [memberDraft, setMemberDraft] = useState(emptyMemberDraft);
  const [nameDraft, setNameDraft] = useState("");

  useEffect(() => {
    setNameDraft(activeOrganization?.name ?? "");
  }, [activeOrganization?.name]);

  const openMember = (member?: OrganizationMember) => {
    setMemberDraft(
      member
        ? {
            email: member.email,
            status: member.status,
            roles: member.roles,
          }
        : emptyMemberDraft,
    );
    setMemberOpen(true);
  };

  const toggleRole = (role: string) => {
    setMemberDraft((current) => ({
      ...current,
      roles: current.roles.includes(role)
        ? current.roles.filter((currentRole) => currentRole !== role)
        : [...current.roles, role],
    }));
  };

  const createOrganization = async () => {
    const result = await actions.createOrganization(createDraft);
    if (!result) return;
    setCreateOpen(false);
    setCreateDraft({ name: "", slug: "", organizationType: "academy" });
    setNotice(t("organization.created"));
    await refreshRoles();
  };

  const saveMember = async () => {
    if (!activeOrganization) return;
    const result = await actions.manageMember({
      organizationId: activeOrganization.id,
      ...memberDraft,
    });
    if (!result) return;
    setMemberOpen(false);
    setMemberDraft(emptyMemberDraft);
    setNotice(t("organization.memberSaved"));
    membersQuery.refetch();
    await refreshRoles();
  };

  const saveName = async () => {
    if (!activeOrganization) return;
    const result = await actions.updateName(
      activeOrganization.id,
      nameDraft.trim(),
    );
    if (!result) return;
    setRenameOpen(false);
    setNotice(t("organization.nameSaved"));
    await refreshRoles();
  };

  if (!activeOrganization && organizations.length === 0 && !platformAdmin) {
    return (
      <div>
        <PageHeader
          eyebrow={t("organization.eyebrow")}
          title={t("organization.title")}
          description={t("organization.description")}
        />
        <SurfaceCard>
          <EmptyState
            icon={Building2}
            title={t("organization.noOrganizationTitle")}
            description={t("organization.noOrganizationDescription")}
          />
        </SurfaceCard>
      </div>
    );
  }

  if (membersQuery.loading && canManage && activeOrganization)
    return <PageSkeleton />;

  return (
    <div>
      <PageHeader
        eyebrow={t("organization.eyebrow")}
        title={t("organization.title")}
        description={t("organization.description")}
        actions={
          platformAdmin ? (
            <PrimaryButton onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" aria-hidden="true" />
              {t("organization.create")}
            </PrimaryButton>
          ) : undefined
        }
      />

      {actions.error ? <ErrorState message={actions.error} /> : null}
      {membersQuery.error && canManage ? (
        <div className="mt-4">
          <ErrorState
            message={membersQuery.error}
            retryLabel={t("common.tryAgain")}
            onRetry={membersQuery.refetch}
          />
        </div>
      ) : null}
      {notice ? (
        <div
          className="mt-4 flex items-center gap-2 rounded-xl border border-success-500/25 bg-success-50 px-4 py-3 text-sm font-semibold text-success-700"
          role="status"
        >
          <Check className="size-4" aria-hidden="true" />
          {notice}
        </div>
      ) : null}

      {organizations.length > 1 ? (
        <SurfaceCard className="mt-6 p-5">
          <label className="block max-w-lg">
            <span className={labelClass}>
              {t("organization.activeOrganization")}
            </span>
            <select
              className={fieldClass}
              value={activeOrganization?.id ?? ""}
              onChange={(event) => setActiveOrganization(event.target.value)}
            >
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </label>
        </SurfaceCard>
      ) : null}

      {activeOrganization ? (
        <>
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <SurfaceCard className="p-6">
            <div className="flex items-start justify-between gap-4">
              <span className="flex size-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                <Building2 className="size-6" aria-hidden="true" />
              </span>
              {canManage ? (
                <OutlineButton onClick={() => setRenameOpen(true)}>
                  <Pencil className="size-4" aria-hidden="true" />
                  {t("organization.rename")}
                </OutlineButton>
              ) : null}
            </div>
            <h2 className="mt-5 text-2xl text-espresso">
              {activeOrganization.name}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {activeOrganization.slug}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <StatusBadge
                status="active"
                label={t(
                  `organization.types.${activeOrganization.organizationType}`,
                )}
              />
              {activeOrganization.roles.map((role) => (
                <span
                  key={role}
                  className="rounded-full bg-cream-100 px-2.5 py-1 text-xs font-semibold text-text-secondary"
                >
                  {t(`organization.roles.${role}`)}
                </span>
              ))}
              {platformAdmin ? (
                <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700">
                  {t("organization.roles.platform_admin")}
                </span>
              ) : null}
            </div>
            </SurfaceCard>

            <SurfaceCard className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-cream-200 px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-600">
                  {t("organization.membersEyebrow")}
                </p>
                <h2 className="mt-1 text-2xl text-espresso">
                  {canManage
                    ? t("organization.membersTitle")
                    : t("organization.memberAccessTitle")}
                </h2>
              </div>
              {canManage ? (
                <PrimaryButton onClick={() => openMember()}>
                  <Plus className="size-4" aria-hidden="true" />
                  {t("organization.addMember")}
                </PrimaryButton>
              ) : null}
            </div>

            {canManage ? (
              membersQuery.data?.length ? (
                <div className="divide-y divide-cream-200">
                  {membersQuery.data.map((member) => (
                    <button
                      key={member.membershipId}
                      type="button"
                      onClick={() => openMember(member)}
                      className="flex w-full flex-col gap-3 px-6 py-4 text-start transition-colors hover:bg-cream-50 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-espresso">
                          {member.fullName || member.email}
                        </p>
                        <p className="truncate text-sm text-text-secondary">
                          {member.email}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge
                          status={member.status}
                          label={t(`organization.statuses.${member.status}`)}
                        />
                        {member.roles.map((role) => (
                          <span
                            key={role}
                            className="rounded-full bg-cream-100 px-2.5 py-1 text-xs font-semibold text-text-secondary"
                          >
                            {t(`organization.roles.${role}`)}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={UsersRound}
                  title={t("organization.noMembersTitle")}
                  description={t("organization.noMembersDescription")}
                  compact
                />
              )
            ) : (
              <EmptyState
                icon={ShieldCheck}
                title={t("organization.memberAccessTitle")}
                description={t("organization.memberAccessDescription")}
                compact
              />
            )}
            </SurfaceCard>
          </div>
          {canManage ? (
            <AcademyOnboarding organizationId={activeOrganization.id} />
          ) : null}
        </>
      ) : (
        <SurfaceCard className="mt-6">
          <EmptyState
            icon={Building2}
            title={t("organization.noOrganizationsTitle")}
            description={t("organization.noOrganizationsDescription")}
            action={
              platformAdmin ? (
                <PrimaryButton onClick={() => setCreateOpen(true)}>
                  {t("organization.create")}
                </PrimaryButton>
              ) : undefined
            }
          />
        </SurfaceCard>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t("organization.createTitle")}
        description={t("organization.createDescription")}
        footer={
          <>
            <OutlineButton onClick={() => setCreateOpen(false)}>
              {t("common.cancel")}
            </OutlineButton>
            <PrimaryButton
              onClick={createOrganization}
              disabled={
                actions.working ||
                !createDraft.name.trim() ||
                !createDraft.slug.trim()
              }
            >
              {actions.working ? (
                <BusyLabel label={t("common.working")} />
              ) : (
                t("organization.create")
              )}
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className={labelClass}>{t("organization.name")}</span>
            <input
              className={fieldClass}
              value={createDraft.name}
              onChange={(event) =>
                setCreateDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </label>
          <label className="block">
            <span className={labelClass}>{t("organization.slug")}</span>
            <input
              className={fieldClass}
              value={createDraft.slug}
              onChange={(event) =>
                setCreateDraft((current) => ({
                  ...current,
                  slug: event.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, "-"),
                }))
              }
            />
          </label>
          <label className="block">
            <span className={labelClass}>{t("organization.type")}</span>
            <select
              className={fieldClass}
              value={createDraft.organizationType}
              onChange={(event) =>
                setCreateDraft((current) => ({
                  ...current,
                  organizationType: event.target.value,
                }))
              }
            >
              {organizationTypes.map((type) => (
                <option key={type} value={type}>
                  {t(`organization.types.${type}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Modal>

      <Modal
        open={memberOpen}
        onClose={() => setMemberOpen(false)}
        title={t("organization.manageMemberTitle")}
        description={t("organization.manageMemberDescription")}
        footer={
          <>
            <OutlineButton onClick={() => setMemberOpen(false)}>
              {t("common.cancel")}
            </OutlineButton>
            <PrimaryButton
              onClick={saveMember}
              disabled={
                actions.working ||
                !memberDraft.email.trim() ||
                (memberDraft.status === "active" &&
                  memberDraft.roles.length === 0)
              }
            >
              {actions.working ? (
                <BusyLabel label={t("common.saving")} />
              ) : (
                t("common.saveChanges")
              )}
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-5">
          <label className="block">
            <span className={labelClass}>{t("auth.email")}</span>
            <input
              type="email"
              className={fieldClass}
              value={memberDraft.email}
              onChange={(event) =>
                setMemberDraft((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
            />
          </label>
          <label className="block">
            <span className={labelClass}>{t("organization.status")}</span>
            <select
              className={fieldClass}
              value={memberDraft.status}
              onChange={(event) =>
                setMemberDraft((current) => ({
                  ...current,
                  status: event.target.value as OrganizationMember["status"],
                }))
              }
            >
              {(["active", "suspended", "left"] as const).map((status) => (
                <option key={status} value={status}>
                  {t(`organization.statuses.${status}`)}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend className={labelClass}>
              {t("organization.rolesLabel")}
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {memberRoleOptions
                .filter((role) => platformAdmin || role !== "academy_admin")
                .map((role) => (
                  <label
                    key={role}
                    className="flex items-center gap-3 rounded-xl border border-cream-200 bg-cream-50 px-3 py-2.5 text-sm text-espresso"
                  >
                    <input
                      type="checkbox"
                      checked={memberDraft.roles.includes(role)}
                      onChange={() => toggleRole(role)}
                      className="size-4 accent-primary-500"
                    />
                    {t(`organization.roles.${role}`)}
                  </label>
                ))}
            </div>
          </fieldset>
        </div>
      </Modal>

      <Modal
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title={t("organization.renameTitle")}
        footer={
          <>
            <OutlineButton onClick={() => setRenameOpen(false)}>
              {t("common.cancel")}
            </OutlineButton>
            <PrimaryButton
              onClick={saveName}
              disabled={actions.working || nameDraft.trim().length < 2}
            >
              {actions.working ? (
                <BusyLabel label={t("common.saving")} />
              ) : (
                t("common.saveChanges")
              )}
            </PrimaryButton>
          </>
        }
      >
        <label className="block">
          <span className={labelClass}>{t("organization.name")}</span>
          <input
            className={fieldClass}
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
          />
        </label>
      </Modal>
    </div>
  );
}
