import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { CheckoutInfo, NewPaymentMethodInput, PaymentMethod, QueryState } from "./types";
import { useQuery, requireUserId, cents } from "./_shared";

export function usePaymentMethods(): QueryState<PaymentMethod[]> & {
  refetch: () => void;
} {
  return useQuery<PaymentMethod[]>(async () => {
    const uid = await requireUserId();
    const { data, error } = await supabase
      .from("payment_methods")
      .select("id, brand, last4, exp_month, exp_year, is_default")
      .eq("user_id", uid)
      .order("is_default", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((p: any) => ({
      id: p.id,
      brand: p.brand,
      last4: p.last4,
      expMonth: p.exp_month,
      expYear: p.exp_year,
      isDefault: p.is_default,
    }));
  });
}

export function useAddPaymentMethod() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = useCallback(async (input: NewPaymentMethodInput) => {
    setSaving(true);
    setError(null);
    try {
      const uid = await requireUserId();
      const { count } = await supabase
        .from("payment_methods")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid);
      const { error: err } = await supabase.from("payment_methods").insert({
        user_id: uid,
        brand: input.brand,
        last4: input.last4,
        exp_month: input.expMonth,
        exp_year: input.expYear,
        provider_token: input.providerToken,
        is_default: (count ?? 0) === 0,
      });
      if (err) throw err;
      return true;
    } catch (e: any) {
      setError(e?.message ?? "Could not save card");
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const setDefault = useCallback(async (id: string) => {
    const uid = await requireUserId();
    await supabase
      .from("payment_methods")
      .update({ is_default: false })
      .eq("user_id", uid);
    await supabase
      .from("payment_methods")
      .update({ is_default: true })
      .eq("id", id);
  }, []);

  const remove = useCallback(async (id: string) => {
    await supabase.from("payment_methods").delete().eq("id", id);
  }, []);

  return { add, setDefault, remove, saving, error };
}

export function useCheckout(
  planId: string | null,
): QueryState<CheckoutInfo | null> & {
  applyPromo: (code: string) => Promise<boolean>;
  pay: (paymentMethodId: string) => Promise<string | null>; // returns membership id
} {
  const [promo, setPromo] = useState<CheckoutInfo["appliedPromo"]>(null);

  const query = useQuery<CheckoutInfo | null>(async () => {
    if (!planId) return null;
    const { data: p, error } = await supabase
      .from("membership_plans")
      .select("*")
      .eq("id", planId)
      .single();
    if (error) throw error;
    return {
      plan: {
        id: p.id,
        name: p.name,
        price: cents(p.price_cents),
        currency: p.currency,
        interval: p.interval,
      },
      appliedPromo: promo,
    };
  }, [planId, promo]);

  const applyPromo = useCallback(async (code: string) => {
    // TODO: validate against a promo_codes table or your payment provider
    setPromo({ code, discountPct: 0 });
    return true;
  }, []);

  const pay = useCallback(
    async (paymentMethodId: string) => {
      // TODO: charge via your payment provider (Stripe/Moyasar/HyperPay)
      // using paymentMethod.provider_token, THEN create membership + invoice.
      // The block below is the post-payment database flow:
      if (!planId) return null;
      const uid = await requireUserId();

      const { data: plan } = await supabase
        .from("membership_plans")
        .select("*")
        .eq("id", planId)
        .single();
      const renews = new Date();
      if (plan.interval === "year")
        renews.setFullYear(renews.getFullYear() + 1);
      else renews.setMonth(renews.getMonth() + 1);

      const { data: membership, error: mErr } = await supabase
        .from("memberships")
        .insert({
          user_id: uid,
          plan_id: planId,
          status: "active",
          renews_at: renews.toISOString(),
        })
        .select("id")
        .single();
      if (mErr) throw mErr;

      const { error: iErr } = await supabase.from("invoices").insert({
        user_id: uid,
        membership_id: membership.id,
        payment_method_id: paymentMethodId,
        description: `Membership — ${plan.name}`,
        status: "paid",
        currency: plan.currency,
        subtotal_cents: plan.price_cents,
        tax_cents: 0,
        total_cents: plan.price_cents,
        due_date: new Date().toISOString().slice(0, 10),
      });
      if (iErr) throw iErr;

      return membership.id as string;
    },
    [planId],
  );

  return { ...query, applyPromo, pay };
}
