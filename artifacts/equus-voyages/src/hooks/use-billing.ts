import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Invoice, InvoiceDetail, QueryState } from "./types";
import { useQuery, requireUserId, cents } from "./_shared";

const mapInvoice = (i: any): Invoice => ({
  id: i.id,
  number: i.number,
  issueDate: i.issue_date,
  dueDate: i.due_date,
  description: i.description,
  amount: cents(i.total_cents),
  currency: i.currency,
  status: i.status,
  pdfUrl: i.pdf_url,
});

export function useInvoices(): QueryState<Invoice[]> {
  return useQuery<Invoice[]>(async () => {
    const uid = await requireUserId();
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("user_id", uid)
      .order("issue_date", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapInvoice);
  });
}

export function useInvoice(
  id: string | undefined,
): QueryState<InvoiceDetail | null> {
  return useQuery<InvoiceDetail | null>(async () => {
    if (!id) return null;
    const { data: i, error } = await supabase
      .from("invoices")
      .select(
        "*, lines:invoice_lines(*), payment_method:payment_methods(last4)",
      )
      .eq("id", id)
      .single();
    if (error) throw error;
    return {
      ...mapInvoice(i),
      lines: ((i as any).lines ?? []).map((l: any) => ({
        id: l.id,
        label: l.label,
        qty: Number(l.qty),
        unitPrice: cents(l.unit_price_cents),
        total: cents(l.total_cents),
      })),
      subtotal: cents(i.subtotal_cents),
      tax: cents(i.tax_cents),
      total: cents(i.total_cents),
      paymentMethodLast4: (i as any).payment_method?.last4 ?? null,
    };
  }, [id]);
}
