import { useState, type ReactNode } from "react";
import { Building2, CalendarDays, ClipboardCheck, HardHat, UsersRound, WalletCards } from "lucide-react";
import {
  EmptyState, ErrorState, PageHeader, PageSkeleton, PrimaryButton, StatusBadge, SurfaceCard, fieldClass, labelClass,
} from "@/components/EquiVistaUI";
import { useAuth } from "@/contexts/AuthContext";
import { useAcademyOperationsAccess, useAcademyOperationsActions, useAcademyOperationsWorkspace } from "@/hooks/use-academy-operations";

const localTime = (value: string) => value ? new Date(value).toLocaleString() : "—";
const toIso = (value: FormDataEntryValue | null) => new Date(String(value)).toISOString();

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof UsersRound; children: ReactNode }) {
  return <SurfaceCard className="overflow-hidden">
    <div className="flex items-center gap-3 border-b border-cream-200 bg-cream-50 px-5 py-4">
      <span className="flex size-9 items-center justify-center rounded-full bg-primary-100 text-primary-700"><Icon className="size-4" /></span>
      <h2 className="font-serif text-xl text-espresso">{title}</h2>
    </div>
    <div className="p-5">{children}</div>
  </SurfaceCard>;
}

export default function AcademyOperationsPage() {
  const access = useAcademyOperationsAccess();
  const workspace = useAcademyOperationsWorkspace();
  const actions = useAcademyOperationsActions(workspace.refetch);
  const { hasRole } = useAuth();
  const [message, setMessage] = useState<string | null>(null);

  if (access.loading || workspace.loading) return <PageSkeleton />;
  if (access.error) return <ErrorState message={access.error} />;
  if (!access.data?.enabled || !access.data.canManage) {
    return <EmptyState icon={Building2} title="Academy operations are not enabled" description="This private workspace is default-off per organization and is available only to authorized academy staff." />;
  }
  if (workspace.error || !workspace.data) return <ErrorState message={workspace.error ?? "Academy operations are unavailable."} />;
  const data = workspace.data;
  const canApproveCompensation = hasRole("academy_admin") || hasRole("platform_admin");
  const metrics: Array<{ label: string; value: number; icon: typeof UsersRound }> = [
    { label: "Active staff", value: data.staffProfiles.filter((staff) => staff.active).length, icon: UsersRound },
    { label: "Upcoming shifts", value: data.shifts.filter((shift) => shift.status !== "cancelled").length, icon: CalendarDays },
    { label: "Resource bookings", value: data.bookings.filter((booking) => booking.status !== "cancelled").length, icon: Building2 },
    { label: "Open alerts", value: data.alerts.filter((alert) => alert.status !== "resolved").length, icon: ClipboardCheck },
  ];
  const submit = async (fn: () => Promise<unknown>, success: string) => {
    setMessage(null);
    try { await fn(); setMessage(success); } catch { /* surfaced below */ }
  };

  return <div className="space-y-6">
    <PageHeader eyebrow="Academy workspace" title="Staff, arena & academy operations" description="Private organization controls for staffing, facilities, lesson capacity, alerts, and approval-only payroll and commission calculations." />
    {message ? <div role="status" className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-800">{message}</div> : null}
    {actions.error ? <ErrorState message={actions.error} /> : null}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(({ label, value, icon: Icon }) => <SurfaceCard key={label} className="p-5">
        <div className="flex items-center justify-between"><span className="text-sm font-semibold text-text-secondary">{label}</span><Icon className="size-5 text-primary-600" /></div>
        <p className="mt-3 font-serif text-3xl text-espresso">{value}</p>
      </SurfaceCard>)}
    </div>

    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title="Staff roster & availability" icon={UsersRound}>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => {
          event.preventDefault(); const form = new FormData(event.currentTarget);
          void submit(() => actions.saveStaffProfile({
            p_staff_profile_id: null, p_user_id: form.get("userId"), p_staff_type: form.get("type"),
            p_display_name_en: form.get("nameEn"), p_display_name_ar: form.get("nameAr"), p_active: true, p_private_note: null,
          }), "Staff profile saved.");
        }}>
          <label className={labelClass}>User ID<input required name="userId" className={fieldClass} placeholder="Authenticated profile UUID" /></label>
          <label className={labelClass}>Role<select name="type" className={fieldClass}><option value="coach">Coach</option><option value="instructor">Instructor</option><option value="yard_staff">Yard staff</option><option value="facility_staff">Facility staff</option></select></label>
          <label className={labelClass}>English name<input required name="nameEn" className={fieldClass} /></label>
          <label className={labelClass}>الاسم بالعربية<input required dir="rtl" name="nameAr" className={fieldClass} /></label>
          <PrimaryButton type="submit" disabled={actions.saving} className="md:col-span-2">Add staff profile</PrimaryButton>
        </form>
        <div className="mt-5 space-y-2">{data.staffProfiles.slice(0, 6).map((staff) => <div key={staff.id} className="flex items-center justify-between rounded-lg border border-cream-200 px-3 py-2 text-sm"><span>{staff.display_name_en} <span dir="rtl">· {staff.display_name_ar}</span></span><StatusBadge status={staff.active ? "active" : "archived"} /></div>)}</div>
        <details className="mt-5 rounded-xl border border-cream-200 p-4"><summary className="cursor-pointer font-semibold text-espresso">Availability, shifts, leave & coach allocation</summary>
          <div className="mt-4 grid gap-5 lg:grid-cols-2">
            <form className="grid gap-2" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void submit(() => actions.saveAvailability({ p_availability_id: null, p_staff_profile_id: form.get("staff"), p_availability_state: form.get("state"), p_starts_at: toIso(form.get("starts")), p_ends_at: toIso(form.get("ends")), p_note_en: form.get("noteEn"), p_note_ar: form.get("noteAr") }), "Availability saved."); }}>
              <p className="font-semibold text-sm">Availability</p><input required name="staff" className={fieldClass} placeholder="Staff profile UUID" /><select name="state" className={fieldClass}><option value="available">Available</option><option value="limited">Limited</option><option value="unavailable">Unavailable</option></select><input required name="starts" type="datetime-local" className={fieldClass} /><input required name="ends" type="datetime-local" className={fieldClass} /><input name="noteEn" className={fieldClass} placeholder="English note" /><input dir="rtl" name="noteAr" className={fieldClass} placeholder="ملاحظة بالعربية" /><PrimaryButton type="submit" disabled={actions.saving}>Save availability</PrimaryButton>
            </form>
            <form className="grid gap-2" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void submit(() => actions.saveShift({ p_shift_id: null, p_staff_profile_id: form.get("staff"), p_status: "scheduled", p_starts_at: toIso(form.get("starts")), p_ends_at: toIso(form.get("ends")), p_duties_en: form.get("dutiesEn"), p_duties_ar: form.get("dutiesAr"), p_private_note: null }), "Shift saved."); }}>
              <p className="font-semibold text-sm">Shift</p><input required name="staff" className={fieldClass} placeholder="Staff profile UUID" /><input required name="starts" type="datetime-local" className={fieldClass} /><input required name="ends" type="datetime-local" className={fieldClass} /><input required name="dutiesEn" className={fieldClass} placeholder="Duties in English" /><input required dir="rtl" name="dutiesAr" className={fieldClass} placeholder="المهام بالعربية" /><PrimaryButton type="submit" disabled={actions.saving}>Schedule shift</PrimaryButton>
            </form>
            <form className="grid gap-2" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void submit(() => actions.saveLeave({ p_leave_id: null, p_staff_profile_id: form.get("staff"), p_status: form.get("status"), p_starts_at: toIso(form.get("starts")), p_ends_at: toIso(form.get("ends")), p_reason_en: form.get("reasonEn"), p_reason_ar: form.get("reasonAr") }), "Leave record saved."); }}>
              <p className="font-semibold text-sm">Leave</p><input required name="staff" className={fieldClass} placeholder="Staff profile UUID" /><select name="status" className={fieldClass}><option value="requested">Requested</option><option value="approved">Approved</option></select><input required name="starts" type="datetime-local" className={fieldClass} /><input required name="ends" type="datetime-local" className={fieldClass} /><input required name="reasonEn" className={fieldClass} placeholder="Reason in English" /><input required dir="rtl" name="reasonAr" className={fieldClass} placeholder="السبب بالعربية" /><PrimaryButton type="submit" disabled={actions.saving}>Save leave</PrimaryButton>
            </form>
            <form className="grid gap-2" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void submit(() => actions.saveCoachAllocation({ p_allocation_id: null, p_coach_staff_profile_id: form.get("coach"), p_rider_id: form.get("rider"), p_starts_at: toIso(form.get("starts")), p_ends_at: form.get("ends") ? toIso(form.get("ends")) : null, p_status: "active", p_allocation_note_en: form.get("noteEn"), p_allocation_note_ar: form.get("noteAr") }), "Coach allocation saved."); }}>
              <p className="font-semibold text-sm">Coach allocation</p><input required name="coach" className={fieldClass} placeholder="Coach staff profile UUID" /><input required name="rider" className={fieldClass} placeholder="Rider profile UUID" /><input required name="starts" type="datetime-local" className={fieldClass} /><input name="ends" type="datetime-local" className={fieldClass} /><input required name="noteEn" className={fieldClass} placeholder="English allocation note" /><input required dir="rtl" name="noteAr" className={fieldClass} placeholder="ملاحظة بالعربية" /><PrimaryButton type="submit" disabled={actions.saving}>Allocate coach</PrimaryButton>
            </form>
          </div>
        </details>
      </Panel>

      <Panel title="Arenas & equipment" icon={Building2}>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => {
          event.preventDefault(); const form = new FormData(event.currentTarget);
          void submit(() => actions.saveResource({
            p_resource_id: null, p_resource_type: form.get("resourceType"), p_name_en: form.get("nameEn"), p_name_ar: form.get("nameAr"),
            p_capacity: Number(form.get("capacity")), p_active: true, p_details_en: null, p_details_ar: null,
          }), "Resource saved.");
        }}>
          <label className={labelClass}>Type<select name="resourceType" className={fieldClass}><option value="arena">Arena</option><option value="equipment">Equipment</option></select></label>
          <label className={labelClass}>Capacity<input required min="1" max="500" defaultValue="1" name="capacity" type="number" className={fieldClass} /></label>
          <label className={labelClass}>English name<input required name="nameEn" className={fieldClass} /></label>
          <label className={labelClass}>الاسم بالعربية<input required dir="rtl" name="nameAr" className={fieldClass} /></label>
          <PrimaryButton type="submit" disabled={actions.saving} className="md:col-span-2">Add resource</PrimaryButton>
        </form>
        <div className="mt-5 space-y-2">{data.resources.slice(0, 6).map((resource) => <div key={resource.id} className="flex items-center justify-between rounded-lg border border-cream-200 px-3 py-2 text-sm"><span>{resource.name_en} <span dir="rtl">· {resource.name_ar}</span></span><span className="text-text-secondary">{resource.resource_type} · {resource.capacity}</span></div>)}</div>
        <details className="mt-5 rounded-xl border border-cream-200 p-4"><summary className="cursor-pointer font-semibold text-espresso">Book an arena or equipment item</summary><form className="mt-4 grid gap-2 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void submit(() => actions.saveBooking({ p_booking_id: null, p_resource_id: form.get("resource"), p_staff_profile_id: form.get("staff") || null, p_lesson_id: form.get("lesson") || null, p_status: "confirmed", p_starts_at: toIso(form.get("starts")), p_ends_at: toIso(form.get("ends")), p_purpose_en: form.get("purposeEn"), p_purpose_ar: form.get("purposeAr") }), "Resource booking saved."); }}>
          <input required name="resource" className={fieldClass} placeholder="Resource UUID" /><input name="staff" className={fieldClass} placeholder="Staff profile UUID (optional)" /><input name="lesson" className={fieldClass} placeholder="Lesson UUID (optional)" /><input required name="starts" type="datetime-local" className={fieldClass} /><input required name="ends" type="datetime-local" className={fieldClass} /><input required name="purposeEn" className={fieldClass} placeholder="Purpose in English" /><input required dir="rtl" name="purposeAr" className={fieldClass} placeholder="الغرض بالعربية" /><PrimaryButton type="submit" disabled={actions.saving}>Book resource</PrimaryButton>
        </form></details>
      </Panel>

      <Panel title="Lesson capacity & bookings" icon={CalendarDays}>
        <p className="mb-3 text-sm text-text-secondary">Capacity controls are validated before they are saved; confirmed riders can never exceed the configured limit.</p>
        <div className="space-y-2">{data.lessonCapacity.length ? data.lessonCapacity.slice(0, 6).map((control) => <div key={control.id} className="flex items-center justify-between rounded-lg border border-cream-200 px-3 py-2 text-sm"><span>Lesson {control.lesson_id.slice(0, 8)}</span><span>{control.confirmed_count}/{control.capacity} · {control.waitlist_count} waitlisted</span></div>) : <p className="text-sm text-text-secondary">No lesson capacity controls have been configured.</p>}</div>
        <div className="mt-5 border-t border-cream-200 pt-4 text-sm text-text-secondary">Bookings: {data.bookings.length} · Conflicts are rejected server-side by resource and time range.</div>
        <details className="mt-5 rounded-xl border border-cream-200 p-4"><summary className="cursor-pointer font-semibold text-espresso">Configure lesson capacity</summary><form className="mt-4 grid gap-2 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void submit(() => actions.saveCapacity({ p_lesson_id: form.get("lesson"), p_capacity: Number(form.get("capacity")), p_confirmed_count: Number(form.get("confirmed")), p_waitlist_count: Number(form.get("waitlist")), p_status: form.get("status"), p_note_en: form.get("noteEn"), p_note_ar: form.get("noteAr") }), "Lesson capacity saved."); }}>
          <input required name="lesson" className={fieldClass} placeholder="Lesson UUID" /><select name="status" className={fieldClass}><option value="open">Open</option><option value="waitlist">Waitlist</option><option value="closed">Closed</option></select><input required min="1" name="capacity" type="number" defaultValue="1" className={fieldClass} /><input required min="0" name="confirmed" type="number" defaultValue="0" className={fieldClass} /><input required min="0" name="waitlist" type="number" defaultValue="0" className={fieldClass} /><input name="noteEn" className={fieldClass} placeholder="English note" /><input dir="rtl" name="noteAr" className={fieldClass} placeholder="ملاحظة بالعربية" /><PrimaryButton type="submit" disabled={actions.saving}>Save capacity</PrimaryButton>
        </form></details>
      </Panel>

      <Panel title="Inspections, work orders & alerts" icon={HardHat}>
        <div className="grid grid-cols-3 gap-3 text-center text-sm"><div><p className="font-serif text-2xl text-espresso">{data.inspections.length}</p><p className="text-text-secondary">Inspections</p></div><div><p className="font-serif text-2xl text-espresso">{data.workOrders.filter((order) => order.status !== "completed").length}</p><p className="text-text-secondary">Open work</p></div><div><p className="font-serif text-2xl text-espresso">{data.alerts.filter((alert) => alert.status === "open").length}</p><p className="text-text-secondary">Alerts</p></div></div>
        <div className="mt-5 space-y-2">{data.alerts.slice(0, 4).map((alert) => <div key={alert.id} className="rounded-lg border border-cream-200 px-3 py-2 text-sm"><div className="flex justify-between gap-3"><span>{alert.title_en}</span><StatusBadge status={alert.severity} /></div><p className="mt-1 text-text-secondary" dir="rtl">{alert.title_ar}</p></div>)}</div>
        <details className="mt-5 rounded-xl border border-cream-200 p-4"><summary className="cursor-pointer font-semibold text-espresso">Inspection, work order & alert actions</summary><div className="mt-4 grid gap-5 lg:grid-cols-3">
          <form className="grid gap-2" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void submit(() => actions.saveInspection({ p_inspection_id: null, p_resource_id: form.get("resource") || null, p_inspection_type: form.get("type"), p_inspected_at: new Date().toISOString(), p_result: form.get("result"), p_findings_en: form.get("findingsEn"), p_findings_ar: form.get("findingsAr"), p_corrective_action_en: form.get("actionEn"), p_corrective_action_ar: form.get("actionAr"), p_next_due_at: null, p_private_note: null }), "Inspection saved."); }}><p className="font-semibold text-sm">Inspection</p><input name="resource" className={fieldClass} placeholder="Resource UUID (optional)" /><select name="type" className={fieldClass}><option value="arena">Arena</option><option value="equipment">Equipment</option><option value="facility">Facility</option></select><select name="result" className={fieldClass}><option value="safe">Safe</option><option value="attention">Attention</option><option value="unsafe">Unsafe</option></select><input required name="findingsEn" className={fieldClass} placeholder="Findings (English)" /><input required dir="rtl" name="findingsAr" className={fieldClass} placeholder="النتائج بالعربية" /><input required name="actionEn" className={fieldClass} placeholder="Corrective action (English)" /><input required dir="rtl" name="actionAr" className={fieldClass} placeholder="الإجراء بالعربية" /><PrimaryButton type="submit" disabled={actions.saving}>Save inspection</PrimaryButton></form>
          <form className="grid gap-2" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void submit(() => actions.saveWorkOrder({ p_work_order_id: null, p_inspection_id: form.get("inspection") || null, p_resource_id: form.get("resource") || null, p_priority: form.get("priority"), p_status: "open", p_title_en: form.get("titleEn"), p_title_ar: form.get("titleAr"), p_details_en: form.get("detailsEn"), p_details_ar: form.get("detailsAr"), p_due_at: form.get("due") ? toIso(form.get("due")) : null, p_private_note: null }), "Work order saved."); }}><p className="font-semibold text-sm">Work order</p><input name="inspection" className={fieldClass} placeholder="Inspection UUID (optional)" /><input name="resource" className={fieldClass} placeholder="Resource UUID (optional)" /><select name="priority" className={fieldClass}><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select><input required name="titleEn" className={fieldClass} placeholder="Title (English)" /><input required dir="rtl" name="titleAr" className={fieldClass} placeholder="العنوان بالعربية" /><input required name="detailsEn" className={fieldClass} placeholder="Details (English)" /><input required dir="rtl" name="detailsAr" className={fieldClass} placeholder="التفاصيل بالعربية" /><input name="due" type="datetime-local" className={fieldClass} /><PrimaryButton type="submit" disabled={actions.saving}>Create work order</PrimaryButton></form>
          <form className="grid gap-2" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void submit(() => actions.createAlert({ p_alert_type: form.get("type"), p_severity: form.get("severity"), p_title_en: form.get("titleEn"), p_title_ar: form.get("titleAr"), p_body_en: form.get("bodyEn"), p_body_ar: form.get("bodyAr"), p_source_type: null, p_source_id: null, p_due_at: null }), "Alert created."); }}><p className="font-semibold text-sm">Alert</p><select name="type" className={fieldClass}><option value="staffing">Staffing</option><option value="booking">Booking</option><option value="capacity">Capacity</option><option value="inspection">Inspection</option><option value="maintenance">Maintenance</option></select><select name="severity" className={fieldClass}><option value="attention">Attention</option><option value="urgent">Urgent</option><option value="critical">Critical</option></select><input required name="titleEn" className={fieldClass} placeholder="Title (English)" /><input required dir="rtl" name="titleAr" className={fieldClass} placeholder="العنوان بالعربية" /><input required name="bodyEn" className={fieldClass} placeholder="Message (English)" /><input required dir="rtl" name="bodyAr" className={fieldClass} placeholder="الرسالة بالعربية" /><PrimaryButton type="submit" disabled={actions.saving}>Create alert</PrimaryButton></form>
        </div></details>
      </Panel>
    </div>

    <Panel title="Approval-only payroll & commission calculations" icon={WalletCards}>
      {access.data.canViewCompensation ? <div className="grid gap-5 lg:grid-cols-2">
        <div><p className="text-sm text-text-secondary">Calculation and review only. This workspace never initiates a payment, payout, invoice, or disbursement.</p><div className="mt-4 space-y-2">{data.payroll.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3 rounded-lg border border-cream-200 px-3 py-2 text-sm"><span>{entry.period_start} – {entry.period_end}</span><span className="flex items-center gap-2">{entry.currency} {entry.calculated_amount} · <StatusBadge status={entry.approval_status} />{canApproveCompensation && entry.approval_status === "submitted" ? <PrimaryButton type="button" disabled={actions.saving} onClick={() => { void submit(() => actions.approvePayroll(entry.id), "Payroll calculation approved."); }}>Approve</PrimaryButton> : null}</span></div>)}</div>
          <div className="mt-4 border-t border-cream-200 pt-4"><p className="mb-2 text-sm font-semibold text-espresso">Commission review</p>{data.commissions.map((entry) => <div key={entry.id} className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-cream-200 px-3 py-2 text-sm"><span>{entry.period_start} – {entry.period_end}</span><span className="flex items-center gap-2">{entry.currency} {entry.calculated_amount} · <StatusBadge status={entry.approval_status} />{canApproveCompensation && entry.approval_status === "submitted" ? <PrimaryButton type="button" disabled={actions.saving} onClick={() => { void submit(() => actions.approveCommission(entry.id), "Commission calculation approved."); }}>Approve</PrimaryButton> : null}</span></div>)}</div></div>
        <div className="rounded-xl border border-primary-200 bg-primary-50 p-4"><p className="font-semibold text-primary-900">Compensation safeguards</p><ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-primary-900"><li>Visible only to academy administrators, accountants, and platform administrators.</li><li>Only academy administrators can approve a calculation.</li><li>All creates, updates, and approvals are audited.</li></ul><p className="mt-3 text-xs text-primary-800">Commission calculations in review: {data.commissions.length}. Last booking update: {data.bookings[0] ? localTime(data.bookings[0].updated_at) : "—"}.</p></div>
        <details className="lg:col-span-2 rounded-xl border border-cream-200 p-4"><summary className="cursor-pointer font-semibold text-espresso">Create or submit a calculation</summary><div className="mt-4 grid gap-5 lg:grid-cols-2">
          <form className="grid gap-2" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void submit(() => actions.savePayroll({ p_calculation_id: null, p_staff_profile_id: form.get("staff"), p_period_start: form.get("start"), p_period_end: form.get("end"), p_currency: form.get("currency"), p_gross_amount: Number(form.get("gross")), p_adjustment_amount: Number(form.get("adjustment")), p_calculated_amount: Number(form.get("amount")), p_approval_status: form.get("status"), p_calculation_note_en: form.get("noteEn"), p_calculation_note_ar: form.get("noteAr"), p_private_note: null }), "Payroll calculation saved."); }}><p className="font-semibold text-sm">Payroll calculation</p><input required name="staff" className={fieldClass} placeholder="Staff profile UUID" /><input required name="start" type="date" className={fieldClass} /><input required name="end" type="date" className={fieldClass} /><input required name="currency" defaultValue="USD" className={fieldClass} /><input required name="gross" type="number" step="0.01" defaultValue="0" className={fieldClass} /><input required name="adjustment" type="number" step="0.01" defaultValue="0" className={fieldClass} /><input required name="amount" type="number" step="0.01" defaultValue="0" className={fieldClass} /><select name="status" className={fieldClass}><option value="draft">Draft</option><option value="submitted">Submit for approval</option></select><input required name="noteEn" className={fieldClass} placeholder="English calculation note" /><input required dir="rtl" name="noteAr" className={fieldClass} placeholder="ملاحظة بالعربية" /><PrimaryButton type="submit" disabled={actions.saving}>Save payroll calculation</PrimaryButton></form>
          <form className="grid gap-2" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void submit(() => actions.saveCommission({ p_calculation_id: null, p_staff_profile_id: form.get("staff"), p_period_start: form.get("start"), p_period_end: form.get("end"), p_currency: form.get("currency"), p_basis_amount: Number(form.get("basis")), p_commission_rate: Number(form.get("rate")), p_calculated_amount: Number(form.get("amount")), p_approval_status: form.get("status"), p_calculation_note_en: form.get("noteEn"), p_calculation_note_ar: form.get("noteAr"), p_private_note: null }), "Commission calculation saved."); }}><p className="font-semibold text-sm">Commission calculation</p><input required name="staff" className={fieldClass} placeholder="Staff profile UUID" /><input required name="start" type="date" className={fieldClass} /><input required name="end" type="date" className={fieldClass} /><input required name="currency" defaultValue="USD" className={fieldClass} /><input required name="basis" type="number" step="0.01" defaultValue="0" className={fieldClass} /><input required name="rate" type="number" step="0.01" min="0" max="100" defaultValue="0" className={fieldClass} /><input required name="amount" type="number" step="0.01" defaultValue="0" className={fieldClass} /><select name="status" className={fieldClass}><option value="draft">Draft</option><option value="submitted">Submit for approval</option></select><input required name="noteEn" className={fieldClass} placeholder="English calculation note" /><input required dir="rtl" name="noteAr" className={fieldClass} placeholder="ملاحظة بالعربية" /><PrimaryButton type="submit" disabled={actions.saving}>Save commission calculation</PrimaryButton></form>
        </div></details>
      </div> : <p className="text-sm text-text-secondary">Compensation calculations are restricted to authorized financial roles.</p>}
    </Panel>
  </div>;
}