import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  PAYMENT_SERVICE_PENDING,
  paymentServicePendingError,
} from "@/lib/commercial-actions";
import type { CheckoutInfo, NewPaymentMethodInput, PaymentMethod, QueryState } from "./types";
import { useQuery, requireUserId, cents, scopeByOrganization } from "./_shared";

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
    void input;
    await Promise.resolve();
    setError(PAYMENT_SERVICE_PENDING);
    setSaving(false);
    return false;
  }, []);

  const setDefault = useCallback(async (id: string) => {
    void id;
    setError(PAYMENT_SERVICE_PENDING);
  }, []);

  const remove = useCallback(async (id: string) => {
    void id;
    setError(PAYMENT_SERVICE_PENDING);
  }, []);

  return { add, setDefault, remove, saving, error };
}

export function useCheckout(
  planId: string | null,
): QueryState<CheckoutInfo | null> & {
  applyPromo: (code: string) => Promise<boolean>;
  pay: (paymentMethodId: string) => Promise<string | null>; // returns membership id
} {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;
  const [promo, setPromo] = useState<CheckoutInfo["appliedPromo"]>(null);

  const query = useQuery<CheckoutInfo | null>(async () => {
    if (!planId) return null;
    const { data: p, error } = await scopeByOrganization(
      supabase.from("membership_plans").select("*").eq("id", planId),
      organizationId,
    ).single();
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
  }, [planId, promo, organizationId]);

  const applyPromo = useCallback(async (code: string) => {
    void code;
    return false;
  }, []);

  const pay = useCallback(
    async (paymentMethodId: string) => {
      void paymentMethodId;
      void planId;
      throw paymentServicePendingError();
    },
    [planId],
  );

  return { ...query, applyPromo, pay };
}
