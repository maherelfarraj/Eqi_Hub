import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  HeartPulse,
  History,
  Info,
  Plus,
  Search,
  Warehouse,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useStableOperationsPreview } from "@/hooks/use-stable-operations-preview";
import {
  useStableOperationsConsole,
} from "@/hooks/use-stable-operations-console";
import type {
  CareScheduleInput,
  HoldInput,
  ProfileInput,
  StableAvailability,
  StableConsoleHorse,
  StableDailyTask,
  StableOwnership,
  TaskInput,
} from "@/hooks/use-stable-operations-console";
import {
  EmptyState,
  ErrorState,
  MetricCard,
  PageHeader,
  PageSkeleton,
  StatusBadge,
  SurfaceCard,
  PrimaryButton,
  OutlineButton,
  Modal,
  BusyLabel,
  formatDate,
  fieldClass,
  labelClass,
} from "@/components/EquiVistaUI";

function mutationError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function ProfileModal({
  horse,
  onClose,
  onSave,
}: {
  horse: StableConsoleHorse;
  onClose: () => void;
  onSave: (input: ProfileInput) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [data, setData] = useState({
    ownershipType: horse.ownershipType || "academy",
    availabilityState: horse.availabilityState || "available",
    availabilityApproved: horse.availabilityApproved || false,
    workloadLimitMinutes: horse.workloadLimitMinutes || 0,
    privateNote: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({
        horseId: horse.id,
        ownershipType: data.ownershipType as any,
        availabilityState: data.availabilityState as any,
        availabilityApproved: data.availabilityApproved,
        workloadLimitMinutes: Number(data.workloadLimitMinutes),
        privateNote: data.privateNote,
      });
      onClose();
    } catch (err) {
      setError(mutationError(err, t("stableOperations.errors.saveFailed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title={t("stableOperations.actions.editProfile")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>{t("stableOperations.forms.ownershipType")}</label>
          <select
            className={fieldClass}
            value={data.ownershipType}
            onChange={(e) => setData({ ...data, ownershipType: e.target.value as StableOwnership })}
          >
            <option value="academy">{t("stableOperations.options.academy")}</option>
            <option value="personal">{t("stableOperations.options.personal")}</option>
            <option value="guest">{t("stableOperations.options.guest")}</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("stableOperations.forms.availabilityState")}</label>
          <select
            className={fieldClass}
            value={data.availabilityState}
            onChange={(e) => setData({ ...data, availabilityState: e.target.value as StableAvailability })}
          >
            <option value="available">{t("stableOperations.status.available")}</option>
            <option value="limited">{t("stableOperations.status.limited")}</option>
            <option value="unavailable">{t("stableOperations.status.unavailable")}</option>
          </select>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <input
            type="checkbox"
            id="availabilityApproved"
            checked={data.availabilityApproved}
            onChange={(e) => setData({ ...data, availabilityApproved: e.target.checked })}
            className="size-4 rounded border-cream-300 text-primary-600 focus:ring-primary-500"
          />
          <label htmlFor="availabilityApproved" className="text-sm font-semibold text-espresso">
            {t("stableOperations.forms.availabilityApproved")}
          </label>
        </div>
        <div>
          <label className={labelClass}>{t("stableOperations.forms.workloadLimit")}</label>
          <input
            type="number"
            className={fieldClass}
            value={data.workloadLimitMinutes}
            onChange={(e) => setData({ ...data, workloadLimitMinutes: Number(e.target.value) })}
            min="30"
          />
        </div>
        <div>
          <label className={labelClass}>{t("stableOperations.forms.privateNote")}</label>
          <textarea
            className={fieldClass}
            value={data.privateNote}
            onChange={(e) => setData({ ...data, privateNote: e.target.value })}
            rows={3}
          />
        </div>
        {error ? <p role="alert" className="text-sm text-error-700">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-3 border-t border-cream-200 pt-4">
          <OutlineButton type="button" onClick={onClose}>{t("stableOperations.actions.cancel")}</OutlineButton>
          <PrimaryButton type="submit" disabled={saving}>
            {saving ? <BusyLabel label={t("stableOperations.actions.save")} /> : t("stableOperations.actions.save")}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function HoldModal({
  horse,
  onClose,
  onSave,
}: {
  horse: StableConsoleHorse;
  onClose: () => void;
  onSave: (input: HoldInput) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [data, setData] = useState({
    holdType: "rest",
    reason: "",
    endsAt: "",
    availabilityState: "unavailable",
    safeMessage: "",
    privateNote: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({
        horseId: horse.id,
        holdType: data.holdType as any,
        reason: data.reason,
        endsAt: data.endsAt || null,
        availabilityState: data.availabilityState as any,
        safeMessage: data.safeMessage,
        privateNote: data.privateNote,
      });
      onClose();
    } catch (err) {
      setError(mutationError(err, t("stableOperations.errors.saveFailed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title={t("stableOperations.actions.addHold")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>{t("stableOperations.forms.holdType")}</label>
          <select className={fieldClass} value={data.holdType} onChange={e => setData({...data, holdType: e.target.value})}>
            <option value="rest">{t("stableOperations.options.rest")}</option>
            <option value="injury">{t("stableOperations.options.injury")}</option>
            <option value="veterinary">{t("stableOperations.options.veterinary")}</option>
            <option value="welfare">{t("stableOperations.options.welfare")}</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("stableOperations.forms.reason")}</label>
          <input required type="text" className={fieldClass} value={data.reason} onChange={e => setData({...data, reason: e.target.value})} />
        </div>
        <div>
          <label className={labelClass}>{t("stableOperations.forms.endsAt")} · {t("stableOperations.labels.optional")}</label>
          <input type="datetime-local" className={fieldClass} value={data.endsAt} onChange={e => setData({...data, endsAt: e.target.value})} />
        </div>
        <div>
          <label className={labelClass}>{t("stableOperations.forms.availabilityState")}</label>
          <select className={fieldClass} value={data.availabilityState} onChange={e => setData({...data, availabilityState: e.target.value})}>
            <option value="limited">{t("stableOperations.status.limited")}</option>
            <option value="unavailable">{t("stableOperations.status.unavailable")}</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("stableOperations.forms.safeMessage")}</label>
          <input required type="text" className={fieldClass} value={data.safeMessage} onChange={e => setData({...data, safeMessage: e.target.value})} />
        </div>
        <div>
          <label className={labelClass}>{t("stableOperations.forms.privateNote")}</label>
          <textarea className={fieldClass} value={data.privateNote} onChange={e => setData({...data, privateNote: e.target.value})} rows={2} />
        </div>
        {error ? <p role="alert" className="text-sm text-error-700">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-3 border-t border-cream-200 pt-4">
          <OutlineButton type="button" onClick={onClose}>{t("stableOperations.actions.cancel")}</OutlineButton>
          <PrimaryButton type="submit" disabled={saving}>
            {saving ? <BusyLabel label={t("stableOperations.actions.save")} /> : t("stableOperations.actions.save")}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function TaskModal({
  defaults,
  horses,
  onClose,
  onSave,
}: {
  defaults?: { horseId?: string };
  horses: StableConsoleHorse[];
  onClose: () => void;
  onSave: (input: TaskInput) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [data, setData] = useState({
    horseId: defaults?.horseId || "",
    taskType: "",
    title: "",
    dueAt: "",
    privateNote: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({
        horseId: data.horseId || null,
        taskType: data.taskType,
        title: data.title,
        dueAt: data.dueAt,
        privateNote: data.privateNote,
      });
      onClose();
    } catch (err) {
      setError(mutationError(err, t("stableOperations.errors.saveFailed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title={t("stableOperations.actions.newTask")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>{t("stableOperations.forms.horse")} · {t("stableOperations.labels.optional")}</label>
          <select className={fieldClass} value={data.horseId} onChange={e => setData({...data, horseId: e.target.value})}>
            <option value="">{t("stableOperations.labels.none")}</option>
            {horses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
        <div>
            <label className={labelClass}>{t("stableOperations.forms.taskType")}</label>
            <select required className={fieldClass} value={data.taskType} onChange={e => setData({...data, taskType: e.target.value})}>
              <option value="" disabled>{t("stableOperations.forms.taskTypePlaceholder")}</option>
              <option value="feeding">{t("stableOperations.options.feeding")}</option>
              <option value="turnout">{t("stableOperations.options.turnout")}</option>
              <option value="tack_equipment">{t("stableOperations.options.tack_equipment")}</option>
              <option value="safety_check">{t("stableOperations.options.safety_check")}</option>
              <option value="routine_care">{t("stableOperations.options.routine_care")}</option>
            </select>
        </div>
        <div>
          <label className={labelClass}>{t("stableOperations.forms.title")}</label>
          <input required type="text" className={fieldClass} value={data.title} onChange={e => setData({...data, title: e.target.value})} />
        </div>
        <div>
          <label className={labelClass}>{t("stableOperations.forms.dueAt")}</label>
          <input required type="datetime-local" className={fieldClass} value={data.dueAt} onChange={e => setData({...data, dueAt: e.target.value})} />
        </div>
        <div>
          <label className={labelClass}>{t("stableOperations.forms.privateNote")}</label>
          <textarea className={fieldClass} value={data.privateNote} onChange={e => setData({...data, privateNote: e.target.value})} rows={2} />
        </div>
        {error ? <p role="alert" className="text-sm text-error-700">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-3 border-t border-cream-200 pt-4">
          <OutlineButton type="button" onClick={onClose}>{t("stableOperations.actions.cancel")}</OutlineButton>
          <PrimaryButton type="submit" disabled={saving}>
            {saving ? <BusyLabel label={t("stableOperations.actions.create")} /> : t("stableOperations.actions.create")}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function TaskUpdateModal({
  task,
  onClose,
  onSave,
}: {
  task: StableDailyTask;
  onClose: () => void;
  onSave: (taskId: string, status: any, escalationLevel: any, escalationNote?: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [data, setData] = useState({
    status: task.status,
    escalationLevel: task.escalationLevel,
    escalationNote: task.escalationNote || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(task.id, data.status, data.escalationLevel, data.escalationNote);
      onClose();
    } catch (err) {
      setError(mutationError(err, t("stableOperations.errors.saveFailed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title={t("stableOperations.actions.updateTask")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>{t("stableOperations.forms.status")}</label>
          <select className={fieldClass} value={data.status} onChange={e => setData({...data, status: e.target.value as StableDailyTask["status"]})}>
            <option value="open">{t("stableOperations.status.open")}</option>
            <option value="in_progress">{t("stableOperations.status.in_progress")}</option>
            <option value="completed">{t("stableOperations.status.completed")}</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("stableOperations.forms.escalationLevel")}</label>
          <select className={fieldClass} value={data.escalationLevel} onChange={e => setData({...data, escalationLevel: e.target.value as StableDailyTask["escalationLevel"]})}>
            <option value="none">{t("stableOperations.status.none")}</option>
            <option value="attention">{t("stableOperations.status.attention")}</option>
            <option value="escalated">{t("stableOperations.status.escalated")}</option>
          </select>
        </div>
        {data.escalationLevel !== 'none' && (
          <div>
            <label className={labelClass}>{t("stableOperations.forms.escalationNote")}</label>
            <textarea className={fieldClass} value={data.escalationNote} onChange={e => setData({...data, escalationNote: e.target.value})} rows={2} required />
          </div>
        )}
        {error ? <p role="alert" className="text-sm text-error-700">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-3 border-t border-cream-200 pt-4">
          <OutlineButton type="button" onClick={onClose}>{t("stableOperations.actions.cancel")}</OutlineButton>
          <PrimaryButton type="submit" disabled={saving}>
            {saving ? <BusyLabel label={t("stableOperations.actions.save")} /> : t("stableOperations.actions.save")}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function CareModal({
  defaults,
  horses,
  onClose,
  onSave,
}: {
  defaults?: { horseId?: string; id?: string };
  horses: StableConsoleHorse[];
  onClose: () => void;
  onSave: (input: CareScheduleInput) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [data, setData] = useState({
    horseId: defaults?.horseId || "",
    careType: "routine_care",
    dueOn: "",
    safeSummary: "",
    privateNote: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({
        scheduleId: defaults?.id || null,
        horseId: data.horseId,
        careType: data.careType as any,
        dueOn: data.dueOn,
        safeSummary: data.safeSummary,
        privateNote: data.privateNote,
      });
      onClose();
    } catch (err) {
      setError(mutationError(err, t("stableOperations.errors.saveFailed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title={t("stableOperations.actions.scheduleCare")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>{t("stableOperations.forms.horse")}</label>
          <select required className={fieldClass} value={data.horseId} onChange={e => setData({...data, horseId: e.target.value})}>
            <option value="">{t("stableOperations.forms.selectHorse")}</option>
            {horses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("stableOperations.forms.careType")}</label>
          <select className={fieldClass} value={data.careType} onChange={e => setData({...data, careType: e.target.value})}>
            <option value="routine_care">{t("stableOperations.options.routine_care")}</option>
            <option value="veterinary">{t("stableOperations.options.veterinary")}</option>
            <option value="farrier">{t("stableOperations.options.farrier")}</option>
            <option value="vaccination">{t("stableOperations.options.vaccination")}</option>
            <option value="feeding">{t("stableOperations.options.feeding")}</option>
            <option value="turnout">{t("stableOperations.options.turnout")}</option>
            <option value="tack_equipment">{t("stableOperations.options.tack_equipment")}</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("stableOperations.forms.dueOn")}</label>
          <input required type="date" className={fieldClass} value={data.dueOn} onChange={e => setData({...data, dueOn: e.target.value})} />
        </div>
        <div>
          <label className={labelClass}>{t("stableOperations.forms.safeSummary")}</label>
          <input required type="text" className={fieldClass} value={data.safeSummary} onChange={e => setData({...data, safeSummary: e.target.value})} />
        </div>
        <div>
          <label className={labelClass}>{t("stableOperations.forms.privateNote")}</label>
          <textarea className={fieldClass} value={data.privateNote} onChange={e => setData({...data, privateNote: e.target.value})} rows={2} />
        </div>
        {error ? <p role="alert" className="text-sm text-error-700">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-3 border-t border-cream-200 pt-4">
          <OutlineButton type="button" onClick={onClose}>{t("stableOperations.actions.cancel")}</OutlineButton>
          <PrimaryButton type="submit" disabled={saving}>
            {saving ? <BusyLabel label={t("stableOperations.actions.save")} /> : t("stableOperations.actions.save")}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function EligibilityModal({
  horse,
  onClose,
  onCheck,
}: {
  horse: StableConsoleHorse;
  onClose: () => void;
  onCheck: (horseId: string, startsAt: string, durationMinutes: number) => Promise<any>;
}) {
  const { t } = useTranslation();
  const [data, setData] = useState({
    startsAt: "",
    durationMinutes: "60",
  });
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    setError("");
    try {
      const res = await onCheck(horse.id, data.startsAt, Number(data.durationMinutes));
      setResult(res);
    } catch (err) {
      setError(mutationError(err, t("stableOperations.errors.checkFailed")));
    } finally {
      setChecking(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title={t("stableOperations.eligibility.title")}>
      <form onSubmit={handleCheck} className="space-y-4">
        <div>
          <label className={labelClass}>{t("stableOperations.forms.startsAt")}</label>
          <input required type="datetime-local" className={fieldClass} value={data.startsAt} onChange={e => setData({...data, startsAt: e.target.value})} />
        </div>
        <div>
          <label className={labelClass}>{t("stableOperations.forms.durationMinutes")}</label>
          <input required type="number" className={fieldClass} value={data.durationMinutes} onChange={e => setData({...data, durationMinutes: e.target.value})} />
        </div>
        <div className="mt-2 flex justify-end">
          <PrimaryButton type="submit" disabled={checking}>
            {checking ? <BusyLabel label={t("stableOperations.actions.check")} /> : t("stableOperations.actions.check")}
          </PrimaryButton>
        </div>
        {error ? <p role="alert" className="text-sm text-error-700">{error}</p> : null}
      </form>

      {result && (
        <div className="mt-6 border-t border-cream-200 pt-4">
          <div className="flex items-center gap-3 mb-4">
            <StatusBadge status={result.eligible ? "active" : "failed"} label={result.eligible ? t("stableOperations.eligibility.eligible") : t("stableOperations.eligibility.notEligible")} />
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className={labelClass}>{t("stableOperations.eligibility.reason")}</p>
              <p className="mt-1 font-semibold">{String(t(`stableOperations.eligibility.reasons.${result.reasonCode}`, result.reasonCode))}</p>
            </div>
            <div>
              <p className={labelClass}>{t("stableOperations.eligibility.feedback")}</p>
              <p className="mt-1">{String(t(`stableOperations.eligibility.feedbacks.${result.reasonCode}`, result.feedback))}</p>
            </div>
            <div>
              <p className={labelClass}>{t("stableOperations.eligibility.scheduled")}</p>
              <p className="mt-1">{result.scheduledMinutes7d} {t("stableOperations.labels.minutes")}</p>
            </div>
            <div>
              <p className={labelClass}>{t("stableOperations.eligibility.limit")}</p>
              <p className="mt-1">{result.workloadLimitMinutes7d !== null ? result.workloadLimitMinutes7d : t("stableOperations.labels.none")} {t("stableOperations.labels.minutes")}</p>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function StableOperationsPage() {
  const { t, i18n } = useTranslation();
  const { hasRole } = useAuth();

  const canManage =
    hasRole("platform_admin") ||
    hasRole("academy_admin") ||
    hasRole("coach");

  const previewReq = useStableOperationsPreview(!canManage);
  const consoleReq = useStableOperationsConsole(canManage);

  const loading = canManage ? consoleReq.loading : previewReq.loading;
  const error = canManage ? consoleReq.error : previewReq.error;
  const refetch = canManage ? consoleReq.refetch : previewReq.refetch;

  const [activeTab, setActiveTab] = useState<"horses" | "tasks" | "care" | "audit">("horses");
  const [searchQuery, setSearchQuery] = useState("");

  const [profileModal, setProfileModal] = useState<StableConsoleHorse | null>(null);
  const [holdModal, setHoldModal] = useState<StableConsoleHorse | null>(null);
  const [eligibilityModal, setEligibilityModal] = useState<StableConsoleHorse | null>(null);
  const [taskModal, setTaskModal] = useState<{ horseId?: string } | null>(null);
  const [taskUpdateModal, setTaskUpdateModal] = useState<StableDailyTask | null>(null);
  const [careModal, setCareModal] = useState<{ id?: string, horseId?: string } | null>(null);
  const [actionError, setActionError] = useState("");

  const horses = consoleReq.data?.horses || [];
  const tasks = consoleReq.data?.tasks || [];
  const careSchedules = consoleReq.data?.careSchedules || [];
  const auditEvents = consoleReq.data?.auditEvents || [];

  const safeAvailability = previewReq.data?.audience === "rider" ? previewReq.data.availability : [];

  const metrics = useMemo(() => {
    return {
      active: horses.filter((h) => h.status === "active").length,
      welfare: horses.filter((h) => h.activeHoldType !== null).length,
      workload: Math.round(horses.reduce((acc, h) => acc + (h.workloadUsedMinutes / 60), 0)),
      pending: tasks.filter((t) => t.status === "open").length,
    };
  }, [horses, tasks]);

  const filteredHorses = useMemo(() => {
    if (!searchQuery) return horses;
    return horses.filter((h) =>
      h.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [horses, searchQuery]);

  const closeActiveHold = async (
    horse: StableConsoleHorse,
    status: "released" | "expired",
  ) => {
    if (!horse.activeHoldId) return;
    setActionError("");
    try {
      await consoleReq.releaseHold(horse.activeHoldId, status);
    } catch (err) {
      setActionError(mutationError(err, t("stableOperations.errors.saveFailed")));
    }
  };

  if (loading) return <PageSkeleton cards={4} />;

  if (error) {
    return (
      <ErrorState
        message={t("common.errorLoading")}
        retryLabel={t("common.tryAgain")}
        onRetry={refetch}
      />
    );
  }

  // Riders and guardians only receive the curated safe availability contract.
  if (!canManage) {
    return (
      <div className="mx-auto max-w-4xl space-y-8">
        <PageHeader
          eyebrow={t("stableOperations.eyebrow")}
          title={t("stableOperations.title")}
        />
        <SurfaceCard className="p-8">
          <div className="flex flex-col items-center text-center">
            <span className="mb-6 flex size-16 items-center justify-center rounded-full bg-primary-50 text-primary-600">
              <Warehouse className="size-8" />
            </span>
            <p className="max-w-md text-text-secondary">
              {t("stableOperations.riderMessage")}
            </p>
            {safeAvailability.length > 0 && (
              <ul className="mt-6 w-full divide-y divide-cream-100 text-left">
                {safeAvailability.map((horse) => (
                  <li key={horse.id} className="py-4">
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-semibold text-espresso">{horse.name}</p>
                      <StatusBadge
                        status={
                          horse.availabilityState === "available"
                            ? "active"
                            : "pending"
                        }
                        label={t(
                          `stableOperations.status.${horse.availabilityState}`,
                        )}
                      />
                    </div>
                    <p className="mt-1 text-sm text-text-secondary">
                      {horse.safeMessage}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SurfaceCard>
      </div>
    );
  }

  const tabClass = (isActive: boolean) =>
    `px-4 py-3 text-sm font-bold tracking-wide transition-colors uppercase ${
      isActive
        ? "border-b-2 border-primary-500 text-primary-700"
        : "text-text-secondary hover:text-espresso"
    }`;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t("stableOperations.eyebrow")}
        title={t("stableOperations.title")}
        description={t("stableOperations.description")}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={HeartPulse}
          label={t("stableOperations.metrics.activeHorses")}
          value={metrics.active}
          detail={t("stableOperations.metricDetails.activeInStable")}
        />
        <MetricCard
          icon={AlertCircle}
          label={t("stableOperations.metrics.welfareHolds")}
          value={metrics.welfare}
          detail={t("stableOperations.metricDetails.veterinaryReview")}
        />
        <MetricCard
          icon={Activity}
          label={t("stableOperations.metrics.workload")}
          value={`${metrics.workload} ${t("stableOperations.labels.hours")}`}
          detail={t("stableOperations.metricDetails.lessonsScheduled")}
        />
        <MetricCard
          icon={ClipboardList}
          label={t("stableOperations.metrics.pendingTasks")}
          value={metrics.pending}
          detail={t("stableOperations.metricDetails.careActions")}
        />
      </div>

      <div className="flex space-x-1 border-b border-cream-200 overflow-x-auto hide-scrollbar">
        {(["horses", "tasks", "care", "audit"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={tabClass(activeTab === tab)}
          >
            {t(`stableOperations.tabs.${tab}`)}
          </button>
        ))}
      </div>
      {actionError ? (
        <p role="alert" className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-700">
          {actionError}
        </p>
      ) : null}

      {activeTab === "horses" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
            <h2 className="text-lg font-serif text-espresso">{t("stableOperations.tabs.horses")}</h2>
            <div className="relative max-w-xs w-full">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="size-4 text-text-secondary" />
              </div>
              <input
                type="text"
                className="block w-full rounded-xl border border-cream-300 bg-white py-2 pl-10 pr-3 text-sm placeholder:text-text-secondary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder={t("stableOperations.horseList.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {filteredHorses.length === 0 ? (
            <EmptyState icon={Warehouse} title={t("stableOperations.empty.horses")} description="" compact />
          ) : (
            filteredHorses.map((horse) => (
              <SurfaceCard key={horse.id} className="p-5">
                <div className="sm:flex sm:items-start sm:justify-between">
                  <div className="flex items-center gap-4 mb-4 sm:mb-0">
                    {horse.photoUrl ? (
                      <img src={horse.photoUrl} alt="" className="size-14 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-cream-100 font-serif text-lg text-text-secondary">
                        {horse.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-serif text-espresso">{horse.name}</h3>
                      <p className="text-sm text-text-secondary">
                        {horse.breed || t("stableOperations.labels.unknownBreed")} · {t(`stableOperations.options.${horse.ownershipType}`)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <StatusBadge status={horse.status === "active" ? "active" : "pending"} label={t(`stableOperations.status.${horse.status}`)} />
                        <StatusBadge status={horse.availabilityState === "available" ? "active" : "warning"} label={t(`stableOperations.status.${horse.availabilityState}`)} />
                        {horse.activeHoldType ? (
                          <StatusBadge
                            status="failed"
                            label={t("stableOperations.labels.activeHold", {
                              type: t(`stableOperations.options.${horse.activeHoldType}`),
                            })}
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <OutlineButton onClick={() => setProfileModal(horse)}>{t("stableOperations.actions.editProfile")}</OutlineButton>
                    <OutlineButton onClick={() => setHoldModal(horse)}>{t("stableOperations.actions.addHold")}</OutlineButton>
                    <OutlineButton onClick={() => setEligibilityModal(horse)}>{t("stableOperations.actions.checkEligibility")}</OutlineButton>
                    {horse.activeHoldId ? (
                      <>
                        <OutlineButton onClick={() => closeActiveHold(horse, "released")}>{t("stableOperations.actions.releaseHold")}</OutlineButton>
                        <OutlineButton onClick={() => closeActiveHold(horse, "expired")}>{t("stableOperations.actions.expireHold")}</OutlineButton>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4 border-t border-cream-100 pt-4">
                  <div>
                    <p className={labelClass}>{t("stableOperations.labels.workload")}</p>
                    <p className="mt-1 text-sm font-semibold text-espresso">{horse.workloadUsedMinutes} / {horse.workloadLimitMinutes} {t("stableOperations.labels.minutes")}</p>
                  </div>
                  <div>
                    <p className={labelClass}>{t("stableOperations.labels.openTasks")}</p>
                    <p className="mt-1 text-sm font-semibold text-espresso">{horse.openTaskCount}</p>
                  </div>
                  <div>
                    <p className={labelClass}>{t("stableOperations.labels.overdueTasks")}</p>
                    <p className={`mt-1 text-sm font-semibold ${horse.overdueTaskCount > 0 ? 'text-error-600' : 'text-espresso'}`}>
                      {horse.overdueTaskCount}
                    </p>
                  </div>
                  {horse.activeHoldEndsAt && (
                    <div>
                      <p className={labelClass}>{t("stableOperations.labels.holdEnds")}</p>
                      <p className="mt-1 text-sm font-semibold text-espresso">{formatDate(horse.activeHoldEndsAt, i18n.language)}</p>
                    </div>
                  )}
                </div>
              </SurfaceCard>
            ))
          )}
        </div>
      )}

      {activeTab === "tasks" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-serif text-espresso">{t("stableOperations.tabs.tasks")}</h2>
            <PrimaryButton onClick={() => setTaskModal({})}>
              <Plus className="size-4 mr-2" /> {t("stableOperations.actions.newTask")}
            </PrimaryButton>
          </div>
          {tasks.length === 0 ? (
            <EmptyState icon={ClipboardList} title={t("stableOperations.empty.tasks")} description="" compact />
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <SurfaceCard key={task.id} className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="font-semibold text-espresso">{task.title}</h3>
                       <StatusBadge status={task.workflowState === "completed" ? "active" : task.workflowState === "open" ? "pending" : "warning"} label={t(`stableOperations.status.${task.workflowState}`)} />
                      {task.escalationLevel !== "none" && <StatusBadge status="failed" label={t(`stableOperations.status.${task.escalationLevel}`)} />}
                    </div>
                    <p className="text-sm text-text-secondary">
                       {task.horseName ? `${task.horseName} · ` : ""}{t(`stableOperations.options.${task.taskType}`, task.taskType)} · {t("stableOperations.labels.due")} {formatDate(task.dueAt, i18n.language, { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                    {task.escalationNote && <p className="mt-3 text-sm text-error-700 bg-error-50 p-2.5 rounded-lg border border-error-100">{task.escalationNote}</p>}
                  </div>
                  <div className="shrink-0 self-start sm:self-auto">
                    <OutlineButton onClick={() => setTaskUpdateModal(task)}>{t("stableOperations.actions.updateTask")}</OutlineButton>
                  </div>
                </SurfaceCard>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "care" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-serif text-espresso">{t("stableOperations.tabs.care")}</h2>
            <PrimaryButton onClick={() => setCareModal({})}>
              <Plus className="size-4 mr-2" /> {t("stableOperations.actions.scheduleCare")}
            </PrimaryButton>
          </div>
          {careSchedules.length === 0 ? (
            <EmptyState icon={HeartPulse} title={t("stableOperations.empty.care")} description="" compact />
          ) : (
            <div className="space-y-3">
              {careSchedules.map((care) => (
                <SurfaceCard key={care.id} className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="font-semibold text-espresso">{care.horseName} · {t(`stableOperations.options.${care.careType}`, care.careType)}</h3>
                      <StatusBadge status={care.workflowState === "completed" ? "active" : care.workflowState === "scheduled" ? "pending" : "warning"} label={t(`stableOperations.status.${care.workflowState}`)} />
                    </div>
                    <p className="text-sm text-text-secondary">
                      {t("stableOperations.labels.due")} {formatDate(care.dueOn, i18n.language)} · {care.safeSummary}
                    </p>
                  </div>
                  <div className="shrink-0 self-start sm:self-auto">
                    {care.status !== "completed" && (
                      <OutlineButton onClick={() => consoleReq.completeCareSchedule(care.id)}>
                        <CheckCircle2 className="size-4 mr-2" /> {t("stableOperations.actions.completeCare")}
                      </OutlineButton>
                    )}
                  </div>
                </SurfaceCard>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "audit" && (
        <div className="space-y-4">
          <div className="mb-4">
            <h2 className="text-lg font-serif text-espresso">{t("stableOperations.tabs.audit")}</h2>
          </div>
          {auditEvents.length === 0 ? (
            <EmptyState icon={History} title={t("stableOperations.empty.audit")} description="" compact />
          ) : (
            <div className="space-y-3">
              {auditEvents.map((event) => (
                <SurfaceCard key={event.id} className="p-5">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <p className="font-semibold text-espresso">
                        {event.actorName || t("stableOperations.labels.system")}{" "}
                        <span className="text-text-secondary font-normal">
                          {t(`stableOperations.audit.actions.${event.action}`, event.action)}{" "}
                          {t(`stableOperations.audit.entities.${event.entityType}`, event.entityType.replaceAll("_", " "))}
                        </span>
                      </p>
                      <p className="text-xs text-text-secondary mt-1.5 uppercase tracking-wide">
                        {formatDate(event.occurredAt, i18n.language, { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                  </div>
                </SurfaceCard>
              ))}
            </div>
          )}
        </div>
      )}

      {profileModal && (
        <ProfileModal
          horse={profileModal}
          onClose={() => setProfileModal(null)}
          onSave={consoleReq.saveProfile}
        />
      )}
      {holdModal && (
        <HoldModal
          horse={holdModal}
          onClose={() => setHoldModal(null)}
          onSave={consoleReq.createHold}
        />
      )}
      {eligibilityModal && (
        <EligibilityModal
          horse={eligibilityModal}
          onClose={() => setEligibilityModal(null)}
          onCheck={consoleReq.checkAssignmentEligibility}
        />
      )}
      {taskModal && (
        <TaskModal
          defaults={taskModal}
          horses={horses}
          onClose={() => setTaskModal(null)}
          onSave={consoleReq.createTask}
        />
      )}
      {taskUpdateModal && (
        <TaskUpdateModal
          task={taskUpdateModal}
          onClose={() => setTaskUpdateModal(null)}
          onSave={consoleReq.updateTask}
        />
      )}
      {careModal && (
        <CareModal
          defaults={careModal}
          horses={horses}
          onClose={() => setCareModal(null)}
          onSave={consoleReq.saveCareSchedule}
        />
      )}
    </div>
  );
}
