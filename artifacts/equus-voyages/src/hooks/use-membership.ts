import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { CurrentMembership, MembershipPlan, QueryState } from "./types";
import { useQuery, requireUserId, cents } from "./_shared";

const mapPlan = (p: any): MembershipPlan => ({
  id: p.id,
  name: p.name,
  price: cents(p.price_cents),
  currency: p.currency,
  interval: p.interval,
  features: (p.features as string[]) ?? [],
  lessonsPerMonth: p.lessons_per_month,
  analysesPerMonth: p.analyses_per_month,
  highlighted: p.highlighted,
});

export function useMembershipPlans(): QueryState<MembershipPlan[]> {
  return useQuery<MembershipPlan[]>(async () => {
    const { data, error } = await supabase
      .from("membership_plans")
      .select("*")
      .eq("active", true)
      .order("sort_order");
    if (error) throw error;
    return (data ?? []).map(mapPlan);
  });
}

export function useCurrentMembership(): QueryState<CurrentMembership | null> & {
  refetch: () => void;
} {
  return useQuery<CurrentMembership | null>(async () => {
    const uid = await requireUserId();
    const { data: m, error } = await supabase
      .from("memberships")
      .select(
        "status, renews_at, lessons_used, analyses_used, plan:membership_plans(name, lessons_per_month, analyses_per_month)",
      )
      .eq("user_id", uid)
      .in("status", ["trialing", "active", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!m) return null;
    const plan = (m as any).plan;
    return {
      planName: plan?.name ?? "Plan",
      status: m.status,
      renewsAt: m.renews_at,
      lessonsUsed: m.lessons_used,
      lessonsAllowed: plan?.lessons_per_month ?? 0,
      analysesUsed: m.analyses_used,
      analysesAllowed: plan?.analyses_per_month ?? 0,
    };
  });
}

export function useManageMembership() {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (fn: () => PromiseLike<{ error: any }>) => {
    setWorking(true);
    setError(null);
    try {
      const { error: err } = await fn();
      if (err) throw err;
      return true;
    } catch (e: any) {
      setError(e?.message ?? "Action failed");
      return false;
    } finally {
      setWorking(false);
    }
  }, []);

  /** Call AFTER successful payment (see useCheckout). */
  const subscribe = useCallback(
    (planId: string) =>
      run(async () => {
        const uid = await requireUserId();
        const renews = new Date();
        renews.setMonth(renews.getMonth() + 1);
        return supabase.from("memberships").insert({
          user_id: uid,
          plan_id: planId,
          status: "active",
          renews_at: renews.toISOString(),
        });
      }),
    [run],
  );

  const upgrade = useCallback(
    (planId: string) =>
      run(async () => {
        const uid = await requireUserId();
        const { data: current } = await supabase
          .from("memberships")
          .select("id")
          .eq("user_id", uid)
          .in("status", ["trialing", "active", "past_due"])
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        return supabase
          .from("memberships")
          .update({ plan_id: planId, status: "active" })
          .eq("id", current!.id);
      }),
    [run],
  );

  const cancel = useCallback(
    () =>
      run(async () => {
        const uid = await requireUserId();
        return supabase
          .from("memberships")
          .update({ status: "cancelled" })
          .eq("user_id", uid)
          .in("status", ["trialing", "active", "past_due"]);
      }),
    [run],
  );

  return { subscribe, upgrade, cancel, working, error };
}
