import { useCallback, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { requireOrganizationId, useQuery } from "./_shared";

export type CompetitionAccess = {
  enabled: boolean;
  canManage: boolean;
  canPublish: boolean;
  canView: boolean;
  canViewFinancials: boolean;
  pilotScope: "staff" | "approved_portal" | "not_enrolled";
};

export type CompetitionRider = {
  riderId: string;
  riderName: string;
};

export type CompetitionCoach = {
  coachId: string;
  coachName: string;
};

export type CompetitionAnnualPlan = {
  id: string;
  organization_id: string;
  rider_id: string;
  coach_id: string;
  plan_year: number;
  title: string;
  goals_en: string;
  goals_ar: string;
  status: "draft" | "active" | "completed" | "archived";
  coach_signed_off: boolean;
  coach_signed_off_at: string | null;
  portal_visible: boolean;
};

export type CompetitionEvent = {
  id: string;
  name: string;
  discipline: string;
  venue: string;
  starts_on: string;
  ends_on: string;
  entry_deadline: string | null;
  status: "planned" | "confirmed" | "completed" | "cancelled";
  portal_visible?: boolean;
};

export type CompetitionEntry = {
  id: string;
  competition_id: string;
  plan_id: string | null;
  rider_id?: string;
  coach_id?: string;
  horse_id: string | null;
  class_name: string;
  target_family: "foundation" | "show_jumping";
  target_level: number;
  status: "draft" | "requested" | "approved" | "entered" | "withdrawn" | "completed";
  coach_signed_off?: boolean;
  portal_visible?: boolean;
  entry_reference: string | null;
  notes?: string | null;
};

export type CompetitionLogistics = {
  entry_id: string;
  transport_provider: string | null;
  outbound_details: string | null;
  return_details: string | null;
  cost_cents?: number | null;
  currency?: string;
  confirmed: boolean;
  private_note?: string | null;
};

export type CompetitionResult = {
  entry_id: string;
  placing: number | null;
  score: number | null;
  outcome: string;
  coach_note?: string | null;
  portal_visible?: boolean;
  recorded_at: string;
};

export type CompetitionReadiness = {
  id: string;
  plan_id: string | null;
  rider_id?: string;
  horse_id?: string | null;
  evidence_type: "coach_observation" | "lesson_report" | "video_review" | "competition_result";
  source_id?: string | null;
  evidence_note: string;
  status: "draft" | "signed_off";
  portal_visible?: boolean;
  signed_off_at: string | null;
};

export type CompetitionLadderProgress = {
  id: string;
  plan_id: string | null;
  level: number;
  status: "planned" | "in_progress" | "coach_confirmed" | "archived";
  evidence_id?: string | null;
  coach_confirmed_at: string | null;
  portal_visible?: boolean;
};

export type CompetitionLadderLevel = {
  level: number;
  name_en: string;
  name_ar: string;
  criteria_en: string;
  criteria_ar: string;
  prerequisite_level: number | null;
};

export type CompetitionReport = {
  id: string;
  plan_id: string;
  title_en: string;
  title_ar: string;
  content_en: string;
  content_ar: string;
  status: "draft" | "approved" | "published";
  published_at: string | null;
};

export type CompetitionWorkspace = {
  access: CompetitionAccess;
  annualPlans: CompetitionAnnualPlan[];
  competitions: CompetitionEvent[];
  entries: CompetitionEntry[];
  logistics: CompetitionLogistics[];
  results: CompetitionResult[];
  readiness: CompetitionReadiness[];
  ladder: CompetitionLadderProgress[];
  ladderCatalog: CompetitionLadderLevel[];
  reports: CompetitionReport[];
};

const toAccess = (data: any): CompetitionAccess => ({
  enabled: Boolean(data?.enabled),
  canManage: Boolean(data?.can_manage),
  canPublish: Boolean(data?.can_publish),
  canView: Boolean(data?.can_view),
  canViewFinancials: Boolean(data?.can_view_financials),
  pilotScope: data?.pilot_scope ?? "not_enrolled",
});

const emptyWorkspace = (): CompetitionWorkspace => ({
  access: {
    enabled: false,
    canManage: false,
    canPublish: false,
    canView: false,
    canViewFinancials: false,
    pilotScope: "not_enrolled",
  },
  annualPlans: [],
  competitions: [],
  entries: [],
  logistics: [],
  results: [],
  readiness: [],
  ladder: [],
  ladderCatalog: [],
  reports: [],
});

const toWorkspace = (data: any): CompetitionWorkspace => ({
  ...emptyWorkspace(),
  ...data,
  access: {
    enabled: Boolean(data?.access?.enabled),
    canManage: Boolean(data?.access?.canManage),
    canPublish: Boolean(data?.access?.canPublish),
    canView: Boolean(data?.access?.canView),
    canViewFinancials: Boolean(data?.access?.canViewFinancials),
    pilotScope: data?.access?.pilotScope ?? "not_enrolled",
  },
  annualPlans: data?.annualPlans ?? [],
  competitions: data?.competitions ?? [],
  entries: data?.entries ?? [],
  logistics: data?.logistics ?? [],
  results: data?.results ?? [],
  readiness: data?.readiness ?? [],
  ladder: data?.ladder ?? [],
  ladderCatalog: data?.ladderCatalog ?? [],
  reports: data?.reports ?? [],
});

export function useCompetitionDevelopmentAccess(riderId?: string | null) {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;

  return useQuery(async () => {
    const tenantId = requireOrganizationId(organizationId);
    const { data, error } = await supabase.rpc("get_competition_development_access", {
      p_organization_id: tenantId,
      p_rider_id: riderId ?? null,
    });
    if (error) throw error;
    return toAccess(Array.isArray(data) ? data[0] : data);
  }, [organizationId, riderId]);
}

export function useCompetitionDevelopmentRiders() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;

  return useQuery<CompetitionRider[]>(async () => {
    const tenantId = requireOrganizationId(organizationId);
    const { data, error } = await supabase.rpc("get_competition_development_riders", {
      p_organization_id: tenantId,
    });
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      riderId: row.rider_id,
      riderName: row.rider_name,
    }));
  }, [organizationId]);
}

export function useCompetitionDevelopmentCoaches(riderId?: string | null) {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;

  return useQuery<CompetitionCoach[]>(async () => {
    if (!riderId) return [];
    const tenantId = requireOrganizationId(organizationId);
    const { data, error } = await supabase.rpc("get_competition_development_coaches", {
      p_organization_id: tenantId,
      p_rider_id: riderId,
    });
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      coachId: row.coach_id,
      coachName: row.coach_name,
    }));
  }, [organizationId, riderId], { resetOnChange: true });
}

export function useCompetitionDevelopmentWorkspace(riderId?: string | null) {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;

  return useQuery<CompetitionWorkspace | null>(async () => {
    if (!riderId) return null;
    const tenantId = requireOrganizationId(organizationId);
    const { data, error } = await supabase.rpc("get_competition_development_workspace", {
      p_organization_id: tenantId,
      p_rider_id: riderId,
    });
    if (error) throw error;
    return toWorkspace(data);
  }, [organizationId, riderId], { resetOnChange: true });
}

type Call = (name: string, params: Record<string, unknown>) => Promise<unknown>;

export function useCompetitionDevelopmentActions(onComplete?: () => void) {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call: Call = useCallback(async (name, params) => {
    const { data, error: rpcError } = await supabase.rpc(name, params);
    if (rpcError) throw rpcError;
    return data;
  }, []);

  const mutate = useCallback(
    async <T,>(fn: () => Promise<T>) => {
      setSaving(true);
      setError(null);
      try {
        const result = await fn();
        onComplete?.();
        return result;
      } catch (cause: any) {
        const message = cause?.message ?? "Unable to save competition development data";
        setError(message);
        throw new Error(message);
      } finally {
        setSaving(false);
      }
    },
    [onComplete],
  );

  const withOrganization = (input: Record<string, unknown>) => ({
    p_organization_id: requireOrganizationId(organizationId),
    ...input,
  });

  return {
    saving,
    error,
    savePlan: (input: Omit<Record<string, unknown>, "p_organization_id">) =>
      mutate(() => call("save_competition_annual_plan", withOrganization(input))),
    saveEvent: (input: Omit<Record<string, unknown>, "p_organization_id">) =>
      mutate(() => call("save_competition_event", withOrganization(input))),
    saveEntry: (input: Omit<Record<string, unknown>, "p_organization_id">) =>
      mutate(() => call("save_competition_entry", withOrganization(input))),
    saveLogistics: (input: Record<string, unknown>) =>
      mutate(() => call("save_competition_logistics", input)),
    saveResult: (input: Record<string, unknown>) =>
      mutate(() => call("save_competition_result", input)),
    saveReadiness: (input: Omit<Record<string, unknown>, "p_organization_id">) =>
      mutate(() => call("save_competition_readiness", withOrganization(input))),
    confirmReadiness: (evidenceId: string) =>
      mutate(() => call("confirm_competition_readiness", { p_evidence_id: evidenceId })),
    saveLadderProgress: (input: Omit<Record<string, unknown>, "p_organization_id">) =>
      mutate(() => call("save_competition_jumping_progress", withOrganization(input))),
    saveReport: (input: Omit<Record<string, unknown>, "p_organization_id">) =>
      mutate(() => call("save_competition_development_report", withOrganization(input))),
    approveReport: (reportId: string) =>
      mutate(() => call("approve_competition_development_report", { p_report_id: reportId })),
    publishReport: (reportId: string) =>
      mutate(() => call("publish_competition_development_report", { p_report_id: reportId })),
  };
}