"use server";

import { createClient } from "@/lib/supabase/server";
import { Digest } from "@/types";

export type HomeWidgets = {
  todayCount: number;
  weekCount: number;
  monthSpend: number;
  monthSpendCurrency: string;
  monthLabel: string;
  topCategory: { name: string; count: number } | null;
  totalDrops: number;
  briefing: {
    narrative: string;
    generated_at: string;
    biggestExpense?: Digest["raw_data"]["biggestExpense"];
    topEntity?: Digest["raw_data"]["topEntity"];
  } | null;
};

/**
 * Lightweight dashboard data for /home. One bounded entries query
 * (last 30 days) + one cached digest read — never triggers AI regen,
 * so the home page stays fast even with a cold digest cache.
 */
export async function getHomeWidgets(): Promise<HomeWidgets> {
  const fallback: HomeWidgets = {
    todayCount: 0,
    weekCount: 0,
    monthSpend: 0,
    monthSpendCurrency: "INR",
    monthLabel: new Date().toLocaleString("en-US", { month: "long" }),
    topCategory: null,
    totalDrops: 0,
    briefing: null,
  };

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return fallback;

  const now = new Date();
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [{ data: rows, error }, { data: cachedDigest }] = await Promise.all([
    sb
      .from("entries")
      .select("timestamp, amount, currency, category:categories(name)")
      .eq("user_id", user.id)
      .gte("timestamp", cutoff)
      .order("timestamp", { ascending: false })
      .limit(500),
    sb
      .from("digests")
      .select("narrative, generated_at, raw_data")
      .eq("user_id", user.id)
      .eq("period", "today")
      .maybeSingle(),
  ]);

  if (error || !rows) {
    console.error("[home] widgets entries query failed:", error);
  }

  type Row = {
    timestamp: string;
    amount: number | null;
    currency: string | null;
    category: { name: string } | { name: string }[] | null;
  };

  const list = (rows ?? []) as unknown as Row[];
  const catCounts = new Map<string, number>();
  let todayCount = 0;
  let weekCount = 0;
  let monthSpend = 0;
  let monthSpendCurrency = "INR";
  const currencyCounts = new Map<string, number>();

  for (const r of list) {
    const ts = new Date(r.timestamp);
    const raw = Array.isArray(r.category) ? r.category[0] : r.category;
    const catName = raw?.name ?? "misc";

    catCounts.set(catName, (catCounts.get(catName) ?? 0) + 1);

    if (ts >= startOfToday) todayCount += 1;
    if (ts >= startOfWeek) weekCount += 1;

    if (catName.toLowerCase().includes("expense") && ts >= monthStart && r.amount != null) {
      monthSpend += r.amount;
      if (r.currency) {
        currencyCounts.set(r.currency, (currencyCounts.get(r.currency) ?? 0) + 1);
      }
    }
  }

  if (currencyCounts.size > 0) {
    monthSpendCurrency = [...currencyCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  let topCategory: HomeWidgets["topCategory"] = null;
  for (const [name, count] of catCounts) {
    if (!topCategory || count > topCategory.count) topCategory = { name, count };
  }

  // Total drops for the masthead (cheap exact count, no row data).
  const { count: totalDrops } = await sb
    .from("entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  let briefing: HomeWidgets["briefing"] = null;
  if (cachedDigest) {
    const generatedAt = new Date(cachedDigest.generated_at).getTime();
    const ageH = (Date.now() - generatedAt) / 3_600_000;
    // Same staleness rules as getDigest, evaluated against the entries
    // already fetched above: yesterday's digest or one predating new drops
    // shows the "generate" CTA instead of stale text.
    const predatesToday = generatedAt < startOfToday.getTime();
    const hasNewer = list.some(
      (r) => new Date(r.timestamp).getTime() > generatedAt,
    );
    if (ageH < 24 && !predatesToday && !hasNewer && typeof cachedDigest.narrative === "string") {
      const raw = cachedDigest.raw_data as Digest["raw_data"] | null;
      briefing = {
        narrative: cachedDigest.narrative,
        generated_at: cachedDigest.generated_at,
        biggestExpense: raw?.biggestExpense,
        topEntity: raw?.topEntity,
      };
    }
  }

  return {
    todayCount,
    weekCount,
    monthSpend,
    monthSpendCurrency,
    monthLabel: now.toLocaleString("en-US", { month: "long" }),
    topCategory,
    totalDrops: totalDrops ?? list.length,
    briefing,
  };
}
