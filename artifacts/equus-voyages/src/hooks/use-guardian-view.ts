import { useCallback, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import type {
  GuardianPortal,
  GuardianRelationshipStatus,
  GuardianRelationshipSummary,
  QueryState,
} from "./types";
import { requireOrganizationId, requireUserId, useQuery } from "./_shared";

export function useGuardianRelationships(): QueryState<
  GuardianRelationshipSummary[]
> & {
  refetch: () => void;
} {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;

  return useQuery<GuardianRelationshipSummary[]>(async () => {
    if (!organizationId) return [];
    const guardianId = await requireUserId();
    const scopedOrganizationId = requireOrganizationId(organizationId);
    const { data: links, error } = await supabase
      .from("guardian_riders")
      .select(
        "organization_id, guardian_id, rider_id, active, relationship_type, verification_status, adulthood_review_on, access_expires_at",
      )
      .eq("organization_id", scopedOrganizationId)
      .eq("guardian_id", guardianId)
      .order("created_at");
    if (error) throw error;

    const riderIds = (links ?? []).map((link) => link.rider_id);
    const profileNames = new Map<string, string>();
    if (riderIds.length) {
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", riderIds);
      if (profileError) throw profileError;
      for (const profile of profiles ?? [])
        profileNames.set(profile.id, profile.full_name ?? "Rider");
    }

    return (links ?? []).map((link) => ({
      organizationId: link.organization_id,
      guardianId: link.guardian_id,
      riderId: link.rider_id,
      riderName: profileNames.get(link.rider_id) ?? "Rider",
      relationshipType:
        link.relationship_type as GuardianRelationshipSummary["relationshipType"],
      verificationStatus:
        link.verification_status as GuardianRelationshipStatus,
      active: link.active,
      adulthoodReviewOn: link.adulthood_review_on,
      accessExpiresAt: link.access_expires_at,
    }));
  }, [organizationId]);
}

export function useGuardianPortal(
  riderId: string | null,
): QueryState<GuardianPortal | null> & {
  refetch: () => void;
} {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;

  return useQuery<GuardianPortal | null>(async () => {
    if (!organizationId || !riderId) return null;
    const { data, error } = await supabase.rpc("get_guardian_portal", {
      p_organization_id: requireOrganizationId(organizationId),
      p_rider_id: riderId,
    });
    if (error) throw error;
    return (data ?? null) as GuardianPortal | null;
  }, [organizationId, riderId]);
}

export function useGuardianApprovalActions(onSaved: () => void) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const respond = useCallback(
    async (requestId: string, decision: "approved" | "declined") => {
      setSubmitting(true);
      setError(null);
      try {
        const { error: responseError } = await supabase.rpc(
          "respond_guardian_approval",
          {
            p_request_id: requestId,
            p_decision: decision,
            p_response_note: null,
          },
        );
        if (responseError) throw responseError;
        onSaved();
        return true;
      } catch (cause: any) {
        setError(cause?.message ?? "Could not save the guardian decision");
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [onSaved],
  );

  return { respond, submitting, error };
}
