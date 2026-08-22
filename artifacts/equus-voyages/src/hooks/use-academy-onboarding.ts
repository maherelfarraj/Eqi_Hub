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
    run<AcademyOnboardingPreview>(() =>
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
    const data = await run<InvitationRow[]>(() =>
      supabase.rpc("create_academy_onboarding_batch", {
        p_organization_id: input.organizationId,
        p_name: input.name,
        p_entries: entriesPayload(input.entries),
        p_expires_in_days: input.expiresInDays,
      }) as any,
    );
    return data?.map((invitation) => ({
      invitationId: invitation.invitation_id,
      email: invitation.email,
      fullName: invitation.full_name,
      roles: invitation.roles,
      inviteToken: invitation.invite_token,
      expiresAt: invitation.expires_at,
    })) ?? null;
  };

  const closeBatch = (organizationId: string, batchId: string) =>
    run<number>(() =>
      supabase.rpc("close_academy_onboarding_batch", {
        p_organization_id: organizationId,
        p_batch_id: batchId,
      }) as any,
    );

  const claimInvitation = (inviteToken: string) =>
    run<string>(() =>
      supabase.rpc("claim_academy_onboarding_invitation", {
        p_invite_token: inviteToken,
      }) as any,
    );

  return {
    preview,
    createBatch,
    closeBatch,
    claimInvitation,
    working,
    error,
    clearError: () => setError(null),
  };
}
