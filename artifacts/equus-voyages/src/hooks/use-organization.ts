import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useQuery } from "./_shared";

export interface OrganizationMember {
  membershipId: string;
  userId: string;
  email: string;
  fullName: string;
  status: "active" | "suspended" | "left";
  roles: string[];
  joinedAt: string | null;
}

interface OrganizationMemberRow {
  membership_id: string;
  user_id: string;
  email: string;
  full_name: string;
  status: OrganizationMember["status"];
  roles: string[] | null;
  joined_at: string | null;
}

export function useOrganizationMembers(organizationId: string | undefined) {
  return useQuery<OrganizationMember[]>(async () => {
    if (!organizationId) return [];

    const { data, error } = await supabase.rpc("get_organization_members", {
      p_organization_id: organizationId,
    });
    if (error) throw error;

    return ((data ?? []) as OrganizationMemberRow[]).map((member) => ({
      membershipId: member.membership_id,
      userId: member.user_id,
      email: member.email,
      fullName: member.full_name,
      status: member.status,
      roles: member.roles ?? [],
      joinedAt: member.joined_at,
    }));
  }, [organizationId]);
}

export function useOrganizationActions() {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async <T>(
    action: () => PromiseLike<{
      data: T | null;
      error: { message: string } | null;
    }>,
  ) => {
    setWorking(true);
    setError(null);
    try {
      const result = await action();
      if (result.error) throw result.error;
      return true;
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Organization request failed";
      setError(message);
      return false;
    } finally {
      setWorking(false);
    }
  };

  const createOrganization = (input: {
    name: string;
    slug: string;
    organizationType: string;
  }) =>
    run(() =>
      supabase.rpc("create_organization", {
        p_name: input.name,
        p_slug: input.slug,
        p_organization_type: input.organizationType,
      }),
    );

  const manageMember = (input: {
    organizationId: string;
    email: string;
    status: OrganizationMember["status"];
    roles: string[];
  }) =>
    run(() =>
      supabase.rpc("manage_organization_member", {
        p_organization_id: input.organizationId,
        p_email: input.email,
        p_status: input.status,
        p_roles: input.roles,
      }),
    );

  const updateName = (organizationId: string, name: string) =>
    run(() =>
      supabase.rpc("update_organization_name", {
        p_organization_id: organizationId,
        p_name: name,
      }),
    );

  return { createOrganization, manageMember, updateName, working, error };
}
