"use server";

import { createClient } from "@/lib/supabase/server";
import { ENTRY_SELECT, normalizeEntries, type RawEntry } from "@/lib/entries";
import type { Entity, Entry } from "@/types";

export type EntityStats = {
  dropCount: number;
  spendTotal: number;
  spendCurrency: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
  categories: { name: string; count: number }[];
};

export async function getEntityDetails(
  id: string,
): Promise<
  | { ok: true; entity: Entity; entries: Entry[]; stats: EntityStats }
  | { ok: false; error: string }
> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: entity, error: entityError } = await sb
    .from("entities")
    .select("id, user_id, name, type")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (entityError || !entity) {
    return { ok: false, error: "Entity not found" };
  }

  const { data: links, error: linksError } = await sb
    .from("entry_entities")
    .select(`entry:entries(${ENTRY_SELECT})`)
    .eq("entity_id", id);

  if (linksError) {
    console.error("[entities] history query failed:", linksError);
    return { ok: false, error: "Failed to load history" };
  }

  const raws = ((links ?? []) as unknown as { entry: RawEntry | null }[])
    .map((l) => l.entry)
    .filter(
      (e): e is RawEntry => !!e && (e as RawEntry).user_id === user.id,
    )
    .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));

  const entries = normalizeEntries(raws);

  let spendTotal = 0;
  const currencyCounts = new Map<string, number>();
  const catCounts = new Map<string, number>();
  let firstSeen: string | null = null;
  let lastSeen: string | null = null;

  for (const e of entries) {
    if (e.amount != null) {
      spendTotal += e.amount;
      if (e.currency) {
        currencyCounts.set(e.currency, (currencyCounts.get(e.currency) ?? 0) + 1);
      }
    }
    const cat =
      e.category && typeof e.category !== "string"
        ? e.category.name
        : "misc";
    catCounts.set(cat, (catCounts.get(cat) ?? 0) + 1);
    if (!firstSeen || e.timestamp < firstSeen) firstSeen = e.timestamp;
    if (!lastSeen || e.timestamp > lastSeen) lastSeen = e.timestamp;
  }

  return {
    ok: true,
    entity: entity as Entity,
    entries,
    stats: {
      dropCount: entries.length,
      spendTotal,
      spendCurrency:
        currencyCounts.size > 0
          ? [...currencyCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
          : null,
      firstSeen,
      lastSeen,
      categories: [...catCounts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
    },
  };
}

/**
 * Name-only references (digest topEntity, briefing chip) carry no id.
 * Resolve to the entity page id — exact match first, then substring.
 */
export async function getEntityIdByName(
  name: string,
): Promise<{ ok: boolean; id?: string }> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false };

  const clean = name.trim();
  if (!clean) return { ok: false };

  const { data: exact } = await sb
    .from("entities")
    .select("id")
    .eq("user_id", user.id)
    .ilike("name", clean)
    .limit(1)
    .maybeSingle();
  if (exact) return { ok: true, id: exact.id };

  const { data: fuzzy } = await sb
    .from("entities")
    .select("id")
    .eq("user_id", user.id)
    .ilike("name", `%${clean}%`)
    .limit(1)
    .maybeSingle();
  if (fuzzy) return { ok: true, id: fuzzy.id };

  return { ok: false };
}
