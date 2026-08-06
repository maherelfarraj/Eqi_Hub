import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Rider, EmergencyContact } from '@/types/rider';
import { levelLabel, formatDate } from '@/types/rider';
import { ArrowLeft, Plus, Trash2, ShieldAlert, Users } from 'lucide-react';

export default function ParentPortalPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [savingContacts, setSavingContacts] = useState(false);

  const fetchRiders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');

    const { data: member } = await supabase.from('members').select('id').eq('profile_id', user.id).is('deleted_at', null).maybeSingle();
    if (!member) { setError('No member record linked to your account. Please contact the school.'); setLoading(false); return; }

    const { data: guardianLinks } = await supabase.from('guardian_riders').select('rider_id').eq('guardian_member_id', member.id).is('deleted_at', null);
    if (!guardianLinks || guardianLinks.length === 0) { setRiders([]); setLoading(false); return; }

    const riderIds = guardianLinks.map((gl: { rider_id: string }) => gl.rider_id);
    const { data: riderData, error: rErr } = await supabase
      .from('riders')
      .select('id, member_id, full_name, date_of_birth, gender, riding_level, preferred_discipline, height_cm, weight_kg, goals, photo_url, status, is_junior')
      .in('id', riderIds)
      .is('deleted_at', null)
      .order('full_name');

    if (rErr) { setError(rErr.message); } else { setRiders((riderData || []) as unknown as Rider[]); }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchRiders(); }, [fetchRiders]);

  const fetchContacts = useCallback(async (riderId: string) => {
    const { data } = await supabase.from('emergency_contacts').select('*').eq('rider_id', riderId).is('deleted_at', null).order('priority');
    setEmergencyContacts((data || []) as unknown as EmergencyContact[]);
  }, []);

  const handleSelectRider = (rider: Rider) => { setSelectedRider(rider); fetchContacts(rider.id); };

  const handleSaveContacts = async () => {
    if (!selectedRider) return;
    setSavingContacts(true);
    await supabase.from('emergency_contacts').delete().eq('rider_id', selectedRider.id);
    if (emergencyContacts.length > 0) {
      await supabase.from('emergency_contacts').insert(emergencyContacts.map((c, i) => ({ rider_id: selectedRider.id, name: c.name, relationship: c.relationship, phone: c.phone, priority: i })));
    }
    setSavingContacts(false);
  };

  if (loading) {
    return (<div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" /></div>);
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-6 h-6 text-primary-600" />
        <h1 className="text-2xl font-bold text-gray-900">My Children</h1>
      </div>

      {error && (<div className="mb-4 p-3 rounded-lg bg-error-50 text-error-700 text-sm">{error}</div>)}

      {riders.length === 0 ? (
        <div className="bg-white rounded-xl border border-cream-200 p-8 text-center">
          <p className="text-gray-500">No riders are linked to your account. Please contact the school to be linked.</p>
        </div>
      ) : !selectedRider ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {riders.map((rider) => (
            <button key={rider.id} onClick={() => handleSelectRider(rider)} className="bg-white rounded-xl border border-cream-200 p-4 text-start hover:border-primary-300 hover:shadow-md transition-all">
              <div className="flex items-start gap-3">
                {rider.photo_url ? (
                  <img src={rider.photo_url} alt={rider.full_name} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-primary-700 text-sm font-medium">{rider.full_name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{rider.full_name}</h3>
                  <p className="text-xs text-gray-500">{formatDate(rider.date_of_birth)}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700">{levelLabel(rider.riding_level)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rider.is_junior ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{rider.is_junior ? 'Junior' : 'Adult'}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div>
          <button onClick={() => setSelectedRider(null)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to my children
          </button>

          <div className="flex items-start gap-4 mb-6">
            {selectedRider.photo_url ? (
              <img src={selectedRider.photo_url} alt={selectedRider.full_name} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-primary-700 text-xl font-medium">{selectedRider.full_name.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-gray-900">{selectedRider.full_name}</h2>
              <div className="flex flex-wrap gap-2 mt-1">
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700">{levelLabel(selectedRider.riding_level)}</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{selectedRider.status}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-cream-200 p-6 mb-4 space-y-2">
            <h3 className="font-semibold text-gray-900 mb-2">Rider Profile</h3>
            <div className="text-sm"><span className="text-gray-500">Date of Birth:</span> <span className="font-medium text-gray-900">{formatDate(selectedRider.date_of_birth)}</span></div>
            <div className="text-sm"><span className="text-gray-500">Gender:</span> <span className="font-medium text-gray-900 capitalize">{selectedRider.gender}</span></div>
            <div className="text-sm"><span className="text-gray-500">Riding Level:</span> <span className="font-medium text-gray-900">{levelLabel(selectedRider.riding_level)}</span></div>
            {selectedRider.preferred_discipline && <div className="text-sm"><span className="text-gray-500">Discipline:</span> <span className="font-medium text-gray-900">{selectedRider.preferred_discipline}</span></div>}
            {selectedRider.goals && <div className="text-sm"><span className="text-gray-500">Goals:</span> <span className="font-medium text-gray-900">{selectedRider.goals}</span></div>}
            <p className="text-xs text-gray-400 mt-2">Riding level and staff notes are managed by school staff. Contact the school to request changes.</p>
          </div>

          <div className="bg-white rounded-xl border border-cream-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-primary-600" />
                <h3 className="font-semibold text-gray-900">Emergency Contacts</h3>
              </div>
              <button onClick={() => setEmergencyContacts([...emergencyContacts, { name: '', relationship: '', phone: '' }])} className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
            {emergencyContacts.length === 0 && <p className="text-sm text-gray-500">No emergency contacts on file.</p>}
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
            {emergencyContacts.length > 0 && (
              <button onClick={handleSaveContacts} disabled={savingContacts} className="px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors">
                {savingContacts ? t('common.loading') : t('common.save')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
