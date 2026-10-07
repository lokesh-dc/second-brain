import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { generateEmbedding } from "./embeddings";
import { Category, Entity, Entry, MatchDocumentsRow, ParsedQuery } from "@/types";

const RRF_K = 60;

// Words that carry no entity meaning — dropped when reducing a filter
// phrase ("bus fare to jibhi") to its significant token ("jibhi").
const ENTITY_STOPWORDS = new Set([
  "what", "was", "were", "is", "are", "my", "the", "a", "an", "to",
  "for", "in", "on", "of", "how", "much", "many", "did", "do", "it",
  "me", "about", "any", "had", "has", "have", "with",
]);

/**
 * Reduce a possibly-phrasy entity filter to one significant token.
 * The query parser is instructed to emit a single noun, but older
 * responses (and edge cases) can still be phrases — matching those
 * verbatim against entity names guarantees zero hits.
 */
function entityToken(filter: string): string {
  const tokens = filter
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !ENTITY_STOPWORDS.has(t));
  if (tokens.length === 0) return filter.trim().toLowerCase();
  return tokens.sort((a, b) => b.length - a.length)[0];
}

/**
 * PostgREST can return the categories(id, ...) join as an object, an array
 * (relationship resolved as many), or null depending on the row and hinting.
 */
function normalizeCategory(value: unknown): Category | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || typeof candidate !== "object") return undefined;
  const c = candidate as Partial<Category> & Record<string, unknown>;
  if (typeof c.id !== "string" || typeof c.name !== "string") return undefined;
  return {
    id: c.id,
    name: c.name,
    user_id: typeof c.user_id === "string" ? c.user_id : "",
    icon: typeof c.icon === "string" ? c.icon : undefined,
    is_default: c.is_default === true,
  };
}

function toEntry(row: MatchDocumentsRow): Entry {
  return {
    id: row.id,
    user_id: row.user_id,
    raw_text: row.raw_text,
    category_id: row.category_id ?? undefined,
    summary: row.summary ?? undefined,
    amount: row.amount ?? undefined,
    currency: row.currency ?? undefined,
    timestamp: row.timestamp,
    tags: row.tags ?? [],
    embedding_doc: row.embedding_doc ?? undefined,
    category:
      row.category_id && row.category_name && row.category_user_id
        ? {
            id: row.category_id,
            user_id: row.category_user_id,
            name: row.category_name,
            icon: row.category_icon ?? undefined,
            is_default: row.category_is_default === true,
          }
        : undefined,
    entities: (row.entities ?? []).map((et) => ({
      id: et.id,
      user_id: et.user_id,
      name: et.name,
      type: et.type ?? "",
    })),
  };
}

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

/**
 * Diagnostic instrumentation: bump retrieval_count / last_retrieved_at for
 * entries that were actually surfaced in an answer.
 *
 * Single batched UPDATE via the log_entry_retrievals RPC
 * (WHERE id = ANY(p_entry_ids)) — never one query per entry.
 * Logs failures but never throws, so search never fails because
 * instrumentation failed.
 */
export async function logRetrievedEntries(
  sb: SupabaseClient,
  userId: string,
  entryIds: string[],
): Promise<void> {
  const ids = [...new Set(entryIds)].filter(Boolean);
  if (ids.length === 0) return;

  try {
    const { error } = await sb.rpc("log_entry_retrievals", {
      p_entry_ids: ids,
      p_user_id: userId,
    });
    if (error) {
      console.error(
        "[hybridSearch] retrieval instrumentation failed:",
        error,
      );
    }
  } catch (err) {
    console.error("[hybridSearch] retrieval instrumentation failed:", err);
  }
}

/**
 * Non-blocking wrapper around logRetrievedEntries. Runs after the response
 * is sent (Next `after`) so retrieval latency doesn't regress; falls back
 * to a fire-and-forget call when `after` isn't available (e.g. tests).
 * Never awaits — never blocks the user's search.
 */
export function scheduleRetrievalLogging(
  sb: SupabaseClient,
  userId: string,
  entryIds: string[],
): void {
  if (!entryIds || entryIds.length === 0) return;
  try {
    after(() => logRetrievedEntries(sb, userId, entryIds));
  } catch {
    void logRetrievedEntries(sb, userId, entryIds);
  }
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
  const entityTok = parsed.entity_filter
    ? entityToken(parsed.entity_filter)
    : null;
  if (entityTok) filters.p_entity_name = entityTok;

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
          `id, user_id, raw_text, summary, amount, currency, timestamp, tags,
           category:categories(id, user_id, name, icon, is_default),
           entry_entities(entity:entities(id, user_id, name, type))`,
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
  if (structuredRes.error) {
    console.error(
      "[hybridSearch] structured search error:",
      structuredRes.error,
    );
  }

  const vectorEntries: Entry[] = ((vectorRes.data ?? []) as MatchDocumentsRow[]).map(toEntry);

  // Normalize the nested join into a flat entities array
  const structuredEntries: Entry[] = (
    (structuredRes.data ?? []) as unknown as Array<
      Entry & { entry_entities?: Array<{ entity?: Entity }> }
    >
  ).map((row) => ({
    ...row,
    category: normalizeCategory(row.category),
    entities: row.entry_entities
      ?.map((ee) => ee.entity)
      .filter((e): e is NonNullable<typeof e> => Boolean(e)),
  }));

  const filteredStructured = entityTok
    ? structuredEntries.filter((e) =>
        e.entities?.some((ee) =>
          ee.name?.toLowerCase().includes(entityTok),
        ),
      )
    : structuredEntries;

  return reciprocalRankFusion(vectorEntries, filteredStructured);
}
