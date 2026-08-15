import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import type {
  QueryState,
  RiderBadgeDefinition,
  RiderSyncDashboard,
} from "./types";
import {
  requireOrganizationId,
  requireUserId,
  resolveAccessibleRiderIds,
  useQuery,
} from "./_shared";

export function useRiderSyncDashboard(): QueryState<RiderSyncDashboard | null> & {
  refetch: () => void;
} {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;

  return useQuery<RiderSyncDashboard | null>(async () => {
    if (!organizationId) return null;
    const uid = await requireUserId();
    const scopedOrganizationId = requireOrganizationId(organizationId);
    const riderIds = await resolveAccessibleRiderIds(uid, scopedOrganizationId);
    const riderId = riderIds.includes(uid) ? uid : riderIds[0];
    if (!riderId) return null;

    const { data, error } = await supabase.rpc("get_rider_sync_dashboard", {
      p_organization_id: scopedOrganizationId,
      p_rider_id: riderId,
    });
    if (error) throw error;
    return (data ?? null) as RiderSyncDashboard | null;
  }, [organizationId]);
}

export function useRiderBadgeCatalog(): QueryState<RiderBadgeDefinition[]> {
  return useQuery<RiderBadgeDefinition[]>(async () => {
    const { data, error } = await supabase
      .from("rider_badge_catalog")
      .select("code, name, name_ar, description, description_ar, tier")
      .eq("active", true)
      .order("sort_order");
    if (error) throw error;
    return (data ?? []).map((badge) => ({
      code: badge.code,
      name: badge.name,
      nameAr: badge.name_ar,
      description: badge.description,
      descriptionAr: badge.description_ar,
      tier: badge.tier as RiderBadgeDefinition["tier"],
    }));
  }, []);
}
