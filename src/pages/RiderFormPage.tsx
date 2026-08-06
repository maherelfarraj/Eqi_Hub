import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import type { RidingLevel, RiderGender, RiderStatus, GuardianRelationship, Member, EmergencyContact } from '@/types/rider';
import { RIDING_LEVELS, RIDER_GENDERS, RIDER_STATUSES, GUARDIAN_RELATIONSHIPS, levelLabel } from '@/types/rider';
import { ArrowLeft, Plus, Trash2, AlertCircle } from 'lucide-react';

export default function RiderFormPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [fullName, setFullName] = useState('');
  const [memberId, setMemberId] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<RiderGender>('male');
  const [ridingLevel, setRidingLevel] = useState<RidingLevel>('beginner');
  const [preferredDiscipline, setPreferredDiscipline] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [goals, setGoals] = useState('');
  const [status, setStatus] = useState<RiderStatus>('active');

  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [guardianLinks, setGuardianLinks] = useState<{ guardian_member_id: string; relationship: GuardianRelationship }[]>([]);

  const [conditions, setConditions] = useState('');
  const [allergies, setAllergies] = useState('');
  const [accessibilityReqs, setAccessibilityReqs] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');

  useEffect(() => {
    (async () => {
      const { data: m } = await supabase.from('members').select('id, full_name, member_number, email, phone, membership_status, branch_id').is('deleted_at', null).order('full_name');
      setMembers((m || []) as unknown as Member[]);

      if (isEdit && id) {
        const { data: r } = await supabase.from('riders').select('*').eq('id', id).maybeSingle();
        if (r) {
          setFullName(r.full_name);
          setMemberId(r.member_id);
          setDateOfBirth(r.date_of_birth);
          setGender(r.gender);
          setRidingLevel(r.riding_level);
          setPreferredDiscipline(r.preferred_discipline || '');
          setHeightCm(r.height_cm?.toString() || '');
          setWeightKg(r.weight_kg?.toString() || '');
          setGoals(r.goals || '');
          setStatus(r.status);

          const { data: ec } = await supabase.from('emergency_contacts').select('*').eq('rider_id', id).order('priority');
          setEmergencyContacts((ec || []) as unknown as EmergencyContact[]);

          const { data: gl } = await supabase.from('guardian_riders').select('guardian_member_id, relationship').eq('rider_id', id);
          setGuardianLinks((gl || []) as unknown as { guardian_member_id: string; relationship: GuardianRelationship }[]);

          const { data: med } = await supabase.from('rider_medical').select('*').eq('rider_id', id).maybeSingle();
          if (med) {
            setConditions(med.conditions || '');
            setAllergies(med.allergies || '');
            setAccessibilityReqs(med.accessibility_requirements || '');
            setMedicalNotes(med.notes || '');
          }
        }
      }
      setLoading(false);
    })();
  }, [id, isEdit]);

  const handleSave = async () => {
    setError('');
    if (!memberId || !fullName.trim() || !dateOfBirth || !gender) {
      setError('Member, full name, date of birth, and gender are required');
      return;
    }

    const dob = new Date(dateOfBirth);
    const ageYears = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (ageYears < 0 || ageYears > 120) {
      setError('Date of birth is out of valid range');
      return;
    }
    if (ageYears < 18 && emergencyContacts.length === 0) {
      setError('Junior riders must have at least one emergency contact');
      return;
    }

    setSaving(true);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch(`${supabaseUrl}/functions/v1/upsert-rider`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.session?.access_token}` },
      body: JSON.stringify({
        rider_id: isEdit ? id : null,
        member_id: memberId,
        full_name: fullName.trim(),
        date_of_birth: dateOfBirth,
        gender,
        riding_level: ridingLevel,
        preferred_discipline: preferredDiscipline || null,
        height_cm: heightCm ? parseInt(heightCm) : null,
        weight_kg: weightKg ? parseInt(weightKg) : null,
        goals: goals || null,
        status,
        emergency_contacts: emergencyContacts.map((c, i) => ({ name: c.name, relationship: c.relationship, phone: c.phone, priority: i })),
        guardians: guardianLinks,
        medical: { conditions, allergies, accessibility_requirements: accessibilityReqs, notes: medicalNotes },
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      setError(data.error || 'Failed to save rider');
      setSaving(false);
      return;
    }
    navigate(`/riders/${data.rider_id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate(id ? `/riders/${id}` : '/riders')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">{isEdit ? 'Edit Rider' : 'Add Rider'}</h1>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-error-50 text-error-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-cream-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Basic Information</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Member *</label>
            <select value={memberId} onChange={(e) => setMemberId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">Select a member...</option>
              {members.map((m) => (<option key={m.id} value={m.id}>{m.full_name} ({m.member_number})</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
              <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
              <select value={gender} onChange={(e) => setGender(e.target.value as RiderGender)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary-500">
                {RIDER_GENDERS.map((g) => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Riding Level</label>
              <select value={ridingLevel} onChange={(e) => setRidingLevel(e.target.value as RidingLevel)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary-500">
                {RIDING_LEVELS.map((l) => <option key={l} value={l}>{levelLabel(l)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Discipline</label>
              <input type="text" value={preferredDiscipline} onChange={(e) => setPreferredDiscipline(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Height (cm)</label>
              <input type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} min={1} max={299} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
              <input type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} min={1} max={499} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as RiderStatus)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary-500">
              {RIDER_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Goals</label>
            <textarea value={goals} onChange={(e) => setGoals(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-cream-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Emergency Contacts</h3>
            <button onClick={() => setEmergencyContacts([...emergencyContacts, { name: '', relationship: '', phone: '' }])} className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          {emergencyContacts.length === 0 && <p className="text-sm text-gray-500">No emergency contacts added.</p>}
          {emergencyContacts.map((c, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <input type="text" placeholder="Name" value={c.name} onChange={(e) => { const n = [...emergencyContacts]; n[i] = { ...n[i], name: e.target.value }; setEmergencyContacts(n); }} className="px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
              <input type="text" placeholder="Relationship" value={c.relationship} onChange={(e) => { const n = [...emergencyContacts]; n[i] = { ...n[i], relationship: e.target.value }; setEmergencyContacts(n); }} className="px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
              <div className="flex gap-1">
                <input type="text" placeholder="Phone" value={c.phone} onChange={(e) => { const n = [...emergencyContacts]; n[i] = { ...n[i], phone: e.target.value }; setEmergencyContacts(n); }} className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
                <button onClick={() => setEmergencyContacts(emergencyContacts.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-error-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-cream-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Guardian Links</h3>
            <button onClick={() => setGuardianLinks([...guardianLinks, { guardian_member_id: '', relationship: 'other' }])} className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          {guardianLinks.length === 0 && <p className="text-sm text-gray-500">No guardians linked.</p>}
          {guardianLinks.map((gl, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <select value={gl.guardian_member_id} onChange={(e) => { const n = [...guardianLinks]; n[i] = { ...n[i], guardian_member_id: e.target.value }; setGuardianLinks(n); }} className="px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">Select guardian member...</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.full_name} ({m.member_number})</option>)}
              </select>
              <div className="flex gap-1">
                <select value={gl.relationship} onChange={(e) => { const n = [...guardianLinks]; n[i] = { ...n[i], relationship: e.target.value as GuardianRelationship }; setGuardianLinks(n); }} className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary-500">
                  {GUARDIAN_RELATIONSHIPS.map((r) => <option key={r} value={r}>{r.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                </select>
                <button onClick={() => setGuardianLinks(guardianLinks.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-error-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-cream-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Medical Information (Optional)</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Conditions</label>
            <textarea value={conditions} onChange={(e) => setConditions(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Allergies</label>
            <textarea value={allergies} onChange={(e) => setAllergies(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Accessibility Requirements</label>
            <textarea value={accessibilityReqs} onChange={(e) => setAccessibilityReqs(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Medical Notes</label>
            <textarea value={medicalNotes} onChange={(e) => setMedicalNotes(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 rounded-lg bg-primary-500 text-white font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors">
            {saving ? t('common.loading') : isEdit ? t('common.save') : t('common.create')}
          </button>
          <button onClick={() => navigate(id ? `/riders/${id}` : '/riders')} className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-600 font-medium hover:bg-cream-50 transition-colors">
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
