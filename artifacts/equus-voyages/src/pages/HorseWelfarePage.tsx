import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle,
  ClipboardList,
  Eye,
  FileText,
  HardHat,
  HeartPulse,
  Info,
  Plus,
  Search,
  ShieldAlert,
  Stethoscope,
  Wrench
} from "lucide-react";
import { useHorseWelfare, useHorseWelfareAccess } from "@/hooks/use-horse-welfare";
import {
  EmptyState,
  ErrorState,
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

// -------------------------------------------------------------------------------------------------
// UTILITIES
// -------------------------------------------------------------------------------------------------

const getLangField = (item: any, fieldEn: string, fieldAr: string, isAr: boolean) => {
  if (!item) return "";
  return isAr ? (item[fieldAr] || item[fieldEn]) : (item[fieldEn] || item[fieldAr]);
};

const toLocalInput = (iso?: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
};
const toDateInput = (iso?: string | null) => iso ? iso.slice(0, 10) : "";

// -------------------------------------------------------------------------------------------------
// SHARED FORM COMPONENTS
// -------------------------------------------------------------------------------------------------

const FormGroup = ({ label, children, required, isAr }: { label: string, children: React.ReactNode, required?: boolean, isAr?: boolean }) => (
  <div className="mb-4">
    <label className={`${labelClass} block mb-1.5 ${isAr ? 'text-right' : ''}`}>
      {label} {required && <span className="text-error-500">*</span>}
    </label>
    {children}
  </div>
);

const BilingualInput = ({ labelEn, labelAr, valueEn, valueAr, onChangeEn, onChangeAr, required, isAr }: any) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
    <div>
      <label className={`${labelClass} block mb-1.5 text-left`}>{labelEn} {required && <span className="text-error-500">*</span>}</label>
      <input required={required} className={`${fieldClass} text-left`} value={valueEn} onChange={e => onChangeEn(e.target.value)} dir="ltr" />
    </div>
    <div>
      <label className={`${labelClass} block mb-1.5 text-right`}>{labelAr} {required && <span className="text-error-500">*</span>}</label>
      <input required={required} className={`${fieldClass} text-right`} value={valueAr} onChange={e => onChangeAr(e.target.value)} dir="rtl" />
    </div>
  </div>
);

const BilingualTextarea = ({ labelEn, labelAr, valueEn, valueAr, onChangeEn, onChangeAr, required, isAr }: any) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
    <div>
      <label className={`${labelClass} block mb-1.5 text-left`}>{labelEn} {required && <span className="text-error-500">*</span>}</label>
      <textarea required={required} className={`${fieldClass} text-left`} value={valueEn} onChange={e => onChangeEn(e.target.value)} dir="ltr" rows={3} />
    </div>
    <div>
      <label className={`${labelClass} block mb-1.5 text-right`}>{labelAr} {required && <span className="text-error-500">*</span>}</label>
      <textarea required={required} className={`${fieldClass} text-right`} value={valueAr} onChange={e => onChangeAr(e.target.value)} dir="rtl" rows={3} />
    </div>
  </div>
);

function ActionModal({ title, onClose, onSubmit, saving, error, children, isAr, submitLabel }: any) {
  return (
    <Modal open={true} onClose={onClose} title={title} size="lg">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        <div className="space-y-2 max-h-[65vh] overflow-y-auto px-1 pb-4">
          {children}
        </div>
        {error && <p className="text-sm text-error-700 mt-4 bg-error-50 p-3 rounded-xl border border-error-100">{String(error)}</p>}
        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-cream-200">
          <OutlineButton type="button" onClick={onClose}>{isAr ? "إلغاء" : "Cancel"}</OutlineButton>
          <PrimaryButton type="submit" disabled={saving}>
            {saving ? <BusyLabel label={isAr ? "جاري الحفظ..." : "Saving..."} /> : (submitLabel || (isAr ? "حفظ" : "Save"))}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

// -------------------------------------------------------------------------------------------------
// MODALS
// -------------------------------------------------------------------------------------------------

function ProfileFormModal({ horse, profile, onClose, onSave, isAr }: any) {
  const [data, setData] = useState(profile || {
    welfareStatus: "well", riderSuitability: "suitable", dailyWorkloadLimitMinutes: 60, bodyConditionScore: null,
    suitabilityNoteEn: "", suitabilityNoteAr: "", privateWelfareNote: "", approved: false
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setSaving(true); setError("");
    try {
      await onSave({ horseId: horse.horseId, ...data });
      onClose();
    } catch(e) { setError(String(e)); }
    finally { setSaving(false); }
  }

  return (
    <ActionModal title={isAr ? `تحديث الملف: ${horse.name}` : `Update Profile: ${horse.name}`} onClose={onClose} onSubmit={submit} saving={saving} error={error} isAr={isAr}>
       <div className="grid grid-cols-2 gap-4">
         <FormGroup label={isAr ? "حالة الرعاية" : "Welfare Status"} isAr={isAr}>
           <select className={fieldClass} value={data.welfareStatus} onChange={e => setData({...data, welfareStatus: e.target.value})} dir={isAr ? "rtl" : "ltr"}>
             <option value="well">{isAr ? "سليم" : "Well"}</option>
             <option value="monitoring">{isAr ? "تحت المراقبة" : "Monitoring"}</option>
             <option value="restricted">{isAr ? "مقيد" : "Restricted"}</option>
             <option value="urgent">{isAr ? "عاجل" : "Urgent"}</option>
           </select>
         </FormGroup>
         <FormGroup label={isAr ? "ملاءمة الفارس" : "Rider Suitability"} isAr={isAr}>
           <select className={fieldClass} value={data.riderSuitability} onChange={e => setData({...data, riderSuitability: e.target.value})} dir={isAr ? "rtl" : "ltr"}>
             <option value="suitable">{isAr ? "مناسب" : "Suitable"}</option>
             <option value="restricted">{isAr ? "مقيد" : "Restricted"}</option>
             <option value="not_suitable">{isAr ? "غير مناسب" : "Not Suitable"}</option>
           </select>
         </FormGroup>
       </div>
       <div className="grid grid-cols-2 gap-4">
         <FormGroup label={isAr ? "الحد الأقصى للعمل (دقائق)" : "Daily Workload (min)"} required isAr={isAr}>
            <input type="number" required min="30" max="480" className={fieldClass} value={data.dailyWorkloadLimitMinutes} onChange={e => setData({...data, dailyWorkloadLimitMinutes: Number(e.target.value)})} dir={isAr ? "rtl" : "ltr"} />
         </FormGroup>
         <FormGroup label={isAr ? "درجة حالة الجسم (BCS)" : "Body Condition Score (BCS)"} isAr={isAr}>
           <input type="number" step="0.5" min="1" max="9" className={fieldClass} value={data.bodyConditionScore || ""} onChange={e => setData({...data, bodyConditionScore: e.target.value ? Number(e.target.value) : null})} dir={isAr ? "rtl" : "ltr"} />
         </FormGroup>
       </div>
       <BilingualTextarea labelEn="Suitability Note (EN)" labelAr="ملاحظة الملاءمة (عربي)" valueEn={data.suitabilityNoteEn || ""} valueAr={data.suitabilityNoteAr || ""} onChangeEn={(v: string) => setData({...data, suitabilityNoteEn: v})} onChangeAr={(v: string) => setData({...data, suitabilityNoteAr: v})} />
       <FormGroup label={isAr ? "ملاحظة خاصة" : "Private Note"} isAr={isAr}>
         <textarea className={fieldClass} value={data.privateWelfareNote || ""} onChange={e => setData({...data, privateWelfareNote: e.target.value})} rows={2} dir={isAr ? "rtl" : "ltr"} />
       </FormGroup>
       <label className={`flex items-center gap-2 mt-4 cursor-pointer ${isAr ? 'flex-row-reverse' : ''}`}>
         <input type="checkbox" checked={data.approved} onChange={e => setData({...data, approved: e.target.checked})} className="size-4 rounded border-cream-300 text-primary-600 focus:ring-primary-500" />
         <span className="text-sm font-bold text-espresso">{isAr ? "معتمد طبياً" : "Medically Approved"}</span>
       </label>
    </ActionModal>
  )
}

function FeedingPlanModal({ initialData, horseId, onClose, onSave, isAr }: any) {
  const [data, setData] = useState(initialData || {
    status: "active", feedNameEn: "", feedNameAr: "", instructionsEn: "", instructionsAr: "",
    mealsPerDay: 3, amountDescriptionEn: "", amountDescriptionAr: "", startsOn: toDateInput(new Date().toISOString()), endsOn: "", privateNote: ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setSaving(true); setError("");
    try {
      await onSave({ horseId, id: initialData?.id, ...data });
      onClose();
    } catch(e) { setError(String(e)); }
    finally { setSaving(false); }
  }

  return (
    <ActionModal title={isAr ? (initialData ? "تعديل خطة التغذية" : "خطة تغذية جديدة") : (initialData ? "Edit Feeding Plan" : "New Feeding Plan")} onClose={onClose} onSubmit={submit} saving={saving} error={error} isAr={isAr}>
       <div className="grid grid-cols-2 gap-4">
         <FormGroup label={isAr ? "الحالة" : "Status"} isAr={isAr}>
           <select className={fieldClass} value={data.status} onChange={e => setData({...data, status: e.target.value})} dir={isAr ? "rtl" : "ltr"}>
             <option value="active">Active</option>
             <option value="paused">Paused</option>
             <option value="completed">Completed</option>
           </select>
         </FormGroup>
         <FormGroup label={isAr ? "وجبات يومياً" : "Meals per Day"} required isAr={isAr}>
            <input type="number" required min="1" max="8" className={fieldClass} value={data.mealsPerDay} onChange={e => setData({...data, mealsPerDay: Number(e.target.value)})} dir={isAr ? "rtl" : "ltr"} />
         </FormGroup>
       </div>
       <BilingualInput labelEn="Feed Name (EN)" labelAr="اسم العلف (عربي)" required valueEn={data.feedNameEn} valueAr={data.feedNameAr} onChangeEn={(v: string) => setData({...data, feedNameEn: v})} onChangeAr={(v: string) => setData({...data, feedNameAr: v})} />
       <BilingualInput labelEn="Amount (EN)" labelAr="الكمية (عربي)" required valueEn={data.amountDescriptionEn} valueAr={data.amountDescriptionAr} onChangeEn={(v: string) => setData({...data, amountDescriptionEn: v})} onChangeAr={(v: string) => setData({...data, amountDescriptionAr: v})} />
       <BilingualTextarea labelEn="Instructions (EN)" labelAr="التعليمات (عربي)" required valueEn={data.instructionsEn} valueAr={data.instructionsAr} onChangeEn={(v: string) => setData({...data, instructionsEn: v})} onChangeAr={(v: string) => setData({...data, instructionsAr: v})} />
       <div className="grid grid-cols-2 gap-4">
         <FormGroup label={isAr ? "يبدأ في" : "Starts On"} required isAr={isAr}>
           <input type="date" required className={fieldClass} value={data.startsOn} onChange={e => setData({...data, startsOn: e.target.value})} dir={isAr ? "rtl" : "ltr"} />
         </FormGroup>
         <FormGroup label={isAr ? "ينتهي في (اختياري)" : "Ends On (Optional)"} isAr={isAr}>
           <input type="date" className={fieldClass} value={data.endsOn || ""} onChange={e => setData({...data, endsOn: e.target.value || null})} dir={isAr ? "rtl" : "ltr"} />
         </FormGroup>
       </div>
       <FormGroup label={isAr ? "ملاحظة خاصة" : "Private Note"} isAr={isAr}>
         <textarea className={fieldClass} value={data.privateNote || ""} onChange={e => setData({...data, privateNote: e.target.value})} rows={2} dir={isAr ? "rtl" : "ltr"} />
       </FormGroup>
    </ActionModal>
  )
}

function CareLogModal({ horseId, onClose, onSave, isAr }: any) {
  const [data, setData] = useState({
    careDate: toDateInput(new Date().toISOString()), feedChecked: true, waterChecked: true, turnoutChecked: true, groomingChecked: true, tackChecked: true,
    observationEn: "", observationAr: "", privateNote: ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setSaving(true); setError("");
    try {
      await onSave({ horseId, ...data });
      onClose();
    } catch(e) { setError(String(e)); }
    finally { setSaving(false); }
  }

  const Checkbox = ({ label, field }: { label: string, field: keyof typeof data }) => (
    <label className={`flex items-center gap-3 cursor-pointer ${isAr ? 'flex-row-reverse' : ''} p-3 border border-cream-200 rounded-xl hover:bg-cream-50`}>
      <input type="checkbox" checked={data[field] as boolean} onChange={e => setData({...data, [field]: e.target.checked})} className="size-4 rounded border-cream-300 text-primary-600 focus:ring-primary-500" />
      <span className="text-sm font-bold text-espresso flex-1">{label}</span>
    </label>
  );

  return (
    <ActionModal title={isAr ? "سجل العناية اليومية" : "Daily Care Log"} onClose={onClose} onSubmit={submit} saving={saving} error={error} isAr={isAr}>
       <FormGroup label={isAr ? "تاريخ العناية" : "Care Date"} required isAr={isAr}>
         <input type="date" required className={fieldClass} value={data.careDate} onChange={e => setData({...data, careDate: e.target.value})} dir={isAr ? "rtl" : "ltr"} />
       </FormGroup>
       <div className="grid grid-cols-2 gap-3 mb-6">
         <Checkbox label={isAr ? "فحص العلف" : "Feed Checked"} field="feedChecked" />
         <Checkbox label={isAr ? "فحص الماء" : "Water Checked"} field="waterChecked" />
         <Checkbox label={isAr ? "خروج للمرعى" : "Turnout Complete"} field="turnoutChecked" />
         <Checkbox label={isAr ? "تنظيف الخيل" : "Grooming Complete"} field="groomingChecked" />
         <Checkbox label={isAr ? "فحص السرج والمعدات" : "Tack Checked"} field="tackChecked" />
       </div>
       <BilingualTextarea labelEn="Observation (EN)" labelAr="الملاحظات (عربي)" valueEn={data.observationEn} valueAr={data.observationAr} onChangeEn={(v: string) => setData({...data, observationEn: v})} onChangeAr={(v: string) => setData({...data, observationAr: v})} />
       <FormGroup label={isAr ? "ملاحظة خاصة" : "Private Note"} isAr={isAr}>
         <textarea className={fieldClass} value={data.privateNote || ""} onChange={e => setData({...data, privateNote: e.target.value})} rows={2} dir={isAr ? "rtl" : "ltr"} />
       </FormGroup>
    </ActionModal>
  )
}

function ClinicalScheduleModal({ initialData, horseId, onClose, onSave, isAr }: any) {
  const [data, setData] = useState(initialData || {
    scheduleType: "veterinary", status: "scheduled", titleEn: "", titleAr: "", providerEn: "", providerAr: "",
    instructionsEn: "", instructionsAr: "", dueAt: toLocalInput(new Date().toISOString()), medicationNameEn: "", medicationNameAr: "", dosageEn: "", dosageAr: "", privateNote: ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setSaving(true); setError("");
    try {
      await onSave({ horseId, id: initialData?.id, ...data });
      onClose();
    } catch(e) { setError(String(e)); }
    finally { setSaving(false); }
  }

  return (
    <ActionModal title={isAr ? (initialData ? "تعديل الجدول السريري" : "جدول سريري جديد") : (initialData ? "Edit Clinical Schedule" : "New Clinical Schedule")} onClose={onClose} onSubmit={submit} saving={saving} error={error} isAr={isAr}>
       <div className="grid grid-cols-2 gap-4">
         <FormGroup label={isAr ? "النوع" : "Type"} isAr={isAr}>
           <select className={fieldClass} value={data.scheduleType} onChange={e => setData({...data, scheduleType: e.target.value})} dir={isAr ? "rtl" : "ltr"}>
             <option value="veterinary">Veterinary</option>
             <option value="farrier">Farrier</option>
             <option value="vaccination">Vaccination</option>
             <option value="medication">Medication</option>
             <option value="treatment">Treatment</option>
             <option value="appointment">Appointment</option>
           </select>
         </FormGroup>
         <FormGroup label={isAr ? "الحالة" : "Status"} isAr={isAr}>
           <select className={fieldClass} value={data.status} onChange={e => setData({...data, status: e.target.value})} dir={isAr ? "rtl" : "ltr"}>
             <option value="scheduled">Scheduled</option>
             <option value="completed">Completed</option>
             <option value="cancelled">Cancelled</option>
           </select>
         </FormGroup>
       </div>
       <FormGroup label={isAr ? "موعد الاستحقاق" : "Due At"} required isAr={isAr}>
         <input type="datetime-local" required className={fieldClass} value={data.dueAt} onChange={e => setData({...data, dueAt: e.target.value})} dir={isAr ? "rtl" : "ltr"} />
       </FormGroup>
       <BilingualInput labelEn="Title (EN)" labelAr="العنوان (عربي)" required valueEn={data.titleEn} valueAr={data.titleAr} onChangeEn={(v: string) => setData({...data, titleEn: v})} onChangeAr={(v: string) => setData({...data, titleAr: v})} />
       <BilingualInput labelEn="Provider (EN)" labelAr="المزود (عربي)" valueEn={data.providerEn || ""} valueAr={data.providerAr || ""} onChangeEn={(v: string) => setData({...data, providerEn: v})} onChangeAr={(v: string) => setData({...data, providerAr: v})} />
       
       {(data.scheduleType === 'medication' || data.scheduleType === 'vaccination') && (
         <>
           <BilingualInput labelEn="Medication Name (EN)" labelAr="اسم الدواء (عربي)" valueEn={data.medicationNameEn || ""} valueAr={data.medicationNameAr || ""} onChangeEn={(v: string) => setData({...data, medicationNameEn: v})} onChangeAr={(v: string) => setData({...data, medicationNameAr: v})} />
           <BilingualInput labelEn="Dosage (EN)" labelAr="الجرعة (عربي)" valueEn={data.dosageEn || ""} valueAr={data.dosageAr || ""} onChangeEn={(v: string) => setData({...data, dosageEn: v})} onChangeAr={(v: string) => setData({...data, dosageAr: v})} />
         </>
       )}
       
       <BilingualTextarea labelEn="Instructions (EN)" labelAr="التعليمات (عربي)" required valueEn={data.instructionsEn} valueAr={data.instructionsAr} onChangeEn={(v: string) => setData({...data, instructionsEn: v})} onChangeAr={(v: string) => setData({...data, instructionsAr: v})} />
       <FormGroup label={isAr ? "ملاحظة خاصة" : "Private Note"} isAr={isAr}>
         <textarea className={fieldClass} value={data.privateNote || ""} onChange={e => setData({...data, privateNote: e.target.value})} rows={2} dir={isAr ? "rtl" : "ltr"} />
       </FormGroup>
    </ActionModal>
  )
}

function ObservationModal({ horseId, onClose, onSave, isAr }: any) {
  const [data, setData] = useState({
    category: "demeanour", severity: "routine", summaryEn: "", summaryAr: "", actionTakenEn: "", actionTakenAr: "",
    observedAt: toLocalInput(new Date().toISOString()), privateNote: ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setSaving(true); setError("");
    try {
      await onSave({ horseId, ...data });
      onClose();
    } catch(e) { setError(String(e)); }
    finally { setSaving(false); }
  }

  return (
    <ActionModal title={isAr ? "تسجيل ملاحظة" : "Record Observation"} onClose={onClose} onSubmit={submit} saving={saving} error={error} isAr={isAr}>
       <div className="grid grid-cols-2 gap-4">
         <FormGroup label={isAr ? "الفئة" : "Category"} isAr={isAr}>
           <select className={fieldClass} value={data.category} onChange={e => setData({...data, category: e.target.value})} dir={isAr ? "rtl" : "ltr"}>
             <option value="demeanour">Demeanour</option>
             <option value="appetite">Appetite</option>
             <option value="movement">Movement</option>
             <option value="condition">Condition</option>
             <option value="environment">Environment</option>
             <option value="other">Other</option>
           </select>
         </FormGroup>
         <FormGroup label={isAr ? "الخطورة" : "Severity"} isAr={isAr}>
           <select className={fieldClass} value={data.severity} onChange={e => setData({...data, severity: e.target.value})} dir={isAr ? "rtl" : "ltr"}>
             <option value="routine">Routine</option>
             <option value="attention">Attention</option>
             <option value="urgent">Urgent</option>
             <option value="emergency">Emergency</option>
           </select>
         </FormGroup>
       </div>
       <FormGroup label={isAr ? "وقت الملاحظة" : "Observed At"} required isAr={isAr}>
         <input type="datetime-local" required className={fieldClass} value={data.observedAt} onChange={e => setData({...data, observedAt: e.target.value})} dir={isAr ? "rtl" : "ltr"} />
       </FormGroup>
       <BilingualTextarea labelEn="Summary (EN)" labelAr="الملخص (عربي)" required valueEn={data.summaryEn} valueAr={data.summaryAr} onChangeEn={(v: string) => setData({...data, summaryEn: v})} onChangeAr={(v: string) => setData({...data, summaryAr: v})} />
       <BilingualTextarea labelEn="Action Taken (EN)" labelAr="الإجراء المتخذ (عربي)" required valueEn={data.actionTakenEn} valueAr={data.actionTakenAr} onChangeEn={(v: string) => setData({...data, actionTakenEn: v})} onChangeAr={(v: string) => setData({...data, actionTakenAr: v})} />
       <FormGroup label={isAr ? "ملاحظة خاصة" : "Private Note"} isAr={isAr}>
         <textarea className={fieldClass} value={data.privateNote || ""} onChange={e => setData({...data, privateNote: e.target.value})} rows={2} dir={isAr ? "rtl" : "ltr"} />
       </FormGroup>
    </ActionModal>
  )
}

function IncidentModal({ horseId, protocols, onClose, onSave, isAr }: any) {
  const [data, setData] = useState({
    emergencyProtocolId: "", incidentType: "injury", severity: "attention", summaryEn: "", summaryAr: "", responseEn: "", responseAr: "",
    occurredAt: toLocalInput(new Date().toISOString()), privateNote: ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setSaving(true); setError("");
    try {
      await onSave({ horseId, ...data, emergencyProtocolId: data.emergencyProtocolId || null });
      onClose();
    } catch(e) { setError(String(e)); }
    finally { setSaving(false); }
  }

  return (
    <ActionModal title={isAr ? "تسجيل حادثة" : "Record Incident"} onClose={onClose} onSubmit={submit} saving={saving} error={error} isAr={isAr}>
       <div className="grid grid-cols-2 gap-4">
         <FormGroup label={isAr ? "النوع" : "Type"} isAr={isAr}>
           <select className={fieldClass} value={data.incidentType} onChange={e => setData({...data, incidentType: e.target.value})} dir={isAr ? "rtl" : "ltr"}>
             <option value="injury">Injury</option>
             <option value="illness">Illness</option>
             <option value="escape">Escape</option>
             <option value="fall">Fall</option>
             <option value="equipment">Equipment</option>
             <option value="environment">Environment</option>
             <option value="other">Other</option>
           </select>
         </FormGroup>
         <FormGroup label={isAr ? "الخطورة" : "Severity"} isAr={isAr}>
           <select className={fieldClass} value={data.severity} onChange={e => setData({...data, severity: e.target.value})} dir={isAr ? "rtl" : "ltr"}>
             <option value="attention">Attention</option>
             <option value="urgent">Urgent</option>
             <option value="emergency">Emergency</option>
           </select>
         </FormGroup>
       </div>
       <FormGroup label={isAr ? "بروتوكول الطوارئ المتبع" : "Triggered Protocol (Optional)"} isAr={isAr}>
         <select className={fieldClass} value={data.emergencyProtocolId} onChange={e => setData({...data, emergencyProtocolId: e.target.value})} dir={isAr ? "rtl" : "ltr"}>
           <option value="">None</option>
           {protocols.map((p: any) => <option key={p.id} value={p.id}>{getLangField(p, 'titleEn', 'titleAr', isAr)}</option>)}
         </select>
       </FormGroup>
       <FormGroup label={isAr ? "وقت الوقوع" : "Occurred At"} required isAr={isAr}>
         <input type="datetime-local" required className={fieldClass} value={data.occurredAt} onChange={e => setData({...data, occurredAt: e.target.value})} dir={isAr ? "rtl" : "ltr"} />
       </FormGroup>
       <BilingualTextarea labelEn="Summary (EN)" labelAr="الملخص (عربي)" required valueEn={data.summaryEn} valueAr={data.summaryAr} onChangeEn={(v: string) => setData({...data, summaryEn: v})} onChangeAr={(v: string) => setData({...data, summaryAr: v})} />
       <BilingualTextarea labelEn="Response (EN)" labelAr="الاستجابة (عربي)" required valueEn={data.responseEn} valueAr={data.responseAr} onChangeEn={(v: string) => setData({...data, responseEn: v})} onChangeAr={(v: string) => setData({...data, responseAr: v})} />
       <FormGroup label={isAr ? "ملاحظة خاصة" : "Private Note"} isAr={isAr}>
         <textarea className={fieldClass} value={data.privateNote || ""} onChange={e => setData({...data, privateNote: e.target.value})} rows={2} dir={isAr ? "rtl" : "ltr"} />
       </FormGroup>
    </ActionModal>
  )
}

function ProtocolModal({ initialData, onClose, onSave, isAr }: any) {
  const [data, setData] = useState(initialData || {
    titleEn: "", titleAr: "", triggerEn: "", triggerAr: "", responseStepsEn: "", responseStepsAr: "",
    contactNameEn: "", contactNameAr: "", contactPhone: "", active: true
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setSaving(true); setError("");
    try {
      await onSave({ id: initialData?.id, ...data });
      onClose();
    } catch(e) { setError(String(e)); }
    finally { setSaving(false); }
  }

  return (
    <ActionModal title={isAr ? (initialData ? "تعديل بروتوكول الطوارئ" : "بروتوكول طوارئ جديد") : (initialData ? "Edit Emergency Protocol" : "New Emergency Protocol")} onClose={onClose} onSubmit={submit} saving={saving} error={error} isAr={isAr}>
       <BilingualInput labelEn="Title (EN)" labelAr="العنوان (عربي)" required valueEn={data.titleEn} valueAr={data.titleAr} onChangeEn={(v: string) => setData({...data, titleEn: v})} onChangeAr={(v: string) => setData({...data, titleAr: v})} />
       <BilingualTextarea labelEn="Triggers (EN)" labelAr="دواعي التفعيل (عربي)" required valueEn={data.triggerEn} valueAr={data.triggerAr} onChangeEn={(v: string) => setData({...data, triggerEn: v})} onChangeAr={(v: string) => setData({...data, triggerAr: v})} />
       <BilingualTextarea labelEn="Response Steps (EN)" labelAr="خطوات الاستجابة (عربي)" required valueEn={data.responseStepsEn} valueAr={data.responseStepsAr} onChangeEn={(v: string) => setData({...data, responseStepsEn: v})} onChangeAr={(v: string) => setData({...data, responseStepsAr: v})} />
       <BilingualInput labelEn="Primary Contact Name (EN)" labelAr="اسم جهة الاتصال (عربي)" valueEn={data.contactNameEn || ""} valueAr={data.contactNameAr || ""} onChangeEn={(v: string) => setData({...data, contactNameEn: v})} onChangeAr={(v: string) => setData({...data, contactNameAr: v})} />
       <FormGroup label={isAr ? "رقم الهاتف" : "Contact Phone"} isAr={isAr}>
         <input type="text" className={fieldClass} value={data.contactPhone || ""} onChange={e => setData({...data, contactPhone: e.target.value})} dir="ltr" />
       </FormGroup>
       <label className={`flex items-center gap-2 mt-4 cursor-pointer ${isAr ? 'flex-row-reverse' : ''}`}>
         <input type="checkbox" checked={data.active} onChange={e => setData({...data, active: e.target.checked})} className="size-4 rounded border-cream-300 text-primary-600 focus:ring-primary-500" />
         <span className="text-sm font-bold text-espresso">{isAr ? "نشط" : "Active Protocol"}</span>
       </label>
    </ActionModal>
  )
}

function InspectionModal({ initialData, onClose, onSave, isAr }: any) {
  const [data, setData] = useState(initialData || {
    facilityType: "arena", assetNameEn: "", assetNameAr: "", result: "safe", findingsEn: "", findingsAr: "",
    correctiveActionEn: "", correctiveActionAr: "", inspectedAt: toLocalInput(new Date().toISOString()), nextDueAt: "", privateNote: ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setSaving(true); setError("");
    try {
      await onSave({ id: initialData?.id, ...data, nextDueAt: data.nextDueAt || null });
      onClose();
    } catch(e) { setError(String(e)); }
    finally { setSaving(false); }
  }

  return (
    <ActionModal title={isAr ? (initialData ? "تعديل الفحص" : "فحص جديد") : (initialData ? "Edit Inspection" : "New Inspection")} onClose={onClose} onSubmit={submit} saving={saving} error={error} isAr={isAr}>
       <div className="grid grid-cols-2 gap-4">
         <FormGroup label={isAr ? "نوع المرفق" : "Facility Type"} isAr={isAr}>
           <select className={fieldClass} value={data.facilityType} onChange={e => setData({...data, facilityType: e.target.value})} dir={isAr ? "rtl" : "ltr"}>
             <option value="arena">Arena</option>
             <option value="equipment">Equipment</option>
           </select>
         </FormGroup>
         <FormGroup label={isAr ? "النتيجة" : "Result"} isAr={isAr}>
           <select className={fieldClass} value={data.result} onChange={e => setData({...data, result: e.target.value})} dir={isAr ? "rtl" : "ltr"}>
             <option value="safe">Safe</option>
             <option value="attention">Attention</option>
             <option value="unsafe">Unsafe</option>
           </select>
         </FormGroup>
       </div>
       <BilingualInput labelEn="Asset Name (EN)" labelAr="اسم الأصل (عربي)" required valueEn={data.assetNameEn} valueAr={data.assetNameAr} onChangeEn={(v: string) => setData({...data, assetNameEn: v})} onChangeAr={(v: string) => setData({...data, assetNameAr: v})} />
       <div className="grid grid-cols-2 gap-4">
         <FormGroup label={isAr ? "وقت الفحص" : "Inspected At"} required isAr={isAr}>
           <input type="datetime-local" required className={fieldClass} value={data.inspectedAt} onChange={e => setData({...data, inspectedAt: e.target.value})} dir={isAr ? "rtl" : "ltr"} />
         </FormGroup>
         <FormGroup label={isAr ? "الفحص التالي (اختياري)" : "Next Due (Optional)"} isAr={isAr}>
           <input type="datetime-local" className={fieldClass} value={data.nextDueAt || ""} onChange={e => setData({...data, nextDueAt: e.target.value})} dir={isAr ? "rtl" : "ltr"} />
         </FormGroup>
       </div>
       <BilingualTextarea labelEn="Findings (EN)" labelAr="النتائج (عربي)" required valueEn={data.findingsEn} valueAr={data.findingsAr} onChangeEn={(v: string) => setData({...data, findingsEn: v})} onChangeAr={(v: string) => setData({...data, findingsAr: v})} />
        <BilingualTextarea labelEn="Corrective Action (EN)" labelAr="الإجراء التصحيحي (عربي)" required valueEn={data.correctiveActionEn} valueAr={data.correctiveActionAr} onChangeEn={(v: string) => setData({...data, correctiveActionEn: v})} onChangeAr={(v: string) => setData({...data, correctiveActionAr: v})} />
       <FormGroup label={isAr ? "ملاحظة خاصة" : "Private Note"} isAr={isAr}>
         <textarea className={fieldClass} value={data.privateNote || ""} onChange={e => setData({...data, privateNote: e.target.value})} rows={2} dir={isAr ? "rtl" : "ltr"} />
       </FormGroup>
    </ActionModal>
  )
}

function MaintenanceModal({ initialData, inspections, onClose, onSave, isAr }: any) {
  const [data, setData] = useState(initialData || {
    inspectionId: "", facilityType: "arena", assetNameEn: "", assetNameAr: "", maintenanceTypeEn: "", maintenanceTypeAr: "", status: "scheduled",
    dueAt: toLocalInput(new Date().toISOString()), detailsEn: "", detailsAr: "", privateNote: ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setSaving(true); setError("");
    try {
      await onSave({ id: initialData?.id, ...data, inspectionId: data.inspectionId || null });
      onClose();
    } catch(e) { setError(String(e)); }
    finally { setSaving(false); }
  }

  return (
    <ActionModal title={isAr ? (initialData ? "تعديل الصيانة" : "سجل صيانة جديد") : (initialData ? "Edit Maintenance" : "New Maintenance Record")} onClose={onClose} onSubmit={submit} saving={saving} error={error} isAr={isAr}>
       <FormGroup label={isAr ? "الفحص المرتبط (اختياري)" : "Linked Inspection (Optional)"} isAr={isAr}>
         <select className={fieldClass} value={data.inspectionId} onChange={e => setData({...data, inspectionId: e.target.value})} dir={isAr ? "rtl" : "ltr"}>
           <option value="">None</option>
           {inspections.map((i: any) => <option key={i.id} value={i.id}>{getLangField(i, 'assetNameEn', 'assetNameAr', isAr)} - {formatDate(i.inspectedAt, isAr ? 'ar' : 'en-US')}</option>)}
         </select>
       </FormGroup>
       <div className="grid grid-cols-2 gap-4">
         <FormGroup label={isAr ? "نوع المرفق" : "Facility Type"} isAr={isAr}>
           <select className={fieldClass} value={data.facilityType} onChange={e => setData({...data, facilityType: e.target.value})} dir={isAr ? "rtl" : "ltr"}>
             <option value="arena">Arena</option>
             <option value="equipment">Equipment</option>
           </select>
         </FormGroup>
         <FormGroup label={isAr ? "الحالة" : "Status"} isAr={isAr}>
           <select className={fieldClass} value={data.status} onChange={e => setData({...data, status: e.target.value})} dir={isAr ? "rtl" : "ltr"}>
             <option value="scheduled">Scheduled</option>
             <option value="in_progress">In Progress</option>
             <option value="completed">Completed</option>
             <option value="cancelled">Cancelled</option>
           </select>
         </FormGroup>
       </div>
       <BilingualInput labelEn="Asset Name (EN)" labelAr="اسم الأصل (عربي)" required valueEn={data.assetNameEn} valueAr={data.assetNameAr} onChangeEn={(v: string) => setData({...data, assetNameEn: v})} onChangeAr={(v: string) => setData({...data, assetNameAr: v})} />
        <div className="grid grid-cols-2 gap-4">
         <FormGroup label={isAr ? "تاريخ الاستحقاق" : "Due At"} required isAr={isAr}>
           <input type="datetime-local" required className={fieldClass} value={data.dueAt} onChange={e => setData({...data, dueAt: e.target.value})} dir={isAr ? "rtl" : "ltr"} />
         </FormGroup>
       </div>
        <BilingualInput labelEn="Maintenance Type (EN)" labelAr="نوع الصيانة (عربي)" required valueEn={data.maintenanceTypeEn} valueAr={data.maintenanceTypeAr} onChangeEn={(v: string) => setData({...data, maintenanceTypeEn: v})} onChangeAr={(v: string) => setData({...data, maintenanceTypeAr: v})} />
       <BilingualTextarea labelEn="Details (EN)" labelAr="التفاصيل (عربي)" required valueEn={data.detailsEn} valueAr={data.detailsAr} onChangeEn={(v: string) => setData({...data, detailsEn: v})} onChangeAr={(v: string) => setData({...data, detailsAr: v})} />
       <FormGroup label={isAr ? "ملاحظة خاصة" : "Private Note"} isAr={isAr}>
         <textarea className={fieldClass} value={data.privateNote || ""} onChange={e => setData({...data, privateNote: e.target.value})} rows={2} dir={isAr ? "rtl" : "ltr"} />
       </FormGroup>
    </ActionModal>
  )
}

function AlertModal({ horseId, onClose, onSave, isAr }: any) {
  const [data, setData] = useState({
    alertType: "welfare", severity: "attention", titleEn: "", titleAr: "", bodyEn: "", bodyAr: "", dueAt: ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setSaving(true); setError("");
    try {
      await onSave({ horseId, ...data, dueAt: data.dueAt || null });
      onClose();
    } catch(e) { setError(String(e)); }
    finally { setSaving(false); }
  }

  return (
    <ActionModal title={isAr ? "إنشاء تنبيه جديد" : "Create Alert"} onClose={onClose} onSubmit={submit} saving={saving} error={error} isAr={isAr}>
       <div className="grid grid-cols-2 gap-4">
         <FormGroup label={isAr ? "النوع" : "Alert Type"} isAr={isAr}>
           <select className={fieldClass} value={data.alertType} onChange={e => setData({...data, alertType: e.target.value})} dir={isAr ? "rtl" : "ltr"}>
             <option value="welfare">Welfare</option>
             <option value="clinical">Clinical</option>
             <option value="safety">Safety</option>
             <option value="maintenance">Maintenance</option>
             <option value="workload">Workload</option>
             <option value="care">Care</option>
           </select>
         </FormGroup>
         <FormGroup label={isAr ? "الخطورة" : "Severity"} isAr={isAr}>
           <select className={fieldClass} value={data.severity} onChange={e => setData({...data, severity: e.target.value})} dir={isAr ? "rtl" : "ltr"}>
             <option value="attention">Attention</option>
             <option value="urgent">Urgent</option>
             <option value="emergency">Emergency</option>
           </select>
         </FormGroup>
       </div>
       <BilingualInput labelEn="Title (EN)" labelAr="العنوان (عربي)" required valueEn={data.titleEn} valueAr={data.titleAr} onChangeEn={(v: string) => setData({...data, titleEn: v})} onChangeAr={(v: string) => setData({...data, titleAr: v})} />
       <BilingualTextarea labelEn="Body (EN)" labelAr="النص (عربي)" required valueEn={data.bodyEn} valueAr={data.bodyAr} onChangeEn={(v: string) => setData({...data, bodyEn: v})} onChangeAr={(v: string) => setData({...data, bodyAr: v})} />
       <FormGroup label={isAr ? "الموعد (اختياري)" : "Due At (Optional)"} isAr={isAr}>
         <input type="datetime-local" className={fieldClass} value={data.dueAt} onChange={e => setData({...data, dueAt: e.target.value})} dir={isAr ? "rtl" : "ltr"} />
       </FormGroup>
    </ActionModal>
  )
}

// -------------------------------------------------------------------------------------------------
// TAB VIEWS
// -------------------------------------------------------------------------------------------------

function OverviewTab({ workspace, mutations, onOpenModal, isAr }: any) {
  const openAlerts = workspace.alerts.filter((a: any) => a.status !== "resolved");
  const recentAudits = workspace.auditEvents.slice(0, 10);
  
  return (
    <div className="grid gap-6 lg:grid-cols-3 p-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="lg:col-span-2 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl text-espresso">{isAr ? "التنبيهات النشطة" : "Active Alerts"}</h2>
          <OutlineButton onClick={() => onOpenModal('alert', null)}>
            <Plus className="size-4 mr-2" /> {isAr ? "تنبيه جديد" : "New Alert"}
          </OutlineButton>
        </div>
        
        {openAlerts.length === 0 ? (
          <SurfaceCard className="p-8 transition-all duration-300 hover:border-primary-200 hover:shadow-md">
            <EmptyState icon={CheckCircle} title={isAr ? "لا توجد تنبيهات" : "No active alerts"} description={isAr ? "جميع الأمور مستقرة حالياً." : "All systems normal. No active welfare or safety alerts."} compact />
          </SurfaceCard>
        ) : (
          <div className="space-y-4">
            {openAlerts.map((alert: any) => (
              <SurfaceCard key={alert.id} className={`p-5 flex gap-5 items-start border-l-4 ${alert.severity === 'emergency' ? 'border-l-error-600' : alert.severity === 'urgent' ? 'border-l-error-400' : 'border-l-warning-500'}`}>
                <AlertTriangle className={`size-7 shrink-0 mt-0.5 ${alert.severity === 'emergency' ? 'text-error-600' : alert.severity === 'urgent' ? 'text-error-400' : 'text-warning-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                    <h3 className="font-bold text-espresso text-lg">{getLangField(alert, 'titleEn', 'titleAr', isAr)}</h3>
                    <div className="flex gap-2 items-center">
                      <StatusBadge status={alert.severity} />
                      <StatusBadge status={alert.alertType} />
                    </div>
                  </div>
                  <p className="text-sm text-text-secondary mt-2">{getLangField(alert, 'bodyEn', 'bodyAr', isAr)}</p>
                  
                  <div className="flex flex-wrap items-center justify-between mt-4 pt-4 border-t border-cream-100 gap-4">
                    {alert.dueAt ? (
                      <p className="text-xs text-error-600 font-semibold">{isAr ? "مستحق في:" : "Due:"} {formatDate(alert.dueAt, isAr ? 'ar' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    ) : <div />}
                    <div className="flex gap-2">
                      {alert.status === 'open' && (
                        <button onClick={() => mutations.updateAlert(alert.id, 'acknowledged')} className="text-xs font-bold text-primary-600 bg-primary-50 px-3 py-1.5 rounded-lg hover:bg-primary-100 transition">
                          {isAr ? "إقرار" : "Acknowledge"}
                        </button>
                      )}
                      <button onClick={() => mutations.updateAlert(alert.id, 'resolved')} className="text-xs font-bold text-success-700 bg-success-50 px-3 py-1.5 rounded-lg hover:bg-success-100 transition">
                        {isAr ? "حل" : "Resolve"}
                      </button>
                    </div>
                  </div>
                </div>
              </SurfaceCard>
            ))}
          </div>
        )}
      </div>
      
      <div className="space-y-6">
        <h2 className="font-serif text-2xl text-espresso">{isAr ? "سجل التدقيق" : "Recent Activity"}</h2>
        <SurfaceCard className="p-5 transition-all duration-300 hover:border-primary-200 hover:shadow-md">
           {recentAudits.length === 0 ? (
             <p className="text-sm text-text-secondary text-center py-4">{isAr ? "لا توجد نشاطات." : "No recent activity."}</p>
           ) : (
             <ul className="space-y-5">
               {recentAudits.map((event: any) => (
                 <li key={event.id} className="text-sm flex gap-3 items-start">
                   <div className="mt-0.5 size-2 rounded-full bg-primary-400 shrink-0" />
                   <div>
                     <p className="font-bold text-espresso">{event.action.replace(/_/g, ' ')}</p>
                     <p className="text-xs text-text-secondary mt-0.5">{event.entityType} • {formatDate(event.occurredAt, isAr ? 'ar' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                   </div>
                 </li>
               ))}
             </ul>
           )}
        </SurfaceCard>
      </div>
    </div>
  )
}

function HorsesTab({ workspace, mutations, onOpenModal, isAr }: any) {
  const [selectedHorseId, setSelectedHorseId] = useState<string | null>(workspace.horses[0]?.horseId || null);
  const [search, setSearch] = useState("");
  
  const filteredHorses = workspace.horses.filter((h: any) => h.name.toLowerCase().includes(search.toLowerCase()));
  const horse = workspace.horses.find((h: any) => h.horseId === selectedHorseId);
  const profile = workspace.profiles.find((p: any) => p.horseId === selectedHorseId);
  
  return (
    <div className="flex flex-col md:flex-row gap-6 p-6 h-[calc(100vh-280px)] min-h-[600px] animate-in fade-in duration-300">
       <div className="w-full md:w-80 shrink-0 flex flex-col gap-4 h-full">
          <div className="relative">
             <Search className={`absolute ${isAr ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 size-4 text-cream-500`} />
             <input 
               type="text" 
               placeholder={isAr ? "بحث عن حصان..." : "Search horses..."} 
               className={`${fieldClass} ${isAr ? 'pr-10' : 'pl-10'}`}
               value={search}
               onChange={e => setSearch(e.target.value)}
             />
          </div>
          <div className="flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar flex-1">
             {filteredHorses.map((h: any) => {
               const p = workspace.profiles.find((x: any) => x.horseId === h.horseId);
               const status = p ? p.welfareStatus : "unknown";
               const statusColor = status === "well" ? "bg-success-50 text-success-700 border-success-200" : status === "urgent" ? "bg-error-50 text-error-700 border-error-200" : "bg-warning-50 text-warning-700 border-warning-200";
               
               return (
                 <button 
                   key={h.horseId}
                   onClick={() => setSelectedHorseId(h.horseId)}
                   className={`text-left p-4 rounded-xl border transition-all ${selectedHorseId === h.horseId ? 'border-primary-500 bg-white shadow-md' : 'border-transparent hover:bg-white/60 bg-cream-50/50'}`}
                 >
                    <div className={`font-bold text-espresso ${isAr ? 'text-right' : ''}`}>{h.name}</div>
                    <div className={`flex items-center justify-between mt-2 ${isAr ? 'flex-row-reverse' : ''}`}>
                      <span className="text-xs text-text-secondary">{h.breed || "—"}</span>
                      <span className={`text-[0.65rem] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${statusColor}`}>{status}</span>
                    </div>
                 </button>
               )
             })}
          </div>
       </div>
       
       <div className="flex-1 overflow-hidden h-full pb-8 md:pb-0">
          {horse ? <HorseDetailView horse={horse} profile={profile} workspace={workspace} mutations={mutations} onOpenModal={onOpenModal} isAr={isAr} /> : (
            <SurfaceCard className="h-full flex items-center justify-center">
              <EmptyState icon={Info} title={isAr ? "اختر حصاناً" : "Select a Horse"} description={isAr ? "اختر حصاناً من القائمة لعرض ملفه الطبي." : "Choose a horse from the list to view its clinical profile."} />
            </SurfaceCard>
          )}
       </div>
    </div>
  )
}

function HorseDetailView({ horse, profile, workspace, mutations, onOpenModal, isAr }: any) {
  const [subTab, setSubTab] = useState<"profile" | "care" | "clinical" | "history">("profile");
  
  return (
    <SurfaceCard className="overflow-hidden flex flex-col h-full bg-white shadow-sm border border-cream-200">
       <div className={`p-6 border-b border-cream-200 bg-espresso text-cream-50 flex justify-between items-start ${isAr ? 'flex-row-reverse text-right' : ''}`}>
         <div>
           <h2 className="text-3xl font-serif">{horse.name}</h2>
           <p className="text-sm text-cream-300 mt-1">{horse.breed || (isAr ? "لم يحدد السلالة" : "No breed specified")}</p>
         </div>
         <button onClick={() => onOpenModal('profile', { horse, profile })} className="bg-white/10 hover:bg-white/20 transition px-4 py-2 rounded-xl text-sm font-bold backdrop-blur">
           {isAr ? "تعديل الملف" : "Edit Profile"}
         </button>
       </div>
       
       <div className="flex border-b border-cream-200 px-2 bg-cream-50/50 rtl:space-x-reverse overflow-x-auto custom-scrollbar">
         {[
           { id: "profile", label: isAr ? "الملف الصحي" : "Health Profile" },
           { id: "care", label: isAr ? "التغذية والعناية" : "Feeding & Care" },
           { id: "clinical", label: isAr ? "الجدول السريري" : "Clinical" },
           { id: "history", label: isAr ? "الملاحظات والحوادث" : "History" },
         ].map(t => (
           <button 
             key={t.id}
             onClick={() => setSubTab(t.id as any)}
             className={`px-5 py-3.5 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${subTab === t.id ? 'border-primary-500 text-espresso' : 'border-transparent text-text-secondary hover:text-espresso'}`}
           >
             {t.label}
           </button>
         ))}
       </div>
       
       <div className="p-6 flex-1 overflow-y-auto bg-white custom-scrollbar">
          {subTab === "profile" && <HorseProfileTab profile={profile} isAr={isAr} />}
          {subTab === "care" && <HorseCareTab horseId={horse.horseId} workspace={workspace} onOpenModal={onOpenModal} isAr={isAr} />}
          {subTab === "clinical" && <HorseClinicalTab horseId={horse.horseId} workspace={workspace} onOpenModal={onOpenModal} isAr={isAr} />}
          {subTab === "history" && <HorseHistoryTab horseId={horse.horseId} workspace={workspace} mutations={mutations} onOpenModal={onOpenModal} isAr={isAr} />}
       </div>
    </SurfaceCard>
  )
}

function HorseProfileTab({ profile, isAr }: any) {
  if (!profile) return <EmptyState icon={Info} title={isAr ? "لا يوجد ملف" : "No Profile"} description={isAr ? "قم بإنشاء ملف رعاية للبدء بالمراقبة." : "Create a welfare profile to begin monitoring."} compact />
  
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SurfaceCard className="p-4 flex flex-col justify-center items-center text-center bg-cream-50/50 transition-all duration-300 hover:border-primary-200 hover:shadow-md">
          <p className="text-[0.65rem] font-bold text-text-secondary uppercase tracking-widest mb-2">{isAr ? "الحالة" : "Status"}</p>
          <StatusBadge status={profile.welfareStatus} />
        </SurfaceCard>
        <SurfaceCard className="p-4 flex flex-col justify-center items-center text-center bg-cream-50/50 transition-all duration-300 hover:border-primary-200 hover:shadow-md">
          <p className="text-[0.65rem] font-bold text-text-secondary uppercase tracking-widest mb-2">{isAr ? "الملاءمة" : "Suitability"}</p>
          <StatusBadge status={profile.riderSuitability} />
        </SurfaceCard>
        <SurfaceCard className="p-4 flex flex-col justify-center items-center text-center bg-cream-50/50 transition-all duration-300 hover:border-primary-200 hover:shadow-md">
          <p className="text-[0.65rem] font-bold text-text-secondary uppercase tracking-widest mb-1">{isAr ? "العمل" : "Workload"}</p>
          <p className="font-serif text-2xl text-espresso">{profile.dailyWorkloadLimitMinutes} <span className="text-sm font-sans text-text-secondary">min</span></p>
        </SurfaceCard>
        <SurfaceCard className="p-4 flex flex-col justify-center items-center text-center bg-cream-50/50 transition-all duration-300 hover:border-primary-200 hover:shadow-md">
          <p className="text-[0.65rem] font-bold text-text-secondary uppercase tracking-widest mb-1">{isAr ? "BCS" : "BCS"}</p>
          <p className="font-serif text-2xl text-espresso">{profile.bodyConditionScore ?? "—"}</p>
        </SurfaceCard>
      </div>
      
      <div className="grid md:grid-cols-2 gap-4">
        <SurfaceCard className="p-5 border-t-4 border-t-primary-400 transition-all duration-300 hover:shadow-md">
           <h4 className={`font-bold text-espresso mb-3 ${isAr ? 'text-right' : ''}`}>{isAr ? "ملاحظة الملاءمة" : "Suitability Note"}</h4>
           <p className={`text-sm text-text-secondary leading-relaxed ${isAr ? 'text-right' : ''}`}>{getLangField(profile, 'suitabilityNoteEn', 'suitabilityNoteAr', isAr) || "—"}</p>
        </SurfaceCard>
        <SurfaceCard className="p-5 border-t-4 border-t-espresso transition-all duration-300 hover:shadow-md">
           <h4 className={`font-bold text-espresso mb-3 ${isAr ? 'text-right' : ''}`}>{isAr ? "ملاحظة خاصة" : "Private Note"}</h4>
           <p className={`text-sm text-text-secondary leading-relaxed ${isAr ? 'text-right' : ''}`}>{profile.privateWelfareNote || "—"}</p>
        </SurfaceCard>
      </div>
    </div>
  )
}

function HorseCareTab({ horseId, workspace, onOpenModal, isAr }: any) {
  const plans = workspace.feedingPlans.filter((p: any) => p.horseId === horseId);
  const logs = workspace.dailyCareLogs.filter((l: any) => l.horseId === horseId).sort((a: any, b: any) => new Date(b.careDate).getTime() - new Date(a.careDate).getTime());
  
  return (
    <div className="space-y-10 animate-in fade-in duration-300">
      <div>
        <div className={`flex justify-between items-center mb-5 ${isAr ? 'flex-row-reverse' : ''}`}>
          <h3 className="font-serif text-2xl text-espresso">{isAr ? "خطط التغذية" : "Feeding Plans"}</h3>
          <OutlineButton onClick={() => onOpenModal('feeding', null, horseId)}><Plus className="size-4 mr-2" /> {isAr ? "إضافة خطة" : "Add Plan"}</OutlineButton>
        </div>
        {plans.length === 0 ? <EmptyState icon={ClipboardList} title={isAr ? "لا توجد خطط" : "No Feeding Plans"} description={isAr ? "أضف خطة تغذية لهيكلة التغذية." : "Add a feeding plan to structure daily nutrition."} compact /> : (
          <div className="grid gap-4">
            {plans.map((p: any) => (
              <SurfaceCard key={p.id} className="p-5">
                <div className={`flex justify-between items-start mb-3 ${isAr ? 'flex-row-reverse' : ''}`}>
                  <div>
                    <h4 className={`font-bold text-lg text-espresso ${isAr ? 'text-right' : ''}`}>{getLangField(p, 'feedNameEn', 'feedNameAr', isAr)}</h4>
                    <p className={`text-sm text-text-secondary mt-1 ${isAr ? 'text-right' : ''}`}>{getLangField(p, 'amountDescriptionEn', 'amountDescriptionAr', isAr)} • {p.mealsPerDay} {isAr ? "وجبات/يوم" : "meals/day"}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <div className="bg-cream-50 p-4 rounded-xl mb-4">
                  <p className={`text-sm text-espresso ${isAr ? 'text-right' : ''}`}>{getLangField(p, 'instructionsEn', 'instructionsAr', isAr)}</p>
                </div>
                <div className={`flex justify-between items-center ${isAr ? 'flex-row-reverse' : ''}`}>
                  <p className="text-xs text-text-secondary font-bold tracking-wide">
                    {formatDate(p.startsOn, isAr ? 'ar' : 'en-US')} {p.endsOn ? ` — ${formatDate(p.endsOn, isAr ? 'ar' : 'en-US')}` : ''}
                  </p>
                  <button onClick={() => onOpenModal('feeding', p, horseId)} className="text-primary-600 text-sm font-bold hover:underline">{isAr ? "تعديل" : "Edit"}</button>
                </div>
              </SurfaceCard>
            ))}
          </div>
        )}
      </div>
      <div>
        <div className={`flex justify-between items-center mb-5 ${isAr ? 'flex-row-reverse' : ''}`}>
          <h3 className="font-serif text-2xl text-espresso">{isAr ? "سجلات العناية" : "Daily Care Logs"}</h3>
          <OutlineButton onClick={() => onOpenModal('careLog', null, horseId)}><Plus className="size-4 mr-2" /> {isAr ? "إضافة سجل" : "Add Log"}</OutlineButton>
        </div>
        {logs.length === 0 ? <EmptyState icon={ClipboardList} title={isAr ? "لا توجد سجلات" : "No Care Logs"} description={isAr ? "لم يتم تسجيل عناية يومية بعد." : "No daily care recorded yet."} compact /> : (
          <div className="space-y-3">
            {logs.map((l: any) => (
              <SurfaceCard key={l.id} className="p-4 flex flex-col gap-3">
                <p className={`font-bold text-espresso ${isAr ? 'text-right' : ''}`}>{formatDate(l.careDate, isAr ? 'ar' : 'en-US')}</p>
                <div className={`flex flex-wrap gap-2 ${isAr ? 'flex-row-reverse' : ''}`}>
                  {l.feedChecked && <StatusBadge status="completed" label={isAr ? "علف" : "Feed"} />}
                  {l.waterChecked && <StatusBadge status="completed" label={isAr ? "ماء" : "Water"} />}
                  {l.turnoutChecked && <StatusBadge status="completed" label={isAr ? "مرعى" : "Turnout"} />}
                  {l.groomingChecked && <StatusBadge status="completed" label={isAr ? "تنظيف" : "Grooming"} />}
                  {l.tackChecked && <StatusBadge status="completed" label={isAr ? "معدات" : "Tack"} />}
                </div>
                {(l.observationEn || l.observationAr) && (
                  <p className={`text-sm text-text-secondary bg-cream-50 p-3 rounded-lg ${isAr ? 'text-right' : ''}`}>{getLangField(l, 'observationEn', 'observationAr', isAr)}</p>
                )}
              </SurfaceCard>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function HorseClinicalTab({ horseId, workspace, onOpenModal, isAr }: any) {
  const schedules = workspace.clinicalSchedules.filter((s: any) => s.horseId === horseId).sort((a: any, b: any) => new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime());
  
  return (
    <div className="animate-in fade-in duration-300">
      <div className={`flex justify-between items-center mb-6 ${isAr ? 'flex-row-reverse' : ''}`}>
        <h3 className="font-serif text-2xl text-espresso">{isAr ? "الجدول السريري" : "Clinical Schedule"}</h3>
        <PrimaryButton onClick={() => onOpenModal('clinical', null, horseId)}><Plus className="size-4 mr-2" /> {isAr ? "موعد جديد" : "New Schedule"}</PrimaryButton>
      </div>
      {schedules.length === 0 ? <EmptyState icon={Stethoscope} title={isAr ? "الجدول فارغ" : "Empty Schedule"} description={isAr ? "لا توجد مواعيد طبية قادمة." : "No upcoming medical or clinical appointments."} compact /> : (
        <div className="grid gap-4">
          {schedules.map((s: any) => (
            <SurfaceCard key={s.id} className="p-5 flex flex-col md:flex-row gap-5">
              <div className="w-full md:w-48 shrink-0 flex flex-col gap-1 border-b md:border-b-0 md:border-r border-cream-200 pb-4 md:pb-0 md:pr-4">
                <StatusBadge status={s.scheduleType} />
                <p className="font-bold text-espresso mt-2">{formatDate(s.dueAt, isAr ? 'ar' : 'en-US')}</p>
                <p className="text-xs text-text-secondary">{new Date(s.dueAt).toLocaleTimeString(isAr ? 'ar' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                <div className="mt-auto pt-4">
                  <StatusBadge status={s.status} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className={`flex justify-between items-start mb-2 ${isAr ? 'flex-row-reverse' : ''}`}>
                  <h4 className={`font-bold text-lg text-espresso ${isAr ? 'text-right' : ''}`}>{getLangField(s, 'titleEn', 'titleAr', isAr)}</h4>
                  <button onClick={() => onOpenModal('clinical', s, horseId)} className="text-primary-600 text-sm font-bold">{isAr ? "تعديل" : "Edit"}</button>
                </div>
                {s.providerEn && <p className={`text-sm text-primary-700 font-semibold mb-3 ${isAr ? 'text-right' : ''}`}>{getLangField(s, 'providerEn', 'providerAr', isAr)}</p>}
                
                {(s.medicationNameEn || s.medicationNameAr) && (
                  <div className={`mb-3 bg-primary-50 p-3 rounded-lg ${isAr ? 'text-right' : ''}`}>
                    <p className="text-xs font-bold text-primary-700 uppercase tracking-wider mb-1">{isAr ? "الدواء" : "Medication"}</p>
                    <p className="text-sm text-espresso font-semibold">{getLangField(s, 'medicationNameEn', 'medicationNameAr', isAr)} <span className="font-normal text-text-secondary ml-2">{getLangField(s, 'dosageEn', 'dosageAr', isAr)}</span></p>
                  </div>
                )}
                
                <p className={`text-sm text-text-secondary ${isAr ? 'text-right' : ''}`}>{getLangField(s, 'instructionsEn', 'instructionsAr', isAr)}</p>
              </div>
            </SurfaceCard>
          ))}
        </div>
      )}
    </div>
  )
}

function HorseHistoryTab({ horseId, workspace, mutations, onOpenModal, isAr }: any) {
  const observations = workspace.observations.filter((o: any) => o.horseId === horseId).sort((a: any, b: any) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime());
  const incidents = workspace.incidents.filter((i: any) => i.horseId === horseId).sort((a: any, b: any) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  
  return (
    <div className="space-y-10 animate-in fade-in duration-300">
      <div>
        <div className={`flex justify-between items-center mb-5 ${isAr ? 'flex-row-reverse' : ''}`}>
          <h3 className="font-serif text-2xl text-espresso">{isAr ? "الملاحظات" : "Observations"}</h3>
          <OutlineButton onClick={() => onOpenModal('observation', null, horseId)}><Plus className="size-4 mr-2" /> {isAr ? "ملاحظة جديدة" : "Record"}</OutlineButton>
        </div>
        {observations.length === 0 ? <p className={`text-sm text-text-secondary ${isAr ? 'text-right' : ''}`}>{isAr ? "لا توجد ملاحظات." : "No observations recorded."}</p> : (
          <div className="grid gap-4">
            {observations.map((obs: any) => (
              <SurfaceCard key={obs.id} className="p-5">
                <div className={`flex justify-between items-start mb-3 ${isAr ? 'flex-row-reverse' : ''}`}>
                  <div className={isAr ? 'text-right' : ''}>
                    <p className="text-xs text-text-secondary font-bold mb-1">{formatDate(obs.observedAt, isAr ? 'ar' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    <span className="font-bold text-espresso">{getLangField(obs, 'summaryEn', 'summaryAr', isAr)}</span>
                  </div>
                  <div className="flex gap-2">
                    <StatusBadge status={obs.category} />
                    <StatusBadge status={obs.severity} />
                  </div>
                </div>
                <div className={`bg-cream-50 p-4 rounded-xl ${isAr ? 'text-right' : ''}`}>
                  <p className="text-xs font-bold text-text-secondary uppercase mb-1">{isAr ? "الإجراء المتخذ" : "Action Taken"}</p>
                  <p className="text-sm text-espresso">{getLangField(obs, 'actionTakenEn', 'actionTakenAr', isAr)}</p>
                </div>
                <div className={`flex justify-between items-center mt-4 pt-4 border-t border-cream-100 ${isAr ? 'flex-row-reverse' : ''}`}>
                  <StatusBadge status={obs.status} />
                  {obs.status !== 'resolved' && (
                    <div className="flex gap-2">
                      {obs.status === 'open' && (
                        <button onClick={() => mutations.updateObservation(obs.id, 'acknowledged')} className="text-xs font-bold text-primary-600 bg-primary-50 px-3 py-1.5 rounded hover:bg-primary-100 transition">
                          {isAr ? "إقرار" : "Acknowledge"}
                        </button>
                      )}
                      <button onClick={() => mutations.updateObservation(obs.id, 'resolved')} className="text-xs font-bold text-success-700 bg-success-50 px-3 py-1.5 rounded hover:bg-success-100 transition">
                        {isAr ? "حل" : "Resolve"}
                      </button>
                    </div>
                  )}
                </div>
              </SurfaceCard>
            ))}
          </div>
        )}
      </div>
      
      <div>
        <div className={`flex justify-between items-center mb-5 ${isAr ? 'flex-row-reverse' : ''}`}>
          <h3 className="font-serif text-2xl text-espresso text-error-700">{isAr ? "الحوادث" : "Incidents"}</h3>
          <OutlineButton onClick={() => onOpenModal('incident', null, horseId)} className="border-error-200 text-error-700 hover:bg-error-50 hover:border-error-300"><Plus className="size-4 mr-2" /> {isAr ? "تسجيل حادثة" : "Record Incident"}</OutlineButton>
        </div>
        {incidents.length === 0 ? <p className={`text-sm text-text-secondary ${isAr ? 'text-right' : ''}`}>{isAr ? "لا توجد حوادث مسجلة." : "No incidents recorded."}</p> : (
          <div className="grid gap-4">
            {incidents.map((inc: any) => (
              <SurfaceCard key={inc.id} className="p-5 border-l-4 border-l-error-500">
                <div className={`flex justify-between items-start mb-3 ${isAr ? 'flex-row-reverse' : ''}`}>
                  <div className={isAr ? 'text-right' : ''}>
                    <p className="text-xs text-text-secondary font-bold mb-1">{formatDate(inc.occurredAt, isAr ? 'ar' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    <span className="font-bold text-espresso text-lg">{getLangField(inc, 'summaryEn', 'summaryAr', isAr)}</span>
                  </div>
                  <div className="flex gap-2">
                    <StatusBadge status={inc.incidentType} />
                    <StatusBadge status={inc.severity} />
                  </div>
                </div>
                <div className={`bg-error-50 p-4 rounded-xl ${isAr ? 'text-right' : ''}`}>
                  <p className="text-xs font-bold text-error-700 uppercase mb-1">{isAr ? "الاستجابة" : "Response"}</p>
                  <p className="text-sm text-espresso">{getLangField(inc, 'responseEn', 'responseAr', isAr)}</p>
                </div>
                <div className={`flex justify-between items-center mt-4 pt-4 border-t border-cream-100 ${isAr ? 'flex-row-reverse' : ''}`}>
                  <StatusBadge status={inc.status} />
                  {inc.status !== 'closed' && (
                    <div className="flex gap-2">
                      {inc.status === 'open' && (
                        <button onClick={() => mutations.updateIncident(inc.id, 'investigating')} className="text-xs font-bold text-warning-700 bg-warning-50 px-3 py-1.5 rounded hover:bg-warning-100 transition">
                          {isAr ? "قيد التحقيق" : "Investigate"}
                        </button>
                      )}
                      <button onClick={() => mutations.updateIncident(inc.id, 'closed')} className="text-xs font-bold text-success-700 bg-success-50 px-3 py-1.5 rounded hover:bg-success-100 transition">
                        {isAr ? "إغلاق" : "Close"}
                      </button>
                    </div>
                  )}
                </div>
              </SurfaceCard>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FacilityTab({ workspace, onOpenModal, isAr }: any) {
  return (
    <div className="grid lg:grid-cols-2 gap-8 p-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="space-y-6">
         <div className={`flex justify-between items-center ${isAr ? 'flex-row-reverse' : ''}`}>
            <h3 className="text-2xl font-serif text-espresso">{isAr ? "الفحوصات والصيانة" : "Inspections & Maintenance"}</h3>
            <div className="flex gap-2">
              <OutlineButton onClick={() => onOpenModal('inspection', null)}><Plus className="size-4" /></OutlineButton>
              <OutlineButton onClick={() => onOpenModal('maintenance', null)}><Wrench className="size-4" /></OutlineButton>
            </div>
         </div>
         
         <div className="space-y-4">
           <h4 className={`text-xs font-bold text-text-secondary uppercase tracking-widest ${isAr ? 'text-right' : ''}`}>{isAr ? "الفحوصات" : "Safety Inspections"}</h4>
           {workspace.inspections.length === 0 ? <p className="text-sm text-text-secondary text-center py-4 bg-cream-50 rounded-xl">None</p> : workspace.inspections.map((ins: any) => (
              <SurfaceCard key={ins.id} className="p-5">
                 <div className={`flex justify-between items-start mb-3 ${isAr ? 'flex-row-reverse' : ''}`}>
                   <div className={isAr ? 'text-right' : ''}>
                     <p className="text-xs font-bold text-text-secondary mb-1">{formatDate(ins.inspectedAt, isAr ? 'ar' : 'en-US')}</p>
                     <span className="font-bold text-espresso text-lg">{getLangField(ins, 'assetNameEn', 'assetNameAr', isAr)}</span>
                   </div>
                   <StatusBadge status={ins.result} />
                 </div>
                 <p className={`text-sm text-text-secondary mb-3 ${isAr ? 'text-right' : ''}`}>{getLangField(ins, 'findingsEn', 'findingsAr', isAr)}</p>
                 <div className={`bg-cream-50 p-3 rounded-lg flex flex-col gap-1 ${isAr ? 'text-right' : ''}`}>
                   <span className="text-xs font-bold text-espresso uppercase">{isAr ? "الإجراء" : "Corrective Action"}</span>
                   <span className="text-sm text-espresso">{getLangField(ins, 'correctiveActionEn', 'correctiveActionAr', isAr)}</span>
                 </div>
                 <button onClick={() => onOpenModal('inspection', ins)} className={`text-primary-600 text-xs font-bold mt-4 block ${isAr ? 'text-right mr-auto' : 'text-left ml-auto'}`}>
                   {isAr ? "تعديل" : "Edit Inspection"}
                 </button>
              </SurfaceCard>
           ))}
         </div>

         <div className="space-y-4 pt-4 border-t border-cream-200">
           <h4 className={`text-xs font-bold text-text-secondary uppercase tracking-widest ${isAr ? 'text-right' : ''}`}>{isAr ? "الصيانة" : "Maintenance Records"}</h4>
           {workspace.maintenance.length === 0 ? <p className="text-sm text-text-secondary text-center py-4 bg-cream-50 rounded-xl">None</p> : workspace.maintenance.map((mnt: any) => (
              <SurfaceCard key={mnt.id} className="p-5 border-l-4 border-l-primary-500">
                 <div className={`flex justify-between items-start mb-2 ${isAr ? 'flex-row-reverse' : ''}`}>
                   <div className={isAr ? 'text-right' : ''}>
                     <span className="font-bold text-espresso text-lg block">{getLangField(mnt, 'assetNameEn', 'assetNameAr', isAr)}</span>
                      <span className="text-sm text-text-secondary">{getLangField(mnt, 'maintenanceTypeEn', 'maintenanceTypeAr', isAr)}</span>
                   </div>
                   <StatusBadge status={mnt.status} />
                 </div>
                 <p className={`text-sm text-text-secondary mt-3 ${isAr ? 'text-right' : ''}`}>{getLangField(mnt, 'detailsEn', 'detailsAr', isAr)}</p>
                 <div className={`flex justify-between items-center mt-4 ${isAr ? 'flex-row-reverse' : ''}`}>
                   <span className="text-xs font-bold text-espresso">{isAr ? "الاستحقاق:" : "Due:"} {formatDate(mnt.dueAt, isAr ? 'ar' : 'en-US')}</span>
                   <button onClick={() => onOpenModal('maintenance', mnt)} className="text-primary-600 text-xs font-bold">
                     {isAr ? "تعديل" : "Edit"}
                   </button>
                 </div>
              </SurfaceCard>
           ))}
         </div>
      </div>
      
      <div className="space-y-6">
         <div className={`flex justify-between items-center ${isAr ? 'flex-row-reverse' : ''}`}>
            <h3 className="text-2xl font-serif text-espresso text-error-700">{isAr ? "بروتوكولات الطوارئ" : "Emergency Protocols"}</h3>
            <OutlineButton onClick={() => onOpenModal('protocol', null)} className="border-error-200 text-error-700 hover:bg-error-50 hover:border-error-300">
              <Plus className="size-4 mr-2" /> {isAr ? "بروتوكول جديد" : "New Protocol"}
            </OutlineButton>
         </div>
         {workspace.protocols.length === 0 ? (
           <EmptyState icon={ShieldAlert} title={isAr ? "لا توجد بروتوكولات" : "No Protocols"} description={isAr ? "أضف بروتوكولات استجابة للطوارئ." : "Define emergency response protocols."} compact />
         ) : workspace.protocols.map((pro: any) => (
            <SurfaceCard key={pro.id} className="p-5 flex flex-col gap-3">
               <div className={`flex justify-between items-start ${isAr ? 'flex-row-reverse' : ''}`}>
                 <span className={`font-bold text-espresso text-xl ${isAr ? 'text-right' : ''}`}>{getLangField(pro, 'titleEn', 'titleAr', isAr)}</span>
                 <span className={`text-xs font-bold px-2 py-1 rounded-full ${pro.active ? 'bg-success-50 text-success-700' : 'bg-cream-100 text-text-secondary'}`}>{pro.active ? 'Active' : 'Inactive'}</span>
               </div>
               <div className={`bg-error-50/50 p-4 rounded-xl border border-error-100 ${isAr ? 'text-right' : ''}`}>
                 <p className="text-xs font-bold text-error-700 uppercase mb-1">{isAr ? "الدافع" : "Triggers"}</p>
                 <p className="text-sm text-espresso font-semibold">{getLangField(pro, 'triggerEn', 'triggerAr', isAr)}</p>
               </div>
               <div className={`bg-cream-50 p-4 rounded-xl ${isAr ? 'text-right' : ''}`}>
                 <p className="text-xs font-bold text-text-secondary uppercase mb-1">{isAr ? "الاستجابة" : "Response Steps"}</p>
                 <p className="text-sm text-espresso whitespace-pre-wrap leading-relaxed">{getLangField(pro, 'responseStepsEn', 'responseStepsAr', isAr)}</p>
               </div>
               {pro.contactNameEn && (
                 <p className={`text-sm text-espresso font-bold mt-2 ${isAr ? 'text-right' : ''}`}>
                   {isAr ? "اتصال بـ:" : "Contact:"} {getLangField(pro, 'contactNameEn', 'contactNameAr', isAr)} <span className="text-text-secondary font-normal ml-2">{pro.contactPhone}</span>
                 </p>
               )}
               <button onClick={() => onOpenModal('protocol', pro)} className={`text-primary-600 text-xs font-bold mt-2 ${isAr ? 'text-right self-end' : 'text-left self-start'}`}>
                 {isAr ? "تعديل" : "Edit Protocol"}
               </button>
            </SurfaceCard>
         ))}
      </div>
    </div>
  )
}


// -------------------------------------------------------------------------------------------------
// PAGE ENTRY POINT
// -------------------------------------------------------------------------------------------------

export default function HorseWelfarePage() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  
  const access = useHorseWelfareAccess();
  const canManage = access.data?.canManage ?? false;
  const workspace = useHorseWelfare(canManage);

  const [activeTab, setActiveTab] = useState<"overview" | "horses" | "facility">("overview");
  
  const [modalState, setModalState] = useState<{
    type: 'profile' | 'feeding' | 'careLog' | 'clinical' | 'observation' | 'incident' | 'inspection' | 'maintenance' | 'protocol' | 'alert' | null;
    data?: any;
    horseId?: string;
  }>({ type: null });

  const close = () => setModalState({ type: null });
  const open = (type: any, data: any = null, horseId?: string) => setModalState({ type, data, horseId });

  const loading = access.loading || (canManage && workspace.loading);
  const error = access.error || (canManage && workspace.error);
  
  if (loading) return <PageSkeleton cards={4} />;
  
  if (error) return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
       <ErrorState message={String(error)} />
    </div>
  );
  
  if (!access.data?.enabled || !canManage) {
     return (
       <div className="mx-auto max-w-4xl space-y-8 p-6">
         <PageHeader title={isAr ? "رعاية الخيول" : "Horse Welfare"} eyebrow="Workspace" />
         <EmptyState 
           icon={ShieldAlert}
           title={isAr ? "الوصول مقيد" : "Access Restricted"}
           description={isAr ? "ليس لديك الصلاحيات اللازمة للوصول إلى مساحة رعاية الخيول والعمليات." : "You do not have the required permissions to access the Horse Welfare and Clinical Operations workspace."}
         />
       </div>
     );
  }

  const w = workspace.data;

  return (
    <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8 py-8 space-y-6">
       {/* Hero Banner */}
       <div className="bg-espresso text-cream-50 px-8 py-12 rounded-[2rem] shadow-lg relative overflow-hidden flex flex-col lg:flex-row gap-8 lg:items-end justify-between border-4 border-espresso outline outline-1 outline-cream-200">
         <HeartPulse className={`absolute -bottom-16 ${isAr ? '-left-16' : '-right-16'} size-80 text-cream-900/30 rotate-12`} />
         <div className={`relative z-10 max-w-3xl ${isAr ? 'text-right' : ''}`}>
           <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400 mb-3">{isAr ? "عمليات الأكاديمية" : "Academy Operations"}</p>
           <h1 className="text-4xl sm:text-5xl font-serif leading-tight">{isAr ? "رعاية الخيول والعمليات" : "Horse Welfare & Clinical Operations"}</h1>
           <p className="mt-4 text-cream-200 text-lg leading-relaxed max-w-2xl">
             {isAr 
               ? "مساحة آمنة لإدارة صحة الخيول، الجداول السريرية، بروتوكولات الطوارئ وفحوصات المرافق بسرية تامة وكفاءة عالية." 
               : "A secure, high-density workspace to manage clinical schedules, emergency protocols, and facility safety with absolute privacy."}
           </p>
         </div>
         
         <div className={`relative z-10 flex gap-4 ${isAr ? 'flex-row-reverse' : ''}`}>
           <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-6 py-4 text-center">
             <p className="text-[0.65rem] font-bold uppercase tracking-widest text-cream-300 mb-1">{isAr ? "تنبيهات" : "Open Alerts"}</p>
             <p className="text-3xl font-serif text-white">{w?.alerts?.filter((a: any) => a.status === "open").length || 0}</p>
           </div>
           <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-6 py-4 text-center">
             <p className="text-[0.65rem] font-bold uppercase tracking-widest text-cream-300 mb-1">{isAr ? "خيول" : "Monitored"}</p>
             <p className="text-3xl font-serif text-white">{w?.profiles?.filter((p: any) => p.welfareStatus !== "well").length || 0}</p>
           </div>
         </div>
       </div>

       {/* Navigation */}
       <div className={`flex overflow-x-auto border-b-2 border-cream-200 mb-6 ${isAr ? 'space-x-reverse space-x-2' : 'space-x-2'} custom-scrollbar`}>
         {[
           { id: "overview", label: isAr ? "نظرة عامة" : "Overview", icon: Activity },
           { id: "horses", label: isAr ? "الخيول والملفات" : "Horses & Profiles", icon: HeartPulse },
           { id: "facility", label: isAr ? "المرافق والطوارئ" : "Facility & Emergency", icon: HardHat },
         ].map(tab => (
           <button
             key={tab.id}
             onClick={() => setActiveTab(tab.id as any)}
             className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all duration-200 whitespace-nowrap -mb-0.5 rounded-t-xl ${
               activeTab === tab.id 
                 ? "border-b-4 border-primary-600 text-primary-700 bg-white shadow-sm"
                 : "border-b-4 border-transparent text-text-secondary hover:text-espresso hover:bg-white/50"
             }`}
           >
             <tab.icon className="size-4" />
             {tab.label}
           </button>
         ))}
       </div>

       {/* Content */}
       {w && (
         <div className="min-h-[600px]">
           {activeTab === "overview" && <OverviewTab workspace={w} mutations={workspace} onOpenModal={open} isAr={isAr} />}
           {activeTab === "horses" && <HorsesTab workspace={w} mutations={workspace} onOpenModal={open} isAr={isAr} />}
           {activeTab === "facility" && <FacilityTab workspace={w} mutations={workspace} onOpenModal={open} isAr={isAr} />}
         </div>
       )}

       {/* Modals */}
       {modalState.type === 'profile' && <ProfileFormModal horse={modalState.data.horse} profile={modalState.data.profile} onClose={close} onSave={workspace.saveProfile} isAr={isAr} />}
       {modalState.type === 'feeding' && <FeedingPlanModal initialData={modalState.data} horseId={modalState.horseId} onClose={close} onSave={workspace.saveFeedingPlan} isAr={isAr} />}
       {modalState.type === 'careLog' && <CareLogModal horseId={modalState.horseId} onClose={close} onSave={workspace.saveDailyCareLog} isAr={isAr} />}
       {modalState.type === 'clinical' && <ClinicalScheduleModal initialData={modalState.data} horseId={modalState.horseId} onClose={close} onSave={workspace.saveClinicalSchedule} isAr={isAr} />}
       {modalState.type === 'observation' && <ObservationModal horseId={modalState.horseId} onClose={close} onSave={workspace.recordObservation} isAr={isAr} />}
       {modalState.type === 'incident' && <IncidentModal horseId={modalState.horseId} protocols={w?.protocols || []} onClose={close} onSave={workspace.recordIncident} isAr={isAr} />}
       {modalState.type === 'protocol' && <ProtocolModal initialData={modalState.data} onClose={close} onSave={workspace.saveProtocol} isAr={isAr} />}
       {modalState.type === 'inspection' && <InspectionModal initialData={modalState.data} onClose={close} onSave={workspace.saveInspection} isAr={isAr} />}
       {modalState.type === 'maintenance' && <MaintenanceModal initialData={modalState.data} inspections={w?.inspections || []} onClose={close} onSave={workspace.saveMaintenance} isAr={isAr} />}
       {modalState.type === 'alert' && <AlertModal horseId={modalState.horseId} onClose={close} onSave={workspace.createAlert} isAr={isAr} />}
    </div>
  );
}
