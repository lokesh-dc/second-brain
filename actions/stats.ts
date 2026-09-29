"use server";

import { createClient } from "@/lib/supabase/server";

export type RetrievalStatsRow = {
  category: string;
  total: number;
  neverRetrieved: number;
  pctNeverRetrieved: number;
  avgRetrievalCountWhenRetrieved: number;
};

/**
 * Diagnostic reporting (internal, no UI yet): per-category resurfacing stats.
 *
 * Scoped to entries created in the last `days` days — very recent entries
 * haven't had a chance to be retrieved yet and would skew the
 * "never resurfaced" number artificially high.
 */
export async function getRetrievalStats(
  days = 30,
): Promise<RetrievalStatsRow[]> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return [];

  const cutoff = new Date(
    Date.now() - Math.max(days, 1) * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await sb
    .from("entries")
    .select("retrieval_count, category:categories(name)")
    .eq("user_id", user.id)
    .gte("created_at", cutoff);

  if (error || !data) {
    console.error("[stats] getRetrievalStats failed:", error);
    return [];
  }

  const byCategory = new Map<string, { total: number; never: number; sum: number; retrieved: number }>();
  for (const row of data as unknown as Array<{
    retrieval_count: number | null;
    category: { name: string } | { name: string }[] | null;
  }>) {
    const raw = Array.isArray(row.category) ? row.category[0] : row.category;
    const name = raw?.name ?? "uncategorized";
    const count = row.retrieval_count ?? 0;

    let agg = byCategory.get(name);
    if (!agg) {
      agg = { total: 0, never: 0, sum: 0, retrieved: 0 };
      byCategory.set(name, agg);
    }
    agg.total += 1;
    if (count === 0) {
      agg.never += 1;
    } else {
      agg.sum += count;
      agg.retrieved += 1;
    }
  }

  return [...byCategory.entries()]
    .map(([category, agg]) => ({
      category,
      total: agg.total,
      neverRetrieved: agg.never,
      pctNeverRetrieved: agg.total === 0 ? 0 : (agg.never / agg.total) * 100,
      avgRetrievalCountWhenRetrieved:
        agg.retrieved === 0 ? 0 : agg.sum / agg.retrieved,
    }))
    .sort((a, b) => b.total - a.total);
}
