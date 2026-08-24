import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { requireOrganizationId, useQuery } from "./_shared";

export interface StableOperationsRosterHorse {
  id: string;
  name: string;
  breed: string | null;
  photoUrl: string | null;
  status: "active" | "resting" | "retired";
  riderCount: number;
}

export interface SafeHorseAvailability {
  id: string;
  name: string;
  availabilityState: "available" | "limited" | "unavailable";
  safeMessage: string;
}

export type StableOperationsPreview =
  | { audience: "staff"; horses: StableOperationsRosterHorse[] }
  | { audience: "rider"; availability: SafeHorseAvailability[] };

/**
 * Uses the narrowest database surface for the active persona:
 * staff receive a private operational roster, while riders and guardians only
 * receive the curated safe availability output.
 */
export function useStableOperationsPreview(
  canViewStaffPreview: boolean,
) {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;

  return useQuery<StableOperationsPreview>(async () => {
    if (!organizationId) {
      return canViewStaffPreview
        ? { audience: "staff", horses: [] }
        : { audience: "rider", availability: [] };
    }

    const p_organization_id = requireOrganizationId(organizationId);
    if (canViewStaffPreview) {
      const { data, error } = await supabase.rpc(
        "get_stable_operations_roster",
        { p_organization_id },
      );
      if (error) throw error;

      return {
        audience: "staff",
        horses: (data ?? []).map((horse: any) => ({
          id: horse.horse_id,
          name: horse.horse_name,
          breed: horse.breed,
          photoUrl: horse.photo_url,
          status: horse.horse_status,
          riderCount: horse.rider_count ?? 0,
        })),
      };
    }

    const { data, error } = await supabase.rpc("get_safe_horse_availability", {
      p_organization_id,
    });
    if (error) throw error;

    return {
      audience: "rider",
      availability: (data ?? []).map((horse: any) => ({
        id: horse.horse_id,
        name: horse.horse_name,
        availabilityState: horse.availability_state,
        safeMessage: horse.safe_message,
      })),
    };
  }, [canViewStaffPreview, organizationId]);
}