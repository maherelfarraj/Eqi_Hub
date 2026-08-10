import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface UserRole {
  role_name: string;
  branch_id: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: UserRole[];
  ready: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signUpWithInvitation: (email: string, password: string, fullName: string, token: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  hasRole: (roleName: string) => boolean;
  isStaff: () => boolean;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [ready, setReady] = useState(false);

  const fetchRoles = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role_id, branch_id, roles(name)')
      .eq('user_id', userId);

    if (data) {
      setRoles(
        data.map((r: any) => ({
          role_name: r.roles.name,
          branch_id: r.branch_id,
        }))
      );
    }
  }, []);

  const refreshRoles = useCallback(async () => {
    if (user) await fetchRoles(user.id);
  }, [user, fetchRoles]);

  useEffect(() => {
    let ignore = false;
    let initialized = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!initialized) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setReady(false);
        fetchRoles(s.user.id).then(() => { if (!ignore) setReady(true); });
      } else {
        setRoles([]);
        setReady(true);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (ignore) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        await fetchRoles(s.user.id);
      }
      initialized = true;
      if (!ignore) setReady(true);
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, [fetchRoles]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return { error: error?.message ?? null };
  };

  const signUpWithInvitation = async (email: string, password: string, fullName: string, token: string) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const res = await fetch(`${supabaseUrl}/functions/v1/accept-invitation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name: fullName, token }),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      return { error: data.error || 'Registration failed' };
    }

    if (data.session) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      if (sessionError) {
        return { error: sessionError.message ?? null };
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRoles([]);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error: error?.message ?? null };
  };

  const hasRole = (roleName: string) => roles.some((r) => r.role_name === roleName);

  const isStaff = () =>
    roles.some((r) =>
      ['owner', 'school_manager', 'receptionist', 'instructor', 'stable_manager', 'groom', 'veterinarian', 'accountant'].includes(r.role_name)
    );

  return (
    <AuthContext.Provider value={{ user, session, roles, ready, signIn, signUp, signUpWithInvitation, signOut, resetPassword, hasRole, isStaff, refreshRoles }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
