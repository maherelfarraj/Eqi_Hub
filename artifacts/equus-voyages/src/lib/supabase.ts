import { createClient } from "@supabase/supabase-js";

// Vite exposes env vars via import.meta.env — they must start with VITE_
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  throw new Error(
    "Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Replit Secrets."
  );
}

export const supabase = createClient(url, anonKey);
