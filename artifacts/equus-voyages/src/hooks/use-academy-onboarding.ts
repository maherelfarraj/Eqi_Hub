import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useQuery } from "./_shared";

export interface AcademyOnboardingEntry {
  email: string;
  fullName: string;
  roles: string[];
}

export interface AcademyOnboardingValidationError {
  row: number;
  field: string;
  message: string;
}

export interface AcademyOnboardingPreview {
  valid: boolean;
  rowCount: number;
  existingAccountCount: number;
  errors: AcademyOnboardingValidationError[];
}

export interface AcademyOnboardingBatch {
  id: string;
  name: string;
  status: "active" | "closed" | "cancelled";
  rowCount: number;
  pendingCount: number;
  acceptedCount: number;
  revokedCount: number;
  createdAt: string;
  closedAt: string | null;
}

export interface GeneratedAcademyInvitation {
  invitationId: string;
  email: string;
  fullName: string;
  roles: string[];
  inviteToken: string;
  expiresAt: string;
}

export interface AcademyOnboardingInvitation {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  reissueCount: number;
  lastReissuedAt: string | null;
}

export interface AcademyOnboardingMetrics {
  totalBatches: number;
  activeBatches: number;
  pendingInvitations: number;
  expiringIn24Hours: number;
  expiringIn7Days: number;
  acceptedInvitations: number;
  revokedInvitations: number;
  expiredInvitations: number;
  replacementLinksGenerated: number;
  acceptanceRate: number;
}

export interface AcademyOnboardingActivity {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorName: string;
  details: Record<string, unknown>;
  occurredAt: string;
}

interface BatchRow {
  id: string;
  name: string;
  status: AcademyOnboardingBatch["status"];
  row_count: number;
  pending_count: number;
  accepted_count: number;
  revoked_count: number;
  created_at: string;
  closed_at: string | null;
}

interface InvitationRow {
  invitation_id: string;
  email: string;
  full_name: string;
  roles: string[];
  invite_token: string;
  expires_at: string;
}

interface InvitationOperationsRow {
  id: string;
  email: string;
  full_name: string;
  roles: string[];
  status: AcademyOnboardingInvitation["status"];
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  reissue_count: number;
  last_reissued_at: string | null;
}

interface MetricsRow {
  total_batches: number;
  active_batches: number;
  pending_invitations: number;
  expiring_in_24_hours: number;
  expiring_in_7_days: number;
  accepted_invitations: number;
  revoked_invitations: number;
  expired_invitations: number;
  replacement_links_generated: number;
  acceptance_rate: number;
}

interface ActivityRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_name: string;
  details: Record<string, unknown>;
  occurred_at: string;
}

export function useAcademyOnboardingBatches(
  organizationId: string | undefined,
) {
  return useQuery<AcademyOnboardingBatch[]>(async () => {
    if (!organizationId) return [];
    const { data, error } = await supabase.rpc(
      "get_academy_onboarding_batches",
      { p_organization_id: organizationId },
    );
    if (error) throw error;

    return ((data ?? []) as BatchRow[]).map((batch) => ({
      id: batch.id,
      name: batch.name,
      status: batch.status,
      rowCount: batch.row_count,
      pendingCount: Number(batch.pending_count),
      acceptedCount: Number(batch.accepted_count),
      revokedCount: Number(batch.revoked_count),
      createdAt: batch.created_at,
      closedAt: batch.closed_at,
    }));
  }, [organizationId]);
}

export function useAcademyOnboardingInvitations(
  organizationId: string | undefined,
  batchId: string | undefined,
) {
  return useQuery<AcademyOnboardingInvitation[]>(
    async () => {
      if (!organizationId || !batchId) return [];
      const { data, error } = await supabase.rpc(
        "get_academy_onboarding_invitations",
        { p_organization_id: organizationId, p_batch_id: batchId },
      );
      if (error) throw error;

      return ((data ?? []) as InvitationOperationsRow[]).map((invitation) => ({
        id: invitation.id,
        email: invitation.email,
        fullName: invitation.full_name,
        roles: invitation.roles,
        status: invitation.status,
        expiresAt: invitation.expires_at,
        acceptedAt: invitation.accepted_at,
        createdAt: invitation.created_at,
        reissueCount: Number(invitation.reissue_count),
        lastReissuedAt: invitation.last_reissued_at,
      }));
    },
    [organizationId, batchId],
    { resetOnChange: true },
  );
}

export function useAcademyOnboardingMetrics(
  organizationId: string | undefined,
) {
  return useQuery<AcademyOnboardingMetrics | null>(async () => {
    if (!organizationId) return null;
    const { data, error } = await supabase.rpc(
      "get_academy_onboarding_metrics",
      { p_organization_id: organizationId },
    );
    if (error) throw error;
    const row = ((data ?? []) as MetricsRow[])[0];
    if (!row) return null;
    return {
      totalBatches: Number(row.total_batches),
      activeBatches: Number(row.active_batches),
      pendingInvitations: Number(row.pending_invitations),
      expiringIn24Hours: Number(row.expiring_in_24_hours),
      expiringIn7Days: Number(row.expiring_in_7_days),
      acceptedInvitations: Number(row.accepted_invitations),
      revokedInvitations: Number(row.revoked_invitations),
      expiredInvitations: Number(row.expired_invitations),
      replacementLinksGenerated: Number(row.replacement_links_generated),
      acceptanceRate: Number(row.acceptance_rate),
    };
  }, [organizationId]);
}

export function useAcademyOnboardingActivity(
  organizationId: string | undefined,
) {
  return useQuery<AcademyOnboardingActivity[]>(async () => {
    if (!organizationId) return [];
    const { data, error } = await supabase.rpc(
      "get_academy_onboarding_activity",
      { p_organization_id: organizationId, p_limit: 25 },
    );
    if (error) throw error;
    return ((data ?? []) as ActivityRow[]).map((event) => ({
      id: event.id,
      action: event.action,
      entityType: event.entity_type,
      entityId: event.entity_id,
      actorName: event.actor_name,
      details: event.details,
      occurredAt: event.occurred_at,
    }));
  }, [organizationId]);
}

export function useAcademyOnboardingActions() {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async <T>(action: () => PromiseLike<{ data: T; error: any }>) => {
    setWorking(true);
    setError(null);
    try {
      const result = await action();
      if (result.error) throw result.error;
      return result.data;
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Onboarding request failed",
      );
      return null;
    } finally {
      setWorking(false);
    }
  };

  const entriesPayload = (entries: AcademyOnboardingEntry[]) =>
    entries.map((entry) => ({
      email: entry.email,
      fullName: entry.fullName,
      roles: entry.roles,
    }));

  const preview = (organizationId: string, entries: AcademyOnboardingEntry[]) =>
    run<AcademyOnboardingPreview>(
      () =>
        supabase.rpc("preview_academy_onboarding", {
          p_organization_id: organizationId,
          p_entries: entriesPayload(entries),
        }) as any,
    );

  const createBatch = async (input: {
    organizationId: string;
    name: string;
    entries: AcademyOnboardingEntry[];
    expiresInDays: number;
  }) => {
    const data = await run<InvitationRow[]>(
      () =>
        supabase.rpc("create_academy_onboarding_batch", {
          p_organization_id: input.organizationId,
          p_name: input.name,
          p_entries: entriesPayload(input.entries),
          p_expires_in_days: input.expiresInDays,
        }) as any,
    );
    return (
      data?.map((invitation) => ({
        invitationId: invitation.invitation_id,
        email: invitation.email,
        fullName: invitation.full_name,
        roles: invitation.roles,
        inviteToken: invitation.invite_token,
        expiresAt: invitation.expires_at,
      })) ?? null
    );
  };

  const closeBatch = (organizationId: string, batchId: string) =>
    run<number>(
      () =>
        supabase.rpc("close_academy_onboarding_batch", {
          p_organization_id: organizationId,
          p_batch_id: batchId,
        }) as any,
    );

  const revokeInvitation = (organizationId: string, invitationId: string) =>
    run<null>(
      () =>
        supabase.rpc("revoke_academy_onboarding_invitation", {
          p_organization_id: organizationId,
          p_invitation_id: invitationId,
        }) as any,
    );

  const reissueInvitation = async (
    organizationId: string,
    invitationId: string,
    reason:
      | "not_received"
      | "incorrect_delivery"
      | "security_rotation"
      | "operator_request" = "operator_request",
  ) => {
    const data = await run<
      Array<InvitationRow & { replacement_count: number }>
    >(
      () =>
        supabase.rpc("reissue_academy_onboarding_invitation", {
          p_organization_id: organizationId,
          p_invitation_id: invitationId,
          p_reason: reason,
        }) as any,
    );
    const invitation = data?.[0];
    if (!invitation) return null;
    return {
      invitationId: invitation.invitation_id,
      email: invitation.email,
      fullName: invitation.full_name,
      roles: invitation.roles,
      inviteToken: invitation.invite_token,
      expiresAt: invitation.expires_at,
      replacementCount: Number(invitation.replacement_count),
    };
  };

  const claimInvitation = (inviteToken: string) =>
    run<string>(
      () =>
        supabase.rpc("claim_academy_onboarding_invitation", {
          p_invite_token: inviteToken,
        }) as any,
    );

  return {
    preview,
    createBatch,
    closeBatch,
    revokeInvitation,
    reissueInvitation,
    claimInvitation,
    working,
    error,
    clearError: () => setError(null),
  };
}
