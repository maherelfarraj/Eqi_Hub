import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { QueryState } from "./types";

export async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Not signed in");
  return data.user.id;
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
