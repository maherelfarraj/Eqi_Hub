import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { DocumentItem, Horse, HorseDetail, QueryState, UpsertHorseInput } from "./types";
import { useQuery, requireUserId, cents } from "./_shared";
import { mapAnalysis } from "./use-analysis";

const mapHorse = (h: any): Horse => ({
  id: h.id,
  name: h.name,
  breed: h.breed,
  birthYear: h.birth_year,
  color: h.color,
  heightCm: h.height_cm,
  photoUrl: h.photo_url,
  status: h.status,
  riderNames: (h.horse_riders ?? [])
    .map((hr: any) => hr.rider?.full_name)
    .filter(Boolean),
});

export function useHorses(): QueryState<Horse[]> & { refetch: () => void } {
  return useQuery<Horse[]>(async () => {
    await requireUserId();
    // RLS limits to owned + linked horses automatically
    const { data, error } = await supabase
      .from("horses")
      .select("*, horse_riders(rider:profiles(full_name))")
      .order("name");
    if (error) throw error;
    return (data ?? []).map(mapHorse);
  });
}

export function useHorse(
  id: string | undefined,
): QueryState<HorseDetail | null> {
  return useQuery<HorseDetail | null>(async () => {
    if (!id) return null;
    const [horseRes, logRes, healthRes, docsRes, analysesRes] =
      await Promise.all([
        supabase
          .from("horses")
          .select("*, horse_riders(rider:profiles(full_name))")
          .eq("id", id)
          .single(),
        supabase
          .from("training_log")
          .select("id, log_date, note, author:author_id(full_name)")
          .eq("horse_id", id)
          .order("log_date", { ascending: false }),
        supabase
          .from("health_records")
          .select("id, rec_date, rec_type, summary")
          .eq("horse_id", id)
          .order("rec_date", { ascending: false }),
        supabase.from("documents").select("id, name, url").eq("horse_id", id),
        supabase
          .from("video_analyses")
          .select(
            "id, title, discipline, status, score, thumbnail_url, created_at",
          )
          .eq("horse_id", id)
          .order("created_at", { ascending: false }),
      ]);
    if (horseRes.error) throw horseRes.error;

    const h = horseRes.data;
    return {
      ...mapHorse(h),
      trainingLog: (logRes.data ?? []).map((t: any) => ({
        id: t.id,
        date: t.log_date,
        note: t.note,
        author: t.author?.full_name ?? "Unknown",
      })),
      healthRecords: (healthRes.data ?? []).map((r: any) => ({
        id: r.id,
        date: r.rec_date,
        type: r.rec_type,
        summary: r.summary,
      })),
      documents: (docsRes.data ?? []) as DocumentItem[],
      analyses: (analysesRes.data ?? []).map((a: any) => ({
        ...mapAnalysis(a),
        horseName: h.name,
      })),
    };
  }, [id]);
}

export function useUpsertHorse() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upsert = useCallback(async (input: UpsertHorseInput) => {
    setSaving(true);
    setError(null);
    try {
      const uid = await requireUserId();
      let photoUrl: string | undefined;

      if (input.photo) {
        const ext = input.photo.name.split(".").pop() ?? "jpg";
        const path = `${uid}/horses/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("horse-photos")
          .upload(path, input.photo);
        if (upErr) throw upErr;
        photoUrl = supabase.storage.from("horse-photos").getPublicUrl(path)
          .data.publicUrl;
      }

      const row: any = {
        owner_id: uid,
        name: input.name,
        breed: input.breed ?? null,
        birth_year: input.birthYear ?? null,
        color: input.color ?? null,
        height_cm: input.heightCm ?? null,
        status: input.status ?? "active",
      };
      if (photoUrl) row.photo_url = photoUrl;

      const q = input.id
        ? supabase.from("horses").update(row).eq("id", input.id)
        : supabase.from("horses").insert(row);
      const { error: err } = await q;
      if (err) throw err;
      return true;
    } catch (e: any) {
      setError(e?.message ?? "Save failed");
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return { upsert, saving, error };
}
