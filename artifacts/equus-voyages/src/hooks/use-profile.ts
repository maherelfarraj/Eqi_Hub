import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { NotificationPrefs, Profile, QueryState } from "./types";
import { useQuery, requireUserId, cents } from "./_shared";

export function useProfile(): QueryState<Profile | null> & {
  refetch: () => void;
} {
  return useQuery<Profile | null>(async () => {
    const uid = await requireUserId();
    const { data: p, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .single();
    if (error) throw error;
    return {
      fullName: p.full_name ?? "",
      email: p.email ?? "",
      phone: p.phone,
      avatarUrl: p.avatar_url,
      role: p.role,
      discipline: p.discipline,
      skillLevel: p.skill_level,
      goals: p.goals,
      locale: p.locale,
      joinedAt: p.created_at,
    };
  });
}

export function useUpdateProfile() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(
    async (
      patch: Partial<{
        fullName: string;
        phone: string;
        discipline: string;
        skillLevel: string;
        goals: string;
        locale: string;
        avatar: File;
      }>,
    ) => {
      setSaving(true);
      setError(null);
      try {
        const uid = await requireUserId();
        const row: any = {};
        if (patch.fullName !== undefined) row.full_name = patch.fullName;
        if (patch.phone !== undefined) row.phone = patch.phone;
        if (patch.discipline !== undefined) row.discipline = patch.discipline;
        if (patch.skillLevel !== undefined) row.skill_level = patch.skillLevel;
        if (patch.goals !== undefined) row.goals = patch.goals;
        if (patch.locale !== undefined) row.locale = patch.locale;

        if (patch.avatar) {
          const ext = patch.avatar.name.split(".").pop() ?? "jpg";
          const path = `${uid}/avatar.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("avatars")
            .upload(path, patch.avatar, { upsert: true });
          if (upErr) throw upErr;
          row.avatar_url = supabase.storage
            .from("avatars")
            .getPublicUrl(path).data.publicUrl;
        }

        const { error: err } = await supabase
          .from("profiles")
          .update(row)
          .eq("id", uid);
        if (err) throw err;
        return true;
      } catch (e: any) {
        setError(e?.message ?? "Update failed");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  return { update, saving, error };
}

export function useNotificationPrefs(): QueryState<NotificationPrefs | null> {
  return useQuery<NotificationPrefs | null>(async () => {
    const uid = await requireUserId();
    const { data: p, error } = await supabase
      .from("notification_prefs")
      .select("*")
      .eq("user_id", uid)
      .single();
    if (error) throw error;
    return {
      lessonReminders: p.lesson_reminders,
      analysisReady: p.analysis_ready,
      paymentReceipts: p.payment_receipts,
      marketing: p.marketing,
      channel: p.channel,
    };
  });
}

export function useUpdateNotificationPrefs() {
  const [saving, setSaving] = useState(false);

  const update = useCallback(async (patch: Partial<NotificationPrefs>) => {
    setSaving(true);
    try {
      const uid = await requireUserId();
      const row: any = {};
      if (patch.lessonReminders !== undefined)
        row.lesson_reminders = patch.lessonReminders;
      if (patch.analysisReady !== undefined)
        row.analysis_ready = patch.analysisReady;
      if (patch.paymentReceipts !== undefined)
        row.payment_receipts = patch.paymentReceipts;
      if (patch.marketing !== undefined) row.marketing = patch.marketing;
      if (patch.channel !== undefined) row.channel = patch.channel;
      const { error } = await supabase
        .from("notification_prefs")
        .update(row)
        .eq("user_id", uid);
      if (error) throw error;
      return true;
    } finally {
      setSaving(false);
    }
  }, []);

  return { update, saving };
}
