import { useCallback, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import type {
  ComplianceAdminSummary,
  ComplianceDocumentStatus,
  QueryState,
  RiderCompliancePortal,
} from "./types";
import {
  requireOrganizationId,
  requireUserId,
  resolveAccessibleRiderIds,
  useQuery,
} from "./_shared";

export interface ComplianceRiderOption {
  id: string;
  name: string;
}

function mapDocument(row: any): ComplianceDocumentStatus {
  return {
    templateId: row.template_id,
    submissionId: row.submission_id ?? null,
    documentType: row.document_type,
    version: row.version,
    titleEn: row.title_en,
    titleAr: row.title_ar,
    bodyEn: row.body_en,
    bodyAr: row.body_ar,
    contentHash: row.content_hash,
    validDays: row.valid_days,
    status: row.status,
    medicalReviewStatus: row.medical_review_status ?? null,
    validUntil: row.valid_until ?? null,
    minorAtSigning: row.minor_at_signing ?? null,
    signedAt: row.signed_at ?? null,
    signerCapacity: row.signer_capacity ?? null,
    receiptKey: row.receipt_key ?? null,
  };
}

export function useComplianceRiders(): QueryState<ComplianceRiderOption[]> & {
  refetch: () => void;
} {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;
  return useQuery<ComplianceRiderOption[]>(async () => {
    if (!organizationId) return [];
    const userId = await requireUserId();
    let riderIds: string[];
    if (activeOrganization?.roles.includes("academy_admin")) {
      const { data: memberships, error: membershipError } = await supabase
        .from("organization_memberships")
        .select("user_id, organization_member_roles!inner(role)")
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .eq("organization_member_roles.role", "rider");
      if (membershipError) throw membershipError;
      riderIds = (memberships ?? []).map((membership) => membership.user_id);
    } else {
      riderIds = await resolveAccessibleRiderIds(userId, organizationId);
    }
    if (!riderIds.length) return [];
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", riderIds)
      .order("full_name");
    if (error) throw error;
    return (data ?? []).map((profile) => ({
      id: profile.id,
      name: profile.full_name ?? "Rider",
    }));
  }, [organizationId, activeOrganization?.roles.join(":")]);
}

export function useRiderCompliancePortal(
  riderId: string | null,
): QueryState<RiderCompliancePortal | null> & { refetch: () => void } {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;
  return useQuery<RiderCompliancePortal | null>(async () => {
    if (!organizationId || !riderId) return null;
    const { data, error } = await supabase.rpc("get_rider_compliance_portal", {
      p_organization_id: requireOrganizationId(organizationId),
      p_rider_id: riderId,
    });
    if (error) throw error;
    const portal = data as any;
    return {
      riderId: portal.rider_id,
      dateOfBirth: portal.date_of_birth ?? null,
      lessonReady: Boolean(portal.lesson_ready),
      renewalReady: Boolean(portal.renewal_ready),
      documents: (portal.documents ?? []).map(mapDocument),
    };
  }, [organizationId, riderId]);
}

export function useComplianceAdminSummary(
  enabled = true,
): QueryState<ComplianceAdminSummary | null> & {
  refetch: () => void;
} {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;
  return useQuery<ComplianceAdminSummary | null>(async () => {
    if (!organizationId || !enabled) return null;
    const { data, error } = await supabase.rpc("get_compliance_admin_summary", {
      p_organization_id: requireOrganizationId(organizationId),
    });
    if (error) throw error;
    const summary = data as any;
    return {
      riders: (summary.riders ?? []).map((rider: any) => ({
        riderId: rider.rider_id,
        riderName: rider.rider_name ?? "Rider",
        lessonReady: Boolean(rider.lesson_ready),
        renewalReady: Boolean(rider.renewal_ready),
      })),
      medicalReviewRequired: Number(summary.medical_review_required ?? 0),
    };
  }, [organizationId, enabled]);
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function useComplianceActions(onSaved: () => void) {
  const { activeOrganization } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (action: () => Promise<void>) => {
      setSubmitting(true);
      setError(null);
      try {
        await action();
        onSaved();
        return true;
      } catch (cause: any) {
        setError(cause?.message ?? "Could not save the compliance record");
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [onSaved],
  );

  const setDateOfBirth = useCallback(
    (riderId: string, dateOfBirth: string) =>
      run(async () => {
        const { error: rpcError } = await supabase.rpc(
          "set_rider_safety_profile",
          {
            p_organization_id: requireOrganizationId(
              activeOrganization?.id ?? null,
            ),
            p_rider_id: riderId,
            p_date_of_birth: dateOfBirth,
          },
        );
        if (rpcError) throw rpcError;
      }),
    [activeOrganization?.id, run],
  );

  const sign = useCallback(
    (
      riderId: string,
      document: ComplianceDocumentStatus,
      typedName: string,
      medicalAttentionRequired: boolean,
    ) =>
      run(async () => {
        const consentHash = await sha256(
          `${document.contentHash}:equivista-explicit-consent-v1`,
        );
        const { error: rpcError } = await supabase.rpc(
          "sign_compliance_document",
          {
            p_organization_id: requireOrganizationId(
              activeOrganization?.id ?? null,
            ),
            p_rider_id: riderId,
            p_template_id: document.templateId,
            p_answers: {
              medical_attention_required:
                document.documentType === "medical_safety"
                  ? medicalAttentionRequired
                  : false,
            },
            p_typed_name: typedName,
            p_consent_hash: consentHash,
          },
        );
        if (rpcError) throw rpcError;
      }),
    [activeOrganization?.id, run],
  );

  const reviewMedical = useCallback(
    (submissionId: string, decision: "approved" | "rejected") =>
      run(async () => {
        const { error: rpcError } = await supabase.rpc(
          "review_medical_declaration",
          {
            p_submission_id: submissionId,
            p_decision: decision,
            p_note: null,
          },
        );
        if (rpcError) throw rpcError;
      }),
    [run],
  );

  return { setDateOfBirth, sign, reviewMedical, submitting, error };
}
