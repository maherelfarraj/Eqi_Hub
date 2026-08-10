import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Rider, GuardianRider, EmergencyContact, RiderMedical, RiderNote } from '@/types/rider';
import { levelLabel, formatDate } from '@/types/rider';
import {
  ArrowLeft, User, Phone, Heart, ShieldAlert, FileText, ClipboardList,
  Calendar, Ruler, Weight, Target, Plus, Trash2, Lock, Link2, CheckCircle2, AlertCircle,
} from 'lucide-react';

type Tab = 'profile' | 'guardians' | 'medical' | 'notes' | 'history';

export default function RiderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  const [rider, setRider] = useState<Rider | null>(null);
  const [guardians, setGuardians] = useState<GuardianRider[]>([]);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [medical, setMedical] = useState<RiderMedical | null>(null);
  const [notes, setNotes] = useState<RiderNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  const canReadMedical = hasRole('owner') || hasRole('school_manager') || hasRole('veterinarian') || hasRole('instructor');
  const canWriteMedical = hasRole('owner') || hasRole('school_manager') || hasRole('veterinarian');
  const canWriteRider = hasRole('owner') || hasRole('school_manager') || hasRole('receptionist');
  const canWriteNotes = hasRole('owner') || hasRole('school_manager') || hasRole('instructor');

  const [newNote, setNewNote] = useState('');
  const [noteVisibility, setNoteVisibility] = useState<'staff_only' | 'shared'>('staff_only');
  const [savingNote, setSavingNote] = useState(false);
  const [medicalDraft, setMedicalDraft] = useState<RiderMedical>({ conditions: '', allergies: '', accessibility_requirements: '', notes: '' });
  const [savingMedical, setSavingMedical] = useState(false);
  const [linkingMemberId, setLinkingMemberId] = useState<string | null>(null);
  const [linkEmail, setLinkEmail] = useState('');
  const [linkError, setLinkError] = useState('');
  const [linkSuccess, setLinkSuccess] = useState('');

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');

    const { data: r, error: rErr } = await supabase
      .from('riders')
      .select('*, member:member_id(id, full_name, member_number, email, phone, membership_status, branch_id)')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (rErr || !r) {
      setError(rErr?.message || 'Rider not found');
      setLoading(false);
      return;
    }
    setRider(r as unknown as Rider);

    const [{ data: g }, { data: ec }] = await Promise.all([
      supabase.from('guardian_riders').select('*, guardian:guardian_member_id(full_name, member_number, email, phone, profile_id)').eq('rider_id', id).is('deleted_at', null),
      supabase.from('emergency_contacts').select('*').eq('rider_id', id).is('deleted_at', null).order('priority'),
    ]);
    setGuardians((g || []) as unknown as GuardianRider[]);
    setEmergencyContacts((ec || []) as unknown as EmergencyContact[]);

    if (canReadMedical) {
      const { data: med } = await supabase.from('rider_medical').select('*').eq('rider_id', id).maybeSingle();
      setMedical(med as unknown as RiderMedical | null);
      if (med) setMedicalDraft(med as unknown as RiderMedical);
    }

    const { data: ns } = await supabase
      .from('rider_notes')
      .select('id, rider_id, author_id, note, visibility, created_at, updated_at')
      .eq('rider_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    setNotes((ns || []) as unknown as RiderNote[]);

    setLoading(false);
  }, [id, canReadMedical]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSaveNote = async () => {
    if (!id || !newNote.trim() || !canWriteNotes) return;
    setSavingNote(true);
    const { error: err } = await supabase.from('rider_notes').insert({
      rider_id: id,
      note: newNote.trim(),
      visibility: noteVisibility,
    });
    if (err) {
      setError(err.message);
    } else {
      setNewNote('');
      fetchAll();
    }
    setSavingNote(false);
  };

  const handleDeleteNote = async (noteId: string) => {
    const { error: err } = await supabase.from('rider_notes').delete().eq('id', noteId);
    if (err) setError(err.message);
    else fetchAll();
  };

  const handleLinkProfile = async (memberId: string) => {
    setLinkError('');
    setLinkSuccess('');
    if (!linkEmail.trim()) {
      setLinkError('Enter the user\'s email address');
      return;
    }
    setLinkingMemberId(memberId);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/link-member-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.session?.access_token}` },
        body: JSON.stringify({ member_id: memberId, email: linkEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setLinkError(data.error || 'Failed to link profile');
      } else {
        setLinkSuccess('Profile linked successfully');
        setLinkEmail('');
        fetchAll();
      }
    } catch {
      setLinkError('Network error');
    }
    setLinkingMemberId(null);
  };

  const handleSaveMedical = async () => {
    if (!id || !canWriteMedical) return;
    setSavingMedical(true);
    const { error: err } = await supabase.from('rider_medical').upsert({
      rider_id: id,
      conditions: medicalDraft.conditions,
      allergies: medicalDraft.allergies,
      accessibility_requirements: medicalDraft.accessibility_requirements,
      notes: medicalDraft.notes,
    }, { onConflict: 'rider_id' });
    if (err) setError(err.message);
    else fetchAll();
    setSavingMedical(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !rider) {
    return (
      <div className="text-center py-12">
        <p className="text-error-600 mb-4">{error || 'Rider not found'}</p>
        <button onClick={() => navigate('/riders')} className="text-primary-600 hover:text-primary-700">Back to riders</button>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
    { key: 'guardians', label: 'Guardians & Emergency', icon: <ShieldAlert className="w-4 h-4" /> },
    ...(canReadMedical ? [{ key: 'medical' as Tab, label: 'Medical', icon: <Heart className="w-4 h-4" /> }] : []),
    ...(canWriteNotes || notes.length > 0 ? [{ key: 'notes' as Tab, label: 'Notes', icon: <FileText className="w-4 h-4" /> }] : []),
    { key: 'history', label: 'History', icon: <ClipboardList className="w-4 h-4" /> },
  ];

  return (
    <div>
      <button onClick={() => navigate('/riders')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to riders
      </button>

      <div className="flex items-start gap-4 mb-6">
        {rider.photo_url ? (
          <img src={rider.photo_url} alt={rider.full_name} className="w-16 h-16 rounded-full object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
            <span className="text-primary-700 text-xl font-medium">{rider.full_name.charAt(0).toUpperCase()}</span>
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{rider.full_name}</h1>
          <div className="flex flex-wrap gap-2 mt-1">
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700">{levelLabel(rider.riding_level)}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rider.is_junior ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
              {rider.is_junior ? 'Junior' : 'Adult'}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rider.status === 'active' ? 'bg-success-50 text-success-700' : 'bg-gray-100 text-gray-600'}`}>
              {rider.status}
            </span>
          </div>
        </div>
        {canWriteRider && (
          <button onClick={() => navigate(`/riders/${rider.id}/edit`)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-cream-50 transition-colors">
            {t('common.edit')}
          </button>
        )}
      </div>

      <div className="flex gap-1 border-b border-cream-200 mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key ? 'border-primary-500 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-cream-200 p-6 space-y-3">
            <h3 className="font-semibold text-gray-900 mb-2">Personal Information</h3>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">Date of Birth:</span>
              <span className="font-medium text-gray-900">{formatDate(rider.date_of_birth)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">Gender:</span>
              <span className="font-medium text-gray-900 capitalize">{rider.gender}</span>
            </div>
            {rider.height_cm && (
              <div className="flex items-center gap-2 text-sm">
                <Ruler className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">Height:</span>
                <span className="font-medium text-gray-900">{rider.height_cm} cm</span>
              </div>
            )}
            {rider.weight_kg && (
              <div className="flex items-center gap-2 text-sm">
                <Weight className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">Weight:</span>
                <span className="font-medium text-gray-900">{rider.weight_kg} kg</span>
              </div>
            )}
            {rider.preferred_discipline && (
              <div className="text-sm">
                <span className="text-gray-500">Preferred Discipline:</span>{' '}
                <span className="font-medium text-gray-900">{rider.preferred_discipline}</span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-cream-200 p-6 space-y-3">
            <h3 className="font-semibold text-gray-900 mb-2">Membership</h3>
            {rider.member && (
              <>
                <div className="text-sm">
                  <span className="text-gray-500">Member Number:</span>{' '}
                  <span className="font-medium text-gray-900">{rider.member.member_number}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-500">Member Name:</span>{' '}
                  <span className="font-medium text-gray-900">{rider.member.full_name}</span>
                </div>
                {rider.member.email && (
                  <div className="text-sm">
                    <span className="text-gray-500">Email:</span>{' '}
                    <span className="font-medium text-gray-900">{rider.member.email}</span>
                  </div>
                )}
                {rider.member.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-500">Phone:</span>
                    <span className="font-medium text-gray-900">{rider.member.phone}</span>
                  </div>
                )}
                <div className="text-sm">
                  <span className="text-gray-500">Membership Status:</span>{' '}
                  <span className="font-medium text-gray-900 capitalize">{rider.member.membership_status}</span>
                </div>
              </>
            )}
            {rider.goals && (
              <div className="pt-2 border-t border-cream-200">
                <div className="flex items-center gap-2 text-sm mb-1">
                  <Target className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-500">Goals:</span>
                </div>
                <p className="text-sm text-gray-700">{rider.goals}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'guardians' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-cream-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Guardians</h3>
            {guardians.length === 0 ? (
              <p className="text-sm text-gray-500">No guardians linked to this rider.</p>
            ) : (
              <div className="space-y-2">
                {guardians.map((g) => (
                  <div key={g.id} className="p-3 rounded-lg bg-cream-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{g.guardian?.full_name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500 capitalize">Relationship: {g.relationship.replace('_', ' ')}</p>
                        {g.guardian?.email && <p className="text-xs text-gray-500">{g.guardian.email}</p>}
                        {g.guardian?.phone && <p className="text-xs text-gray-500">{g.guardian.phone}</p>}
                      </div>
                      {g.guardian?.profile_id ? (
                        <span className="flex items-center gap-1 text-xs text-success-600 font-medium">
                          <CheckCircle2 className="w-4 h-4" /> Login linked
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                          <AlertCircle className="w-4 h-4" /> No login linked
                        </span>
                      )}
                    </div>
                    {canWriteRider && !g.guardian?.profile_id && (
                      <div className="flex gap-2 pt-2 border-t border-cream-200">
                        <input
                          type="email"
                          value={linkingMemberId === g.guardian_member_id ? linkEmail : ''}
                          onChange={(e) => { setLinkingMemberId(g.guardian_member_id); setLinkEmail(e.target.value); setLinkError(''); setLinkSuccess(''); }}
                          placeholder="User email to link..."
                          className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 text-xs outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <button
                          onClick={() => handleLinkProfile(g.guardian_member_id)}
                          disabled={linkingMemberId === g.guardian_member_id && !linkEmail.trim()}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary-500 text-white text-xs font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          <Link2 className="w-3 h-3" /> Link
                        </button>
                      </div>
                    )}
                    {linkingMemberId === g.guardian_member_id && linkError && (
                      <p className="text-xs text-error-600">{linkError}</p>
                    )}
                    {linkingMemberId === g.guardian_member_id && linkSuccess && (
                      <p className="text-xs text-success-600">{linkSuccess}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-cream-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Emergency Contacts</h3>
            {emergencyContacts.length === 0 ? (
              <p className="text-sm text-gray-500">No emergency contacts on file.</p>
            ) : (
              <div className="space-y-2">
                {emergencyContacts.map((ec) => (
                  <div key={ec.id} className="flex items-center gap-3 p-3 rounded-lg bg-cream-50">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{ec.name}</p>
                      <p className="text-xs text-gray-500">{ec.relationship} - {ec.phone}</p>
                    </div>
                    <span className="text-xs text-gray-400">Priority: {ec.priority}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'medical' && canReadMedical && (
        <div className="bg-white rounded-xl border border-cream-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-4 h-4 text-error-500" />
            <h3 className="font-semibold text-gray-900">Medical Information</h3>
            <span className="text-xs text-gray-400">Restricted access - audit logged</span>
          </div>
          {canWriteMedical ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Conditions</label>
                <textarea value={medicalDraft.conditions || ''} onChange={(e) => setMedicalDraft({ ...medicalDraft, conditions: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Allergies</label>
                <textarea value={medicalDraft.allergies || ''} onChange={(e) => setMedicalDraft({ ...medicalDraft, allergies: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Accessibility Requirements</label>
                <textarea value={medicalDraft.accessibility_requirements || ''} onChange={(e) => setMedicalDraft({ ...medicalDraft, accessibility_requirements: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={medicalDraft.notes || ''} onChange={(e) => setMedicalDraft({ ...medicalDraft, notes: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <button onClick={handleSaveMedical} disabled={savingMedical} className="px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors">
                {savingMedical ? t('common.loading') : t('common.save')}
              </button>
            </div>
          ) : medical ? (
            <div className="space-y-3 text-sm">
              {medical.conditions && <div><span className="text-gray-500">Conditions:</span> <span className="text-gray-900">{medical.conditions}</span></div>}
              {medical.allergies && <div><span className="text-gray-500">Allergies:</span> <span className="text-gray-900">{medical.allergies}</span></div>}
              {medical.accessibility_requirements && <div><span className="text-gray-500">Accessibility:</span> <span className="text-gray-900">{medical.accessibility_requirements}</span></div>}
              {medical.notes && <div><span className="text-gray-500">Notes:</span> <span className="text-gray-900">{medical.notes}</span></div>}
              {!medical.conditions && !medical.allergies && !medical.accessibility_requirements && !medical.notes && (
                <p className="text-gray-500">No medical information on file.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No medical information on file.</p>
          )}
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="space-y-4">
          {canWriteNotes && (
            <div className="bg-white rounded-xl border border-cream-200 p-4">
              <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Write a note..." rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary-500 mb-3" />
              <div className="flex items-center justify-between">
                <select value={noteVisibility} onChange={(e) => setNoteVisibility(e.target.value as 'staff_only' | 'shared')} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="staff_only">Staff only</option>
                  <option value="shared">Shared with rider/guardian</option>
                </select>
                <button onClick={handleSaveNote} disabled={savingNote || !newNote.trim()} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors">
                  <Plus className="w-4 h-4" /> Add Note
                </button>
              </div>
            </div>
          )}
          {notes.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No notes yet.</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="bg-white rounded-xl border border-cream-200 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${note.visibility === 'staff_only' ? 'bg-gray-100 text-gray-600' : 'bg-success-50 text-success-700'}`}>
                      {note.visibility === 'staff_only' ? 'Staff only' : 'Shared'}
                    </span>
                    <span className="text-xs text-gray-400">{formatDate(note.created_at)}</span>
                  </div>
                  {canWriteNotes && (
                    <button onClick={() => handleDeleteNote(note.id)} className="text-gray-400 hover:text-error-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-700">{note.note}</p>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-cream-200 p-6 text-center">
            <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <h3 className="font-medium text-gray-500">Lesson History</h3>
            <p className="text-sm text-gray-400 mt-1">Coming in a later phase</p>
          </div>
          <div className="bg-white rounded-xl border border-cream-200 p-6 text-center">
            <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <h3 className="font-medium text-gray-500">Payment History</h3>
            <p className="text-sm text-gray-400 mt-1">Coming in a later phase</p>
          </div>
        </div>
      )}
    </div>
  );
}
