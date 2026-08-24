import { useCallback, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { requireOrganizationId, useQuery } from "./_shared";

export type AcademyOperationsAccess = {
  enabled: boolean;
  canManage: boolean;
  canViewCompensation: boolean;
  reason: string;
};

export type AcademyOperationsWorkspace = {
  staffProfiles: any[];
  availability: any[];
  shifts: any[];
  leave: any[];
  coachAllocations: any[];
  resources: any[];
  bookings: any[];
  lessonCapacity: any[];
  inspections: any[];
  workOrders: any[];
  alerts: any[];
  payroll: any[];
  commissions: any[];
};

const emptyWorkspace = (): AcademyOperationsWorkspace => ({
  staffProfiles: [], availability: [], shifts: [], leave: [], coachAllocations: [],
  resources: [], bookings: [], lessonCapacity: [], inspections: [], workOrders: [],
  alerts: [], payroll: [], commissions: [],
});

const toAccess = (row: any): AcademyOperationsAccess => ({
  enabled: Boolean(row?.enabled),
  canManage: Boolean(row?.can_manage),
  canViewCompensation: Boolean(row?.can_view_compensation),
  reason: row?.reason ?? "feature_disabled",
});

export function useAcademyOperationsAccess() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;
  return useQuery(async () => {
    const { data, error } = await supabase.rpc("get_academy_operations_access", {
      p_organization_id: requireOrganizationId(organizationId),
    });
    if (error) throw error;
    return toAccess(Array.isArray(data) ? data[0] : data);
  }, [organizationId]);
}

export function useAcademyOperationsWorkspace() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;
  return useQuery<AcademyOperationsWorkspace>(async () => {
    const { data, error } = await supabase.rpc("get_academy_operations_workspace", {
      p_organization_id: requireOrganizationId(organizationId),
    });
    if (error) throw error;
    return { ...emptyWorkspace(), ...(data ?? {}) };
  }, [organizationId], { resetOnChange: true });
}

export function useAcademyOperationsActions(onComplete?: () => void) {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (name: string, input: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc(name, {
        p_organization_id: requireOrganizationId(organizationId),
        ...input,
      });
      if (rpcError) throw rpcError;
      onComplete?.();
      return data;
    } catch (cause: any) {
      const message = cause?.message ?? "Unable to save academy operations data";
      setError(message);
      throw new Error(message);
    } finally {
      setSaving(false);
    }
  }, [onComplete, organizationId]);

  return {
    saving,
    error,
    saveStaffProfile: (input: Record<string, unknown>) => mutate("upsert_academy_staff_profile", input),
    saveAvailability: (input: Record<string, unknown>) => mutate("upsert_academy_staff_availability", input),
    saveShift: (input: Record<string, unknown>) => mutate("upsert_academy_staff_shift", input),
    saveLeave: (input: Record<string, unknown>) => mutate("upsert_academy_staff_leave", input),
    saveCoachAllocation: (input: Record<string, unknown>) => mutate("upsert_academy_coach_allocation", input),
    saveResource: (input: Record<string, unknown>) => mutate("upsert_academy_resource", input),
    saveBooking: (input: Record<string, unknown>) => mutate("upsert_academy_resource_booking", input),
    saveCapacity: (input: Record<string, unknown>) => mutate("upsert_academy_lesson_capacity", input),
    saveInspection: (input: Record<string, unknown>) => mutate("upsert_academy_facility_inspection", input),
    saveWorkOrder: (input: Record<string, unknown>) => mutate("upsert_academy_maintenance_work_order", input),
    createAlert: (input: Record<string, unknown>) => mutate("create_academy_operations_alert", input),
    savePayroll: (input: Record<string, unknown>) => mutate("upsert_academy_payroll_calculation", input),
    saveCommission: (input: Record<string, unknown>) => mutate("upsert_academy_commission_calculation", input),
    approvePayroll: (calculationId: string) => mutate("approve_academy_payroll_calculation", { p_calculation_id: calculationId }),
    approveCommission: (calculationId: string) => mutate("approve_academy_commission_calculation", { p_calculation_id: calculationId }),
  };
}