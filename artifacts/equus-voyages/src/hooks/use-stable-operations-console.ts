import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { requireOrganizationId, useQuery } from "./_shared";

export type StableOwnership = "academy" | "personal" | "guest";
export type StableAvailability = "available" | "limited" | "unavailable";
export type StableTaskState = "all" | "open" | "in_progress" | "completed" | "overdue" | "escalated";

export interface StableConsoleHorse {
  id: string;
  name: string;
  breed: string | null;
  photoUrl: string | null;
  status: "active" | "resting" | "retired";
  ownershipType: StableOwnership;
  availabilityState: StableAvailability;
  availabilityApproved: boolean;
  workloadUsedMinutes: number;
  workloadLimitMinutes: number;
  activeHoldId: string | null;
  activeHoldType: string | null;
  activeHoldReason: string | null;
  activeHoldEndsAt: string | null;
  openTaskCount: number;
  overdueTaskCount: number;
}

export interface StableDailyTask {
  id: string;
  horseId: string | null;
  horseName: string | null;
  taskType: string;
  title: string;
  dueAt: string;
  status: "open" | "in_progress" | "completed";
  workflowState: "open" | "in_progress" | "completed" | "overdue";
  escalationLevel: "none" | "attention" | "escalated";
  escalationNote: string | null;
  privateTaskNote: string | null;
  completedBy: string | null;
  completedAt: string | null;
}

export interface StableCareSchedule {
  id: string;
  horseId: string;
  horseName: string;
  careType: string;
  status: "scheduled" | "completed" | "cancelled";
  dueOn: string;
  workflowState: "scheduled" | "completed" | "cancelled" | "overdue";
  safeSummary: string;
  privateCareNote: string | null;
  completedOn: string | null;
  completedBy: string | null;
}

export interface StableAuditEvent {
  id: string;
  horseId: string | null;
  entityType: string;
  entityId: string;
  action: "created" | "updated" | "deleted";
  actorUserId: string | null;
  actorName: string | null;
  occurredAt: string;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
}

export interface AssignmentEligibility {
  eligible: boolean;
  reasonCode: string;
  feedback: string;
  scheduledMinutes7d: number;
  workloadLimitMinutes7d: number | null;
}

export interface StableOperationsConsoleData {
  horses: StableConsoleHorse[];
  tasks: StableDailyTask[];
  careSchedules: StableCareSchedule[];
  auditEvents: StableAuditEvent[];
}

export interface ProfileInput {
  horseId: string;
  ownershipType: StableOwnership;
  availabilityState: StableAvailability;
  availabilityApproved: boolean;
  workloadLimitMinutes: number;
  privateNote?: string;
}

export interface HoldInput {
  horseId: string;
  holdType: "rest" | "injury" | "veterinary" | "welfare";
  reason: string;
  endsAt?: string | null;
  availabilityState: "limited" | "unavailable";
  safeMessage: string;
  privateNote?: string;
}

export interface CareScheduleInput {
  scheduleId?: string | null;
  horseId: string;
  careType: "veterinary" | "farrier" | "vaccination" | "feeding" | "turnout" | "tack_equipment" | "routine_care";
  dueOn: string;
  safeSummary: string;
  privateNote?: string;
}

export interface TaskInput {
  horseId?: string | null;
  taskType: string;
  title: string;
  dueAt: string;
  privateNote?: string;
}

function mapHorse(row: any): StableConsoleHorse {
  return {
    id: row.horse_id,
    name: row.horse_name,
    breed: row.breed,
    photoUrl: row.photo_url,
    status: row.horse_status,
    ownershipType: row.ownership_type,
    availabilityState: row.availability_state,
    availabilityApproved: row.availability_approved,
    workloadUsedMinutes: row.workload_used_minutes_7d ?? 0,
    workloadLimitMinutes: row.workload_limit_minutes_7d ?? 0,
    activeHoldId: row.active_hold_id,
    activeHoldType: row.active_hold_type,
    activeHoldReason: row.active_hold_reason,
    activeHoldEndsAt: row.active_hold_ends_at,
    openTaskCount: row.open_task_count ?? 0,
    overdueTaskCount: row.overdue_task_count ?? 0,
  };
}

export function useStableOperationsConsole(canManage: boolean) {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;

  const query = useQuery<StableOperationsConsoleData>(async () => {
    if (!canManage || !organizationId) {
      return { horses: [], tasks: [], careSchedules: [], auditEvents: [] };
    }

    const p_organization_id = requireOrganizationId(organizationId);
    const [horsesResult, tasksResult, careResult, auditResult] = await Promise.all([
      supabase.rpc("get_stable_operations_console", { p_organization_id }),
      supabase.rpc("get_stable_daily_tasks", { p_organization_id, p_state: "all" }),
      supabase.rpc("get_stable_care_schedules", { p_organization_id }),
      supabase.rpc("get_stable_operations_audit_timeline", {
        p_organization_id,
        p_limit: 100,
      }),
    ]);

    for (const result of [horsesResult, tasksResult, careResult, auditResult]) {
      if (result.error) throw result.error;
    }

    return {
      horses: (horsesResult.data ?? []).map(mapHorse),
      tasks: (tasksResult.data ?? []).map((task: any) => ({
        id: task.task_id,
        horseId: task.horse_id,
        horseName: task.horse_name,
        taskType: task.task_type,
        title: task.title,
        dueAt: task.due_at,
        status: task.status,
        workflowState: task.workflow_state,
        escalationLevel: task.escalation_level,
        escalationNote: task.escalation_note,
        privateTaskNote: task.private_task_note,
        completedBy: task.completed_by,
        completedAt: task.completed_at,
      })),
      careSchedules: (careResult.data ?? []).map((schedule: any) => ({
        id: schedule.schedule_id,
        horseId: schedule.horse_id,
        horseName: schedule.horse_name,
        careType: schedule.care_type,
        status: schedule.status,
        dueOn: schedule.due_on,
        workflowState: schedule.workflow_state,
        safeSummary: schedule.safe_summary,
        privateCareNote: schedule.private_care_note,
        completedOn: schedule.completed_on,
        completedBy: schedule.completed_by,
      })),
      auditEvents: (auditResult.data ?? []).map((event: any) => ({
        id: event.event_id,
        horseId: event.horse_id,
        entityType: event.entity_type,
        entityId: event.entity_id,
        action: event.action,
        actorUserId: event.actor_user_id,
        actorName: event.actor_name,
        occurredAt: event.occurred_at,
        beforeData: event.before_data,
        afterData: event.after_data,
      })),
    };
  }, [canManage, organizationId], { resetOnChange: true });

  const call = useCallback(async (name: string, args: Record<string, unknown>) => {
    const { error } = await supabase.rpc(name, args);
    if (error) throw error;
    query.refetch();
  }, [query.refetch]);

  const profile = useCallback(async (input: ProfileInput) => {
    await call("update_horse_operation_profile", {
      p_organization_id: requireOrganizationId(organizationId),
      p_horse_id: input.horseId,
      p_ownership_type: input.ownershipType,
      p_availability_state: input.availabilityState,
      p_availability_approved: input.availabilityApproved,
      p_workload_limit_minutes_7d: input.workloadLimitMinutes,
      p_private_operations_note: input.privateNote?.trim() || null,
    });
  }, [call, organizationId]);

  const createHold = useCallback(async (input: HoldInput) => {
    await call("create_horse_operation_hold", {
      p_organization_id: requireOrganizationId(organizationId),
      p_horse_id: input.horseId,
      p_hold_type: input.holdType,
      p_reason: input.reason.trim(),
      p_ends_at: input.endsAt || null,
      p_safe_availability_state: input.availabilityState,
      p_safe_message: input.safeMessage.trim(),
      p_private_welfare_note: input.privateNote?.trim() || null,
    });
  }, [call, organizationId]);

  const releaseHold = useCallback(async (holdId: string, status: "released" | "expired" = "released") => {
    await call("release_horse_operation_hold", {
      p_organization_id: requireOrganizationId(organizationId),
      p_hold_id: holdId,
      p_status: status,
    });
  }, [call, organizationId]);

  const saveCareSchedule = useCallback(async (input: CareScheduleInput) => {
    await call("upsert_horse_care_schedule", {
      p_organization_id: requireOrganizationId(organizationId),
      p_schedule_id: input.scheduleId || null,
      p_horse_id: input.horseId,
      p_care_type: input.careType,
      p_due_on: input.dueOn,
      p_safe_summary: input.safeSummary.trim(),
      p_private_care_note: input.privateNote?.trim() || null,
    });
  }, [call, organizationId]);

  const completeCareSchedule = useCallback(async (scheduleId: string) => {
    await call("complete_horse_care_schedule", {
      p_organization_id: requireOrganizationId(organizationId),
      p_schedule_id: scheduleId,
    });
  }, [call, organizationId]);

  const createTask = useCallback(async (input: TaskInput) => {
    await call("create_stable_task", {
      p_organization_id: requireOrganizationId(organizationId),
      p_horse_id: input.horseId || null,
      p_task_type: input.taskType.trim(),
      p_title: input.title.trim(),
      p_due_at: input.dueAt,
      p_private_task_note: input.privateNote?.trim() || null,
    });
  }, [call, organizationId]);

  const updateTask = useCallback(async (
    taskId: string,
    status: "open" | "in_progress" | "completed",
    escalationLevel: "none" | "attention" | "escalated" = "none",
    escalationNote?: string,
  ) => {
    await call("update_stable_task_workflow", {
      p_organization_id: requireOrganizationId(organizationId),
      p_task_id: taskId,
      p_status: status,
      p_escalation_level: escalationLevel,
      p_escalation_note: escalationNote?.trim() || null,
    });
  }, [call, organizationId]);

  const checkAssignmentEligibility = useCallback(async (
    horseId: string,
    startsAt: string,
    durationMinutes: number,
    staffConfirmation = true,
  ): Promise<AssignmentEligibility> => {
    const { data, error } = await supabase.rpc("check_horse_assignment_eligibility", {
      p_organization_id: requireOrganizationId(organizationId),
      p_horse_id: horseId,
      p_starts_at: startsAt,
      p_duration_minutes: durationMinutes,
      p_exclude_lesson_id: null,
      p_staff_confirmation: staffConfirmation,
    });
    if (error) throw error;
    const result = (data ?? [])[0];
    if (!result) throw new Error("No assignment eligibility result was returned.");
    return {
      eligible: result.eligible,
      reasonCode: result.reason_code,
      feedback: result.feedback,
      scheduledMinutes7d: result.scheduled_minutes_7d ?? 0,
      workloadLimitMinutes7d: result.workload_limit_minutes_7d,
    };
  }, [organizationId]);

  return {
    ...query,
    saveProfile: profile,
    createHold,
    releaseHold,
    saveCareSchedule,
    completeCareSchedule,
    createTask,
    updateTask,
    checkAssignmentEligibility,
  };
}