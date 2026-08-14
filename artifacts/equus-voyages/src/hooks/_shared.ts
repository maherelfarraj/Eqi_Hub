import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { QueryState } from "./types";

export async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Not signed in");
  return data.user.id;
}

export function scopeByOrganization<T>(
  query: T,
  organizationId: string | null,
): T {
  const scopedQuery = query as T & {
    eq: (column: string, value: string) => T;
    is: (column: string, value: null) => T;
  };

  return organizationId
    ? scopedQuery.eq("organization_id", organizationId)
    : scopedQuery.is("organization_id", null);
}

export function requireOrganizationId(organizationId: string | null): string {
  if (!organizationId) {
    throw new Error("Select an organization before creating tenant data");
  }
  return organizationId;
}

export async function resolveAccessibleRiderIds(
  userId: string,
  organizationId: string | null,
): Promise<string[]> {
  if (!organizationId) return [userId];

  const [guardianLinks, coachAssignments] = await Promise.all([
    supabase
      .from("guardian_riders")
      .select("rider_id")
      .eq("organization_id", organizationId)
      .eq("guardian_id", userId)
      .eq("active", true),
    supabase
      .from("coach_rider_assignments")
      .select("rider_id")
      .eq("organization_id", organizationId)
      .eq("coach_id", userId)
      .eq("active", true),
  ]);

  if (guardianLinks.error) throw guardianLinks.error;
  if (coachAssignments.error) throw coachAssignments.error;

  return Array.from(
    new Set([
      userId,
      ...(guardianLinks.data ?? []).map((link) => link.rider_id),
      ...(coachAssignments.data ?? []).map((assignment) => assignment.rider_id),
    ]),
  );
}

/** Generic async loader → { data, loading, error, refetch } */
export function useQuery<T>(
  fn: () => Promise<T>,
  deps: unknown[] = [],
): QueryState<T> & { refetch: () => void } {
  const [data, setData] = useState<T>(null as T);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fn());
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);
  return { data, loading, error, refetch: run };
}

export const cents = (c: number | null | undefined) => (c ?? 0) / 100;
