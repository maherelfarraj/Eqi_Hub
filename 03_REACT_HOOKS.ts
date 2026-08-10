// ============================================================
// EquiVista — 03_REACT_HOOKS.ts
// Split this file along the section markers into src/hooks/.
// Sections:
//   src/lib/supabase.ts            (client — see PART 0)
//   src/hooks/types.ts             (PART 1)
//   src/hooks/use-dashboard.ts     (PART 2)
//   src/hooks/use-progress.ts      (PART 3)
//   src/hooks/use-analysis.ts      (PART 4)
//   src/hooks/use-lessons.ts       (PART 5)
//   src/hooks/use-horses.ts        (PART 6)
//   src/hooks/use-membership.ts    (PART 7)
//   src/hooks/use-payments.ts      (PART 8)
//   src/hooks/use-billing.ts       (PART 9)
//   src/hooks/use-profile.ts       (PART 10)
// Dependency: @supabase/supabase-js  (npm i @supabase/supabase-js)
// ============================================================

// ════════════════════════════════════════════════════════════
// PART 0 — src/lib/supabase.ts
// ════════════════════════════════════════════════════════════
/*
import { createClient } from "@supabase/supabase-js";

// Next.js (v0.dev): NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
// Vite (Replit):    VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  (import.meta as any)?.env?.VITE_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(url!, anonKey!);
*/

// ════════════════════════════════════════════════════════════
// PART 1 — src/hooks/types.ts
// ════════════════════════════════════════════════════════════

export type Role = "rider" | "trainer" | "owner" | "admin";
export type LessonStatus = "pending" | "confirmed" | "completed" | "cancelled";
export type LessonType = "Flatwork" | "Jumping" | "Dressage" | "Groundwork";
export type Discipline = "Flatwork" | "Show jumping" | "Dressage";
export type AnalysisStatus = "uploaded" | "processing" | "analyzed" | "failed";
export type HorseStatus = "active" | "resting" | "retired";
export type MembershipStatus = "trialing" | "active" | "past_due" | "cancelled";
export type InvoiceStatus = "paid" | "open" | "overdue" | "void";

// ---- Dashboard ----
export interface UpcomingLesson {
  id: string;
  dateTime: string;
  trainerName: string;
  horseName: string | null;
  discipline: LessonType;
  status: LessonStatus;
}
export interface ActiveMembership {
  planName: string;
  status: MembershipStatus;
  renewsAt: string | null;
  lessonsUsed: number;
  lessonsAllowed: number;
  analysesUsed: number;
  analysesAllowed: number;
}
export interface RecentAnalysis {
  id: string;
  title: string;
  horseName: string | null;
  score: number | null;
  status: AnalysisStatus;
  createdAt: string;
}
export interface ProgressTrendPoint {
  date: string;
  score: number;
}
export interface DashboardSummary {
  user: { name: string; role: Role };
  upcomingLessons: UpcomingLesson[];
  activeMembership: ActiveMembership | null;
  recentAnalyses: RecentAnalysis[];
  outstandingBalance: {
    amount: number;
    currency: string;
    invoiceCount: number;
  };
  horsesCount: number;
  progressTrend: ProgressTrendPoint[];
}

// ---- Progress ----
export interface CategoryScore {
  category: string;
  score: number;
}
export interface ProgressMetrics {
  averageScore: number;
  improvementPct: number;
  sessionsCount: number;
  topDiscipline: string | null;
  scoreOverTime: ProgressTrendPoint[];
  categoryScores: CategoryScore[];
}
export interface SessionRow {
  id: string;
  date: string;
  horseName: string | null;
  discipline: Discipline;
  score: number | null;
  status: AnalysisStatus;
}

// ---- Analysis ----
export interface VideoAnalysisListItem {
  id: string;
  title: string;
  horseName: string | null;
  discipline: Discipline;
  status: AnalysisStatus;
  score: number | null;
  createdAt: string;
  thumbnailUrl: string | null;
}
export interface Metric {
  category: string;
  score: number;
}
export interface AIFeedback {
  strengths: string[];
  improvements: string[];
}
export interface TrainerComment {
  author: string;
  text: string;
  created_at: string;
}
export interface VideoAnalysisDetail extends VideoAnalysisListItem {
  videoUrl: string | null;
  metrics: Metric[];
  aiFeedback: AIFeedback;
  trainerComment: TrainerComment | null;
}
export interface UploadVideoInput {
  file: File;
  title: string;
  horseId: string | null;
  discipline: Discipline;
  sessionDate: string;
}

// ---- Lessons ----
export interface Lesson {
  id: string;
  dateTime: string;
  durationMin: number;
  trainerName: string;
  trainerAvatar: string | null;
  horseName: string | null;
  type: LessonType;
  status: LessonStatus;
  notes: string | null;
  feedback: { text: string; homework: string | null } | null;
  analysisId: string | null;
}
export interface Trainer {
  id: string;
  name: string;
  avatarUrl: string | null;
}
export interface BookLessonInput {
  trainerId: string;
  horseId: string | null;
  type: LessonType;
  dateTime: string;
  durationMin: 30 | 45 | 60;
  notes?: string;
}

// ---- Horses ----
export interface Horse {
  id: string;
  name: string;
  breed: string | null;
  birthYear: number | null;
  color: string | null;
  heightCm: number | null;
  photoUrl: string | null;
  status: HorseStatus;
  riderNames: string[];
}
export interface TrainingLogEntry {
  id: string;
  date: string;
  note: string;
  author: string;
}
export interface HealthRecord {
  id: string;
  date: string;
  type: string;
  summary: string | null;
}
export interface DocumentItem {
  id: string;
  name: string;
  url: string;
}
export interface HorseDetail extends Horse {
  trainingLog: TrainingLogEntry[];
  healthRecords: HealthRecord[];
  documents: DocumentItem[];
  analyses: VideoAnalysisListItem[];
}
export interface UpsertHorseInput {
  id?: string;
  name: string;
  breed?: string;
  birthYear?: number;
  color?: string;
  heightCm?: number;
  status?: HorseStatus;
  photo?: File | null;
}

// ---- Membership ----
export interface MembershipPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: "month" | "year";
  features: string[];
  lessonsPerMonth: number;
  analysesPerMonth: number;
  highlighted: boolean;
}
export type CurrentMembership = ActiveMembership;

// ---- Payments ----
export interface PaymentMethod {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
}
export interface CheckoutInfo {
  plan: {
    id: string;
    name: string;
    price: number;
    currency: string;
    interval: "month" | "year";
  };
  appliedPromo: { code: string; discountPct: number } | null;
}
export interface NewPaymentMethodInput {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  providerToken: string; // token from Stripe/etc — never raw card data
}

// ---- Billing ----
export interface InvoiceLine {
  id: string;
  label: string;
  qty: number;
  unitPrice: number;
  total: number;
}
export interface Invoice {
  id: string;
  number: string;
  issueDate: string;
  dueDate: string | null;
  description: string | null;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  pdfUrl: string | null;
}
export interface InvoiceDetail extends Invoice {
  lines: InvoiceLine[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethodLast4: string | null;
}

// ---- Profile ----
export interface Profile {
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  role: Role;
  discipline: string | null;
  skillLevel: string | null;
  goals: string | null;
  locale: string;
  joinedAt: string;
}
export interface NotificationPrefs {
  lessonReminders: boolean;
  analysisReady: boolean;
  paymentReceipts: boolean;
  marketing: boolean;
  channel: "email" | "push" | "both";
}

// ---- Shared hook state ----
export interface QueryState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

// ════════════════════════════════════════════════════════════
// Shared helpers (keep at top of every hooks file, or in
// src/hooks/_shared.ts and import)
// ════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Not signed in");
  return data.user.id;
}

/** Generic async loader → { data, loading, error, refetch } */
function useQuery<T>(
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

const cents = (c: number | null | undefined) => (c ?? 0) / 100;

// ════════════════════════════════════════════════════════════
// PART 2 — src/hooks/use-dashboard.ts
// ════════════════════════════════════════════════════════════

export function useDashboardSummary(): QueryState<DashboardSummary | null> & {
  refetch: () => void;
} {
  return useQuery<DashboardSummary | null>(async () => {
    const uid = await requireUserId();

    const [
      profileRes,
      lessonsRes,
      membershipRes,
      analysesRes,
      invoicesRes,
      horsesRes,
      trendRes,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", uid)
        .single(),
      supabase
        .from("lessons")
        .select(
          "id, date_time, lesson_type, status, trainer:trainer_id(full_name), horse:horse_id(name)",
        )
        .eq("rider_id", uid)
        .in("status", ["pending", "confirmed"])
        .gte("date_time", new Date().toISOString())
        .order("date_time", { ascending: true })
        .limit(3),
      supabase
        .from("memberships")
        .select(
          "status, renews_at, lessons_used, analyses_used, plan:membership_plans(name, lessons_per_month, analyses_per_month)",
        )
        .eq("user_id", uid)
        .in("status", ["trialing", "active", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("video_analyses")
        .select("id, title, status, score, created_at, horse:horse_id(name)")
        .eq("rider_id", uid)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("invoices")
        .select("total_cents, currency")
        .eq("user_id", uid)
        .in("status", ["open", "overdue"]),
      supabase
        .from("horses")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", uid),
      supabase
        .from("video_analyses")
        .select("session_date, score")
        .eq("rider_id", uid)
        .eq("status", "analyzed")
        .not("score", "is", null)
        .order("session_date", { ascending: true })
        .limit(8),
    ]);

    const outstanding = (invoicesRes.data ?? []).reduce(
      (acc, inv) => ({
        amount: acc.amount + cents(inv.total_cents),
        currency: inv.currency,
        invoiceCount: acc.invoiceCount + 1,
      }),
      { amount: 0, currency: "USD", invoiceCount: 0 },
    );

    const m = membershipRes.data as any;
    return {
      user: {
        name: profileRes.data?.full_name ?? "Rider",
        role: (profileRes.data?.role ?? "rider") as Role,
      },
      upcomingLessons: (lessonsRes.data ?? []).map((l: any) => ({
        id: l.id,
        dateTime: l.date_time,
        trainerName: l.trainer?.full_name ?? "TBD",
        horseName: l.horse?.name ?? null,
        discipline: l.lesson_type,
        status: l.status,
      })),
      activeMembership: m
        ? {
            planName: m.plan?.name ?? "Plan",
            status: m.status,
            renewsAt: m.renews_at,
            lessonsUsed: m.lessons_used,
            lessonsAllowed: m.plan?.lessons_per_month ?? 0,
            analysesUsed: m.analyses_used,
            analysesAllowed: m.plan?.analyses_per_month ?? 0,
          }
        : null,
      recentAnalyses: (analysesRes.data ?? []).map((a: any) => ({
        id: a.id,
        title: a.title,
        horseName: a.horse?.name ?? null,
        score: a.score,
        status: a.status,
        createdAt: a.created_at,
      })),
      outstandingBalance: outstanding,
      horsesCount: horsesRes.count ?? 0,
      progressTrend: (trendRes.data ?? []).map((t: any) => ({
        date: t.session_date,
        score: Number(t.score),
      })),
    };
  });
}

// ════════════════════════════════════════════════════════════
// PART 3 — src/hooks/use-progress.ts
// ════════════════════════════════════════════════════════════

export function useProgressMetrics(
  periodDays: 30 | 90 | 365,
): QueryState<ProgressMetrics | null> {
  return useQuery<ProgressMetrics | null>(async () => {
    const uid = await requireUserId();
    const since = new Date(Date.now() - periodDays * 864e5)
      .toISOString()
      .slice(0, 10);

    const { data, error } = await supabase
      .from("video_analyses")
      .select("session_date, score, discipline, metrics")
      .eq("rider_id", uid)
      .eq("status", "analyzed")
      .not("score", "is", null)
      .gte("session_date", since)
      .order("session_date", { ascending: true });
    if (error) throw error;

    const rows = data ?? [];
    const scores = rows.map((r: any) => Number(r.score));
    const averageScore = scores.length
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;

    // Improvement: last score vs first score in period, as %
    const improvementPct =
      scores.length >= 2 && scores[0] !== 0
        ? ((scores[scores.length - 1] - scores[0]) / scores[0]) * 100
        : 0;

    // Top discipline by frequency
    const freq: Record<string, number> = {};
    rows.forEach((r: any) => {
      freq[r.discipline] = (freq[r.discipline] ?? 0) + 1;
    });
    const topDiscipline =
      Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // Aggregate category scores from metrics jsonb
    const catMap: Record<string, { sum: number; n: number }> = {};
    rows.forEach((r: any) =>
      (r.metrics as Metric[] | null)?.forEach((m) => {
        catMap[m.category] ??= { sum: 0, n: 0 };
        catMap[m.category].sum += m.score;
        catMap[m.category].n += 1;
      }),
    );
    const categoryScores = Object.entries(catMap).map(([category, v]) => ({
      category,
      score: Math.round((v.sum / v.n) * 10) / 10,
    }));

    return {
      averageScore: Math.round(averageScore * 10) / 10,
      improvementPct: Math.round(improvementPct * 10) / 10,
      sessionsCount: rows.length,
      topDiscipline,
      scoreOverTime: rows.map((r: any) => ({
        date: r.session_date,
        score: Number(r.score),
      })),
      categoryScores,
    };
  }, [periodDays]);
}

export function useSessionHistory(): QueryState<SessionRow[]> {
  return useQuery<SessionRow[]>(async () => {
    const uid = await requireUserId();
    const { data, error } = await supabase
      .from("video_analyses")
      .select(
        "id, session_date, discipline, score, status, horse:horse_id(name)",
      )
      .eq("rider_id", uid)
      .order("session_date", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      id: r.id,
      date: r.session_date,
      horseName: r.horse?.name ?? null,
      discipline: r.discipline,
      score: r.score,
      status: r.status,
    }));
  });
}

// ════════════════════════════════════════════════════════════
// PART 4 — src/hooks/use-analysis.ts
// ════════════════════════════════════════════════════════════

const mapAnalysis = (a: any): VideoAnalysisListItem => ({
  id: a.id,
  title: a.title,
  horseName: a.horse?.name ?? null,
  discipline: a.discipline,
  status: a.status,
  score: a.score,
  createdAt: a.created_at,
  thumbnailUrl: a.thumbnail_url,
});

export function useVideoAnalyses(): QueryState<VideoAnalysisListItem[]> & {
  refetch: () => void;
} {
  return useQuery<VideoAnalysisListItem[]>(async () => {
    const uid = await requireUserId();
    const { data, error } = await supabase
      .from("video_analyses")
      .select(
        "id, title, discipline, status, score, thumbnail_url, created_at, horse:horse_id(name)",
      )
      .eq("rider_id", uid)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapAnalysis);
  });
}

export function useVideoAnalysis(
  id: string | undefined,
): QueryState<VideoAnalysisDetail | null> {
  return useQuery<VideoAnalysisDetail | null>(async () => {
    if (!id) return null;
    const { data: a, error } = await supabase
      .from("video_analyses")
      .select("*, horse:horse_id(name)")
      .eq("id", id)
      .single();
    if (error) throw error;

    // Signed URL for the private 'videos' bucket (valid 1 hour)
    let videoUrl: string | null = null;
    if (a.video_url) {
      const { data: signed } = await supabase.storage
        .from("videos")
        .createSignedUrl(a.video_url, 3600);
      videoUrl = signed?.signedUrl ?? null;
    }

    return {
      ...mapAnalysis(a),
      videoUrl,
      metrics: (a.metrics as Metric[]) ?? [],
      aiFeedback: (a.ai_feedback as AIFeedback) ?? {
        strengths: [],
        improvements: [],
      },
      trainerComment: (a.trainer_comment as TrainerComment) ?? null,
    };
  }, [id]);
}

export function useUploadVideo() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (input: UploadVideoInput) => {
    setUploading(true);
    setProgress(0);
    setError(null);
    try {
      const uid = await requireUserId();
      const ext = input.file.name.split(".").pop() ?? "mp4";
      const path = `${uid}/${crypto.randomUUID()}.${ext}`;

      setProgress(30);
      const { error: upErr } = await supabase.storage
        .from("videos")
        .upload(path, input.file, { contentType: input.file.type });
      if (upErr) throw upErr;

      setProgress(70);
      const { data, error: insErr } = await supabase
        .from("video_analyses")
        .insert({
          rider_id: uid,
          horse_id: input.horseId,
          title: input.title,
          discipline: input.discipline,
          session_date: input.sessionDate,
          video_url: path,
          status: "uploaded",
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      // Kick off AI processing (Edge Function — deploy separately)
      supabase.functions
        .invoke("process-video", { body: { analysisId: data.id } })
        .catch(() => {});

      setProgress(100);
      return data.id as string;
    } catch (e: any) {
      setError(e?.message ?? "Upload failed");
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  return { upload, uploading, progress, error };
}

// ════════════════════════════════════════════════════════════
// PART 5 — src/hooks/use-lessons.ts
// ════════════════════════════════════════════════════════════

export type LessonFilter = "upcoming" | "past" | "requests";

const mapLesson = (l: any): Lesson => ({
  id: l.id,
  dateTime: l.date_time,
  durationMin: l.duration_min,
  trainerName: l.trainer?.full_name ?? "TBD",
  trainerAvatar: l.trainer?.avatar_url ?? null,
  horseName: l.horse?.name ?? null,
  type: l.lesson_type,
  status: l.status,
  notes: l.notes,
  feedback: l.feedback_text
    ? { text: l.feedback_text, homework: l.homework }
    : null,
  analysisId: l.analysis_id,
});

export function useLessons(
  filter: LessonFilter,
): QueryState<Lesson[]> & { refetch: () => void } {
  return useQuery<Lesson[]>(async () => {
    const uid = await requireUserId();
    let q = supabase
      .from("lessons")
      .select(
        "*, trainer:trainer_id(full_name, avatar_url), horse:horse_id(name)",
      )
      .eq("rider_id", uid);

    if (filter === "upcoming") {
      q = q
        .in("status", ["confirmed"])
        .gte("date_time", new Date().toISOString())
        .order("date_time", { ascending: true });
    } else if (filter === "past") {
      q = q
        .in("status", ["completed", "cancelled"])
        .order("date_time", { ascending: false });
    } else {
      q = q.eq("status", "pending").order("date_time", { ascending: true });
    }

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map(mapLesson);
  }, [filter]);
}

export function useTrainers(): QueryState<Trainer[]> {
  return useQuery<Trainer[]>(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("role", "trainer")
      .order("full_name");
    if (error) throw error;
    return (data ?? []).map((t: any) => ({
      id: t.id,
      name: t.full_name ?? "Trainer",
      avatarUrl: t.avatar_url,
    }));
  });
}

export function useBookLesson() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const book = useCallback(async (input: BookLessonInput) => {
    setSubmitting(true);
    setError(null);
    try {
      const uid = await requireUserId();
      const { error: err } = await supabase.from("lessons").insert({
        rider_id: uid,
        trainer_id: input.trainerId,
        horse_id: input.horseId,
        lesson_type: input.type,
        date_time: input.dateTime,
        duration_min: input.durationMin,
        notes: input.notes ?? null,
        status: "pending",
      });
      if (err) throw err;
      return true;
    } catch (e: any) {
      setError(e?.message ?? "Booking failed");
      return false;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { book, submitting, error };
}

/** Trainer-side: log feedback on a completed lesson */
export function useLogLesson() {
  const [submitting, setSubmitting] = useState(false);

  const log = useCallback(
    async (
      lessonId: string,
      feedbackText: string,
      homework: string | null,
      analysisId?: string,
    ) => {
      setSubmitting(true);
      try {
        const { error } = await supabase
          .from("lessons")
          .update({
            feedback_text: feedbackText,
            homework,
            analysis_id: analysisId ?? null,
            status: "completed",
          })
          .eq("id", lessonId);
        if (error) throw error;
        return true;
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  return { log, submitting };
}

// ════════════════════════════════════════════════════════════
// PART 6 — src/hooks/use-horses.ts
// ════════════════════════════════════════════════════════════

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

// ════════════════════════════════════════════════════════════
// PART 7 — src/hooks/use-membership.ts
// ════════════════════════════════════════════════════════════

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

// ════════════════════════════════════════════════════════════
// PART 8 — src/hooks/use-payments.ts
// ════════════════════════════════════════════════════════════

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

// ════════════════════════════════════════════════════════════
// PART 9 — src/hooks/use-billing.ts
// ════════════════════════════════════════════════════════════

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

// ════════════════════════════════════════════════════════════
// PART 10 — src/hooks/use-profile.ts
// ════════════════════════════════════════════════════════════

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

// ════════════════════════════════════════════════════════════
// APPENDIX — splitting checklist
// ════════════════════════════════════════════════════════════
// When splitting into files, each hooks file needs:
//
//   import { useCallback, useEffect, useState } from "react";
//   import { supabase } from "@/lib/supabase";
//   import type { ... } from "./types";
//   import { useQuery, requireUserId, cents } from "./_shared";
//
// 1. Move "Shared helpers" (requireUserId, useQuery, cents) into
//    src/hooks/_shared.ts and add `export` to each.
// 2. mapAnalysis is defined in use-analysis.ts — use-horses.ts
//    imports it:  import { mapAnalysis } from "./use-analysis";
//    (add `export` to mapAnalysis).
// 3. Every exported hook needs its types imported from ./types.
// 4. npm i @supabase/supabase-js
// 5. .env.local:
//      NEXT_PUBLIC_SUPABASE_URL=https://gtogwivozgrmjnrtungm.supabase.co
//      NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
//
// Two integration points left as TODO (need provider decisions):
//   - process-video Edge Function (AI analysis pipeline)
//   - real card charging in useCheckout.pay (Stripe / Moyasar / HyperPay)
// ════════════════════════════════════════════════════════════s
