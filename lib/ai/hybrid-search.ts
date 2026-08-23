import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateEmbedding } from "./embeddings";
import { Entity, Entry, ParsedQuery } from "@/types";

const RRF_K = 60;

function reciprocalRankFusion(
  vectorResults: Entry[],
  structuredResults: Entry[],
): Entry[] {
  const scores = new Map<string, number>();
  const entryMap = new Map<string, Entry>();

  const addResults = (results: Entry[]) => {
    results.forEach((entry, rank) => {
      const prev = scores.get(entry.id) ?? 0;
      scores.set(entry.id, prev + 1 / (RRF_K + rank + 1));
      entryMap.set(entry.id, entry);
    });
  };

  addResults(vectorResults);
  addResults(structuredResults);

  return Array.from(entryMap.values())
    .sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0))
    .slice(0, 10);
}

export async function hybridSearch(
  sb: SupabaseClient,
  parsed: ParsedQuery,
  userId: string,
): Promise<Entry[]> {
  const queryEmbedding = await generateEmbedding(parsed.rewritten_query);

  if (!queryEmbedding) {
    console.error("[hybridSearch] embedding generation failed");
    return [];
  }

  const filters: {
    p_category?: string;
    p_from?: string;
    p_to?: string;
    p_entity_name?: string;
  } = {};

  if (parsed.category_filter) filters.p_category = parsed.category_filter;
  if (parsed.time_filter.from) filters.p_from = parsed.time_filter.from;
  if (parsed.time_filter.to) filters.p_to = parsed.time_filter.to;
  if (parsed.entity_filter) filters.p_entity_name = parsed.entity_filter;

  const [vectorRes, structuredRes] = await Promise.all([
    sb.rpc("match_documents_filtered", {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: 20,
      p_user_id: userId,
      ...filters,
    }),

    (async () => {
      let query = sb
        .from("entries")
        .select(
          `id, raw_text, summary, amount, currency, timestamp, tags,
           category:categories(id, name),
           entry_entities(entity:entities(id, name, type))`,
        )
        .eq("user_id", userId)
        .order("timestamp", { ascending: false })
        .limit(20);

      if (parsed.category_filter) {
        const { data: cats } = await sb
          .from("categories")
          .select("id")
          .ilike("name", `%${parsed.category_filter}%`);
        if (cats && cats.length > 0) {
          query = query.in("category_id", cats.map((c) => c.id));
        }
      }
      if (parsed.time_filter.from)
        query = query.gte("timestamp", parsed.time_filter.from);
      if (parsed.time_filter.to)
        query = query.lte("timestamp", parsed.time_filter.to);

      return query;
    })(),
  ]);

  if (vectorRes.error) {
    console.error("[hybridSearch] vector search error:", vectorRes.error);
  }

  const vectorEntries = (vectorRes.data ?? []) as unknown as Entry[];
  const rawStructured = (structuredRes.data ?? []) as unknown as Array<
    Entry & { entry_entities?: Array<{ entity?: Entity }> }
  >;

  // Normalize the nested join into a flat entities array
  const structuredEntries: Entry[] = rawStructured.map((row) => ({
    ...row,
    category:
      typeof row.category === "string"
        ? undefined
        : (row.category as Entry["category"]),
    entities: row.entry_entities
      ?.map((ee) => ee.entity)
      .filter((e): e is NonNullable<typeof e> => Boolean(e)),
  }));

  const filteredStructured = parsed.entity_filter
    ? structuredEntries.filter((e) =>
        e.entities?.some((ee) =>
          ee.name?.toLowerCase().includes(parsed.entity_filter!.toLowerCase()),
        ),
      )
    : structuredEntries;

  return reciprocalRankFusion(vectorEntries, filteredStructured);
}
