import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface UserRole {
  role_name: string;
  branch_id: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: UserRole[];
  ready: boolean;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  hasRole: (roleName: string) => boolean;
  isStaff: () => boolean;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function authRedirectUrl(path: string) {
  const appBaseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
  return new URL(path, appBaseUrl).toString();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [ready, setReady] = useState(false);

  const fetchRoles = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data?.role) {
      setRoles([]);
      return;
    }

    setRoles([{ role_name: data.role, branch_id: null }]);
  }, []);

  const refreshRoles = useCallback(async () => {
    if (user) {
      await fetchRoles(user.id);
    } else {
      setRoles([]);
    }
  }, [fetchRoles, user]);

  useEffect(() => {
    let ignore = false;
    let initialized = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!initialized || ignore) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        setReady(false);
        void fetchRoles(nextSession.user.id).finally(() => {
          if (!ignore) setReady(true);
        });
      } else {
        setRoles([]);
        setReady(true);
      }
    });

    void supabase.auth.getSession().then(async ({ data }) => {
      if (ignore) return;

      const initialSession = data.session;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        await fetchRoles(initialSession.user.id);
      } else {
        setRoles([]);
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
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: authRedirectUrl("auth"),
      },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRoles([]);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authRedirectUrl("auth/update-password"),
    });
    return { error: error?.message ?? null };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  };

  const hasRole = (roleName: string) =>
    roles.some((role) => role.role_name === roleName);

  const isStaff = () =>
    roles.some((role) =>
      ["trainer", "owner", "admin"].includes(role.role_name),
    );

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        roles,
        ready,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
        hasRole,
        isStaff,
        refreshRoles,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
