import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { requireOrganizationId, useQuery } from "./_shared";

export type WelfareSeverity = "routine" | "attention" | "urgent" | "emergency";
export type AlertSeverity = Exclude<WelfareSeverity, "routine">;

export interface HorseWelfareAccess {
  enabled: boolean;
  canManage: boolean;
  medicalRole: boolean;
  reason: "feature_disabled" | "staff_role_required" | "authorized";
}

export interface WelfareHorse {
  horseId: string;
  name: string;
  breed: string | null;
  status: string;
}

export interface WelfareProfile {
  horseId: string;
  welfareStatus: "well" | "monitoring" | "restricted" | "urgent";
  riderSuitability: "suitable" | "restricted" | "not_suitable";
  dailyWorkloadLimitMinutes: number;
  bodyConditionScore: number | null;
  suitabilityNoteEn: string | null;
  suitabilityNoteAr: string | null;
  privateWelfareNote: string | null;
  approved: boolean;
  updatedAt: string;
}

export interface FeedingPlan {
  id: string;
  horseId: string;
  status: "active" | "paused" | "completed";
  feedNameEn: string;
  feedNameAr: string;
  instructionsEn: string;
  instructionsAr: string;
  mealsPerDay: number;
  amountDescriptionEn: string;
  amountDescriptionAr: string;
  startsOn: string;
  endsOn: string | null;
  privateNote: string | null;
}

export interface DailyCareLog {
  id: string;
  horseId: string;
  careDate: string;
  feedChecked: boolean;
  waterChecked: boolean;
  turnoutChecked: boolean;
  groomingChecked: boolean;
  tackChecked: boolean;
  observationEn: string | null;
  observationAr: string | null;
  privateNote: string | null;
}

export interface ClinicalSchedule {
  id: string;
  horseId: string;
  scheduleType: "veterinary" | "farrier" | "vaccination" | "medication" | "treatment" | "appointment";
  status: "scheduled" | "completed" | "cancelled";
  titleEn: string;
  titleAr: string;
  providerEn: string | null;
  providerAr: string | null;
  instructionsEn: string;
  instructionsAr: string;
  dueAt: string;
  medicationNameEn: string | null;
  medicationNameAr: string | null;
  dosageEn: string | null;
  dosageAr: string | null;
  privateNote: string | null;
}

export interface WelfareObservation {
  id: string;
  horseId: string;
  observedAt: string;
  category: "demeanour" | "appetite" | "movement" | "condition" | "environment" | "other";
  severity: WelfareSeverity;
  status: "open" | "acknowledged" | "resolved";
  summaryEn: string;
  summaryAr: string;
  actionTakenEn: string;
  actionTakenAr: string;
  privateNote: string | null;
}

export interface EmergencyProtocol {
  id: string;
  titleEn: string;
  titleAr: string;
  triggerEn: string;
  triggerAr: string;
  responseStepsEn: string;
  responseStepsAr: string;
  contactNameEn: string | null;
  contactNameAr: string | null;
  contactPhone: string | null;
  active: boolean;
}

export interface WelfareIncident {
  id: string;
  horseId: string;
  emergencyProtocolId: string | null;
  occurredAt: string;
  incidentType: "injury" | "illness" | "escape" | "fall" | "equipment" | "environment" | "other";
  severity: AlertSeverity;
  status: "open" | "investigating" | "closed";
  summaryEn: string;
  summaryAr: string;
  responseEn: string;
  responseAr: string;
  privateNote: string | null;
}

export interface SafetyInspection {
  id: string;
  facilityType: "arena" | "equipment";
  assetNameEn: string;
  assetNameAr: string;
  inspectedAt: string;
  result: "safe" | "attention" | "unsafe";
  findingsEn: string;
  findingsAr: string;
  correctiveActionEn: string;
  correctiveActionAr: string;
  nextDueAt: string | null;
  privateNote: string | null;
}

export interface MaintenanceRecord {
  id: string;
  inspectionId: string | null;
  facilityType: "arena" | "equipment";
  assetNameEn: string;
  assetNameAr: string;
  maintenanceTypeEn: string;
  maintenanceTypeAr: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  dueAt: string;
  detailsEn: string;
  detailsAr: string;
  privateNote: string | null;
}

export interface WelfareAlert {
  id: string;
  horseId: string | null;
  alertType: "welfare" | "clinical" | "safety" | "maintenance" | "workload" | "care";
  severity: AlertSeverity;
  status: "open" | "acknowledged" | "resolved";
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  dueAt: string | null;
}

export interface WelfareAuditEvent {
  id: string;
  horseId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  occurredAt: string;
}

export interface HorseWelfareWorkspace {
  horses: WelfareHorse[];
  profiles: WelfareProfile[];
  feedingPlans: FeedingPlan[];
  dailyCareLogs: DailyCareLog[];
  clinicalSchedules: ClinicalSchedule[];
  observations: WelfareObservation[];
  incidents: WelfareIncident[];
  protocols: EmergencyProtocol[];
  inspections: SafetyInspection[];
  maintenance: MaintenanceRecord[];
  alerts: WelfareAlert[];
  auditEvents: WelfareAuditEvent[];
}

const emptyWorkspace: HorseWelfareWorkspace = {
  horses: [],
  profiles: [],
  feedingPlans: [],
  dailyCareLogs: [],
  clinicalSchedules: [],
  observations: [],
  incidents: [],
  protocols: [],
  inspections: [],
  maintenance: [],
  alerts: [],
  auditEvents: [],
};

function mapWorkspace(value: any): HorseWelfareWorkspace {
  const data = value ?? {};
  return {
    horses: (data.horses ?? []).map((row: any) => ({
      horseId: row.horse_id,
      name: row.name,
      breed: row.breed ?? null,
      status: row.status,
    })),
    profiles: (data.profiles ?? []).map((row: any) => ({
      horseId: row.horse_id,
      welfareStatus: row.welfare_status,
      riderSuitability: row.rider_suitability,
      dailyWorkloadLimitMinutes: row.daily_workload_limit_minutes,
      bodyConditionScore: row.body_condition_score == null ? null : Number(row.body_condition_score),
      suitabilityNoteEn: row.suitability_note_en ?? null,
      suitabilityNoteAr: row.suitability_note_ar ?? null,
      privateWelfareNote: row.private_welfare_note ?? null,
      approved: row.approved,
      updatedAt: row.updated_at,
    })),
    feedingPlans: (data.feedingPlans ?? []).map((row: any) => ({
      id: row.id, horseId: row.horse_id, status: row.status, feedNameEn: row.feed_name_en,
      feedNameAr: row.feed_name_ar, instructionsEn: row.instructions_en, instructionsAr: row.instructions_ar,
      mealsPerDay: row.meals_per_day, amountDescriptionEn: row.amount_description_en,
      amountDescriptionAr: row.amount_description_ar, startsOn: row.starts_on, endsOn: row.ends_on ?? null,
      privateNote: row.private_note ?? null,
    })),
    dailyCareLogs: (data.dailyCareLogs ?? []).map((row: any) => ({
      id: row.id, horseId: row.horse_id, careDate: row.care_date, feedChecked: row.feed_checked,
      waterChecked: row.water_checked, turnoutChecked: row.turnout_checked,
      groomingChecked: row.grooming_checked, tackChecked: row.tack_checked,
      observationEn: row.observation_en ?? null, observationAr: row.observation_ar ?? null,
      privateNote: row.private_note ?? null,
    })),
    clinicalSchedules: (data.clinicalSchedules ?? []).map((row: any) => ({
      id: row.id, horseId: row.horse_id, scheduleType: row.schedule_type, status: row.status,
      titleEn: row.title_en, titleAr: row.title_ar, providerEn: row.provider_en ?? null,
      providerAr: row.provider_ar ?? null, instructionsEn: row.instructions_en,
      instructionsAr: row.instructions_ar, dueAt: row.due_at,
      medicationNameEn: row.medication_name_en ?? null, medicationNameAr: row.medication_name_ar ?? null,
      dosageEn: row.dosage_en ?? null, dosageAr: row.dosage_ar ?? null, privateNote: row.private_note ?? null,
    })),
    observations: (data.observations ?? []).map((row: any) => ({
      id: row.id, horseId: row.horse_id, observedAt: row.observed_at, category: row.category,
      severity: row.severity, status: row.status, summaryEn: row.summary_en, summaryAr: row.summary_ar,
      actionTakenEn: row.action_taken_en, actionTakenAr: row.action_taken_ar, privateNote: row.private_note ?? null,
    })),
    incidents: (data.incidents ?? []).map((row: any) => ({
      id: row.id, horseId: row.horse_id, emergencyProtocolId: row.emergency_protocol_id ?? null,
      occurredAt: row.occurred_at, incidentType: row.incident_type, severity: row.severity, status: row.status,
      summaryEn: row.summary_en, summaryAr: row.summary_ar, responseEn: row.response_en,
      responseAr: row.response_ar, privateNote: row.private_note ?? null,
    })),
    protocols: (data.protocols ?? []).map((row: any) => ({
      id: row.id, titleEn: row.title_en, titleAr: row.title_ar, triggerEn: row.trigger_en,
      triggerAr: row.trigger_ar, responseStepsEn: row.response_steps_en, responseStepsAr: row.response_steps_ar,
      contactNameEn: row.contact_name_en ?? null, contactNameAr: row.contact_name_ar ?? null,
      contactPhone: row.contact_phone ?? null, active: row.active,
    })),
    inspections: (data.inspections ?? []).map((row: any) => ({
      id: row.id, facilityType: row.facility_type, assetNameEn: row.asset_name_en,
      assetNameAr: row.asset_name_ar, inspectedAt: row.inspected_at, result: row.result,
      findingsEn: row.findings_en, findingsAr: row.findings_ar,
      correctiveActionEn: row.corrective_action_en, correctiveActionAr: row.corrective_action_ar,
      nextDueAt: row.next_due_at ?? null, privateNote: row.private_note ?? null,
    })),
    maintenance: (data.maintenance ?? []).map((row: any) => ({
      id: row.id, inspectionId: row.inspection_id ?? null, facilityType: row.facility_type,
      assetNameEn: row.asset_name_en, assetNameAr: row.asset_name_ar,
      maintenanceTypeEn: row.maintenance_type_en, maintenanceTypeAr: row.maintenance_type_ar,
      status: row.status, dueAt: row.due_at, detailsEn: row.details_en, detailsAr: row.details_ar,
      privateNote: row.private_note ?? null,
    })),
    alerts: (data.alerts ?? []).map((row: any) => ({
      id: row.id, horseId: row.horse_id ?? null, alertType: row.alert_type, severity: row.severity,
      status: row.status, titleEn: row.title_en, titleAr: row.title_ar, bodyEn: row.body_en,
      bodyAr: row.body_ar, dueAt: row.due_at ?? null,
    })),
    auditEvents: (data.auditEvents ?? []).map((row: any) => ({
      id: row.id, horseId: row.horse_id ?? null, entityType: row.entity_type,
      entityId: row.entity_id, action: row.action, occurredAt: row.occurred_at,
    })),
  };
}

export function useHorseWelfareAccess() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;

  return useQuery<HorseWelfareAccess>(async () => {
    if (!organizationId) {
      return { enabled: false, canManage: false, medicalRole: false, reason: "feature_disabled" };
    }
    const { data, error } = await supabase.rpc("get_horse_welfare_access", {
      p_organization_id: requireOrganizationId(organizationId),
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return {
      enabled: Boolean(row?.enabled),
      canManage: Boolean(row?.can_manage),
      medicalRole: Boolean(row?.medical_role),
      reason: row?.reason ?? "feature_disabled",
    };
  }, [organizationId], { resetOnChange: true });
}

export function useHorseWelfare(canManage: boolean) {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;
  const query = useQuery<HorseWelfareWorkspace>(async () => {
    if (!canManage || !organizationId) return emptyWorkspace;
    const { data, error } = await supabase.rpc("get_horse_welfare_workspace", {
      p_organization_id: requireOrganizationId(organizationId),
    });
    if (error) throw error;
    return mapWorkspace(data);
  }, [canManage, organizationId], { resetOnChange: true });

  const call = useCallback(async (name: string, args: Record<string, unknown>) => {
    const { error } = await supabase.rpc(name, args);
    if (error) throw error;
    query.refetch();
  }, [query.refetch]);

  const organizationArgs = useCallback(() => ({
    p_organization_id: requireOrganizationId(organizationId),
  }), [organizationId]);

  return {
    ...query,
    saveProfile: (input: Omit<WelfareProfile, "updatedAt">) => call("upsert_horse_welfare_profile", {
      ...organizationArgs(), p_horse_id: input.horseId, p_welfare_status: input.welfareStatus,
      p_rider_suitability: input.riderSuitability, p_daily_workload_limit_minutes: input.dailyWorkloadLimitMinutes,
      p_body_condition_score: input.bodyConditionScore, p_suitability_note_en: input.suitabilityNoteEn,
      p_suitability_note_ar: input.suitabilityNoteAr, p_private_welfare_note: input.privateWelfareNote,
      p_approved: input.approved,
    }),
    saveFeedingPlan: (input: Omit<FeedingPlan, "id"> & { id?: string | null }) => call("upsert_horse_feeding_plan", {
      ...organizationArgs(), p_horse_id: input.horseId, p_plan_id: input.id ?? null, p_status: input.status,
      p_feed_name_en: input.feedNameEn, p_feed_name_ar: input.feedNameAr, p_instructions_en: input.instructionsEn,
      p_instructions_ar: input.instructionsAr, p_meals_per_day: input.mealsPerDay,
      p_amount_description_en: input.amountDescriptionEn, p_amount_description_ar: input.amountDescriptionAr,
      p_starts_on: input.startsOn, p_ends_on: input.endsOn, p_private_note: input.privateNote,
    }),
    saveDailyCareLog: (input: Omit<DailyCareLog, "id">) => call("upsert_horse_daily_care_log", {
      ...organizationArgs(), p_horse_id: input.horseId, p_care_date: input.careDate,
      p_feed_checked: input.feedChecked, p_water_checked: input.waterChecked, p_turnout_checked: input.turnoutChecked,
      p_grooming_checked: input.groomingChecked, p_tack_checked: input.tackChecked,
      p_observation_en: input.observationEn, p_observation_ar: input.observationAr, p_private_note: input.privateNote,
    }),
    saveClinicalSchedule: (input: Omit<ClinicalSchedule, "id"> & { id?: string | null }) => call("upsert_horse_clinical_schedule", {
      ...organizationArgs(), p_horse_id: input.horseId, p_schedule_id: input.id ?? null,
      p_schedule_type: input.scheduleType, p_status: input.status, p_title_en: input.titleEn, p_title_ar: input.titleAr,
      p_provider_en: input.providerEn, p_provider_ar: input.providerAr, p_instructions_en: input.instructionsEn,
      p_instructions_ar: input.instructionsAr, p_due_at: input.dueAt,
      p_medication_name_en: input.medicationNameEn, p_medication_name_ar: input.medicationNameAr,
      p_dosage_en: input.dosageEn, p_dosage_ar: input.dosageAr, p_private_note: input.privateNote,
    }),
    recordObservation: (input: Omit<WelfareObservation, "id" | "status">) => call("record_horse_welfare_observation", {
      ...organizationArgs(), p_horse_id: input.horseId, p_category: input.category, p_severity: input.severity,
      p_summary_en: input.summaryEn, p_summary_ar: input.summaryAr, p_action_taken_en: input.actionTakenEn,
      p_action_taken_ar: input.actionTakenAr, p_observed_at: input.observedAt, p_private_note: input.privateNote,
    }),
    updateObservation: (id: string, status: "acknowledged" | "resolved") => call("resolve_horse_welfare_observation", {
      ...organizationArgs(), p_observation_id: id, p_status: status,
    }),
    saveProtocol: (input: EmergencyProtocol) => call("upsert_horse_emergency_protocol", {
      ...organizationArgs(), p_protocol_id: input.id || null, p_title_en: input.titleEn, p_title_ar: input.titleAr,
      p_trigger_en: input.triggerEn, p_trigger_ar: input.triggerAr, p_response_steps_en: input.responseStepsEn,
      p_response_steps_ar: input.responseStepsAr, p_contact_name_en: input.contactNameEn,
      p_contact_name_ar: input.contactNameAr, p_contact_phone: input.contactPhone, p_active: input.active,
    }),
    recordIncident: (input: Omit<WelfareIncident, "id" | "status">) => call("record_horse_welfare_incident", {
      ...organizationArgs(), p_horse_id: input.horseId, p_emergency_protocol_id: input.emergencyProtocolId,
      p_incident_type: input.incidentType, p_severity: input.severity, p_summary_en: input.summaryEn,
      p_summary_ar: input.summaryAr, p_response_en: input.responseEn, p_response_ar: input.responseAr,
      p_occurred_at: input.occurredAt, p_private_note: input.privateNote,
    }),
    updateIncident: (id: string, status: "investigating" | "closed") => call("close_horse_welfare_incident", {
      ...organizationArgs(), p_incident_id: id, p_status: status,
    }),
    saveInspection: (input: SafetyInspection) => call("upsert_stable_safety_inspection", {
      ...organizationArgs(), p_inspection_id: input.id || null, p_facility_type: input.facilityType,
      p_asset_name_en: input.assetNameEn, p_asset_name_ar: input.assetNameAr, p_result: input.result,
      p_findings_en: input.findingsEn, p_findings_ar: input.findingsAr,
      p_corrective_action_en: input.correctiveActionEn, p_corrective_action_ar: input.correctiveActionAr,
      p_inspected_at: input.inspectedAt, p_next_due_at: input.nextDueAt, p_private_note: input.privateNote,
    }),
    saveMaintenance: (input: MaintenanceRecord) => call("upsert_stable_maintenance_record", {
      ...organizationArgs(), p_record_id: input.id || null, p_inspection_id: input.inspectionId,
      p_facility_type: input.facilityType, p_asset_name_en: input.assetNameEn, p_asset_name_ar: input.assetNameAr,
      p_maintenance_type_en: input.maintenanceTypeEn, p_maintenance_type_ar: input.maintenanceTypeAr,
      p_status: input.status, p_due_at: input.dueAt,
      p_details_en: input.detailsEn, p_details_ar: input.detailsAr, p_private_note: input.privateNote,
    }),
    createAlert: (input: Omit<WelfareAlert, "id" | "status">) => call("create_horse_welfare_alert", {
      ...organizationArgs(), p_horse_id: input.horseId, p_alert_type: input.alertType, p_severity: input.severity,
      p_title_en: input.titleEn, p_title_ar: input.titleAr, p_body_en: input.bodyEn, p_body_ar: input.bodyAr,
      p_due_at: input.dueAt,
    }),
    updateAlert: (id: string, status: "acknowledged" | "resolved") => call("update_horse_welfare_alert", {
      ...organizationArgs(), p_alert_id: id, p_status: status,
    }),
  };
}