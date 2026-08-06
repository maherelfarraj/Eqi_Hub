export type RidingLevel = 'beginner' | 'novice' | 'intermediate' | 'advanced' | 'competition';
export type RiderGender = 'male' | 'female' | 'other';
export type MembershipStatus = 'active' | 'suspended' | 'expired' | 'pending';
export type RiderStatus = 'active' | 'inactive' | 'archived';
export type NoteVisibility = 'staff_only' | 'shared';
export type GuardianRelationship = 'father' | 'mother' | 'legal_guardian' | 'grandparent' | 'other';

export interface Member {
  id: string;
  profile_id: string | null;
  member_number: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  membership_status: MembershipStatus;
  branch_id: string | null;
}

export interface Rider {
  id: string;
  member_id: string;
  full_name: string;
  date_of_birth: string;
  gender: RiderGender;
  riding_level: RidingLevel;
  preferred_discipline: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  goals: string | null;
  photo_url: string | null;
  status: RiderStatus;
  is_junior: boolean;
  member?: Pick<Member, 'id' | 'full_name' | 'member_number' | 'email' | 'phone' | 'membership_status' | 'branch_id'>;
}

export interface GuardianRider {
  id: string;
  guardian_member_id: string;
  rider_id: string;
  relationship: GuardianRelationship;
  guardian?: Pick<Member, 'full_name' | 'member_number' | 'email' | 'phone'>;
}

export interface EmergencyContact {
  id?: string;
  rider_id?: string;
  name: string;
  relationship: string;
  phone: string;
  priority?: number;
}

export interface RiderMedical {
  id?: string;
  rider_id?: string;
  conditions: string | null;
  allergies: string | null;
  accessibility_requirements: string | null;
  notes: string | null;
}

export interface RiderNote {
  id: string;
  rider_id: string;
  author_id: string;
  note: string;
  visibility: NoteVisibility;
  created_at: string;
  updated_at: string;
}

export const RIDING_LEVELS: RidingLevel[] = ['beginner', 'novice', 'intermediate', 'advanced', 'competition'];
export const RIDER_GENDERS: RiderGender[] = ['male', 'female', 'other'];
export const RIDER_STATUSES: RiderStatus[] = ['active', 'inactive', 'archived'];
export const GUARDIAN_RELATIONSHIPS: GuardianRelationship[] = ['father', 'mother', 'legal_guardian', 'grandparent', 'other'];

export function levelLabel(level: string): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

export function ageGroupLabel(isJunior: boolean): string {
  return isJunior ? 'Junior' : 'Adult';
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
