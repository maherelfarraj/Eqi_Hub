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

export interface UserRole {
  role_name: string;
  branch_id: string | null;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  organizationType: string;
  roles: string[];
}

interface OrganizationMembershipRoleRow {
  organization_id: string;
  organizations:
    | {
        id: string;
        name: string;
        slug: string;
        organization_type: string;
        active: boolean;
      }
    | Array<{
        id: string;
        name: string;
        slug: string;
        organization_type: string;
        active: boolean;
      }>
    | null;
  organization_member_roles: Array<{ role: string }> | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: UserRole[];
  organizations: OrganizationSummary[];
  activeOrganization: OrganizationSummary | null;
  ready: boolean;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    inviteToken?: string,
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  hasRole: (roleName: string) => boolean;
  isStaff: () => boolean;
  setActiveOrganization: (organizationId: string) => void;
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
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [activeOrganizationId, setActiveOrganizationId] = useState<
    string | null
  >(null);
  const [ready, setReady] = useState(false);

  const fetchRoles = useCallback(async (userId: string) => {
    const [profileResult, platformResult, organizationResult] =
      await Promise.all([
        supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
        supabase
          .from("platform_role_assignments")
          .select("role")
          .eq("user_id", userId),
        supabase
          .from("organization_memberships")
          .select(
            "organization_id, organizations!organization_memberships_organization_id_fkey(id, name, slug, organization_type, active), organization_member_roles(role)",
          )
          .eq("user_id", userId)
          .eq("status", "active"),
      ]);

    const nextRoles: UserRole[] = [];

    // Keep the canonical v1 role during the additive tenancy transition.
    if (!profileResult.error && profileResult.data?.role) {
      nextRoles.push({
        role_name: profileResult.data.role,
        branch_id: null,
      });
    }

    if (!platformResult.error) {
      for (const assignment of platformResult.data ?? []) {
        if (assignment.role) {
          nextRoles.push({
            role_name: assignment.role,
            branch_id: null,
          });
        }
      }
    }

    const memberships = !organizationResult.error
      ? ((organizationResult.data ??
          []) as unknown as OrganizationMembershipRoleRow[])
      : [];

    for (const membership of memberships) {
      for (const memberRole of membership.organization_member_roles ?? []) {
        if (memberRole.role) {
          nextRoles.push({
            role_name: memberRole.role,
            branch_id: membership.organization_id,
          });
        }
      }
    }

    const uniqueRoles = Array.from(
      new Map(
        nextRoles.map((role) => [
          `${role.role_name}:${role.branch_id ?? "global"}`,
          role,
        ]),
      ).values(),
    );

    setRoles(uniqueRoles);

    const membershipOrganizations = memberships.flatMap((membership) => {
      const relation = Array.isArray(membership.organizations)
        ? membership.organizations[0]
        : membership.organizations;
      if (!relation?.active) return [];

      return [
        {
          id: relation.id,
          name: relation.name,
          slug: relation.slug,
          organizationType: relation.organization_type,
          roles: (membership.organization_member_roles ?? []).map(
            (memberRole) => memberRole.role,
          ),
        } satisfies OrganizationSummary,
      ];
    });

    let nextOrganizations = membershipOrganizations;
    const platformAdmin = uniqueRoles.some(
      (role) => role.role_name === "platform_admin" && role.branch_id === null,
    );

    if (platformAdmin) {
      const { data: allOrganizations, error: organizationError } =
        await supabase
          .from("organizations")
          .select("id, name, slug, organization_type, active")
          .eq("active", true)
          .order("name");

      if (!organizationError) {
        const membershipById = new Map(
          membershipOrganizations.map((organization) => [
            organization.id,
            organization,
          ]),
        );
        nextOrganizations = (allOrganizations ?? []).map((organization) => ({
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          organizationType: organization.organization_type,
          roles: membershipById.get(organization.id)?.roles ?? [],
        }));
      }
    }

    setOrganizations(nextOrganizations);
    setActiveOrganizationId((current) => {
      const storageKey = `equivista.active-organization.${userId}`;
      const stored = window.localStorage.getItem(storageKey);
      const candidate = stored ?? current;
      const nextId = nextOrganizations.some(
        (organization) => organization.id === candidate,
      )
        ? candidate
        : (nextOrganizations[0]?.id ?? null);

      if (nextId) window.localStorage.setItem(storageKey, nextId);
      else window.localStorage.removeItem(storageKey);
      return nextId;
    });
  }, []);

  const refreshRoles = useCallback(async () => {
    if (user) {
      await fetchRoles(user.id);
    } else {
      setRoles([]);
      setOrganizations([]);
      setActiveOrganizationId(null);
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
        setOrganizations([]);
        setActiveOrganizationId(null);
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
        setOrganizations([]);
        setActiveOrganizationId(null);
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

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    inviteToken?: string,
  ) => {
    const redirectPath = inviteToken
      ? `auth?invite=${encodeURIComponent(inviteToken)}`
      : "auth";
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: authRedirectUrl(redirectPath),
      },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    setSession(null);
    setUser(null);
    setRoles([]);
    setOrganizations([]);
    setActiveOrganizationId(null);
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
      [
        "trainer",
        "owner",
        "admin",
        "platform_admin",
        "academy_admin",
        "coach",
        "horse_owner",
        "stable_manager",
        "accountant",
        "competition_manager",
      ].includes(role.role_name),
    );

  const activeOrganization =
    organizations.find(
      (organization) => organization.id === activeOrganizationId,
    ) ?? null;

  const setActiveOrganization = (organizationId: string) => {
    if (
      !user ||
      !organizations.some((organization) => organization.id === organizationId)
    ) {
      return;
    }

    window.localStorage.setItem(
      `equivista.active-organization.${user.id}`,
      organizationId,
    );
    setActiveOrganizationId(organizationId);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        roles,
        organizations,
        activeOrganization,
        ready,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
        hasRole,
        isStaff,
        setActiveOrganization,
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
