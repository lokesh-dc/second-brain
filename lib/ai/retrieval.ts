import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Entry, ParsedQuery, RetrievalAnswer } from "@/types";
import { hybridSearch, scheduleRetrievalLogging } from "./hybrid-search";
import { chatJSON } from "./groq";

function computeAggregations(entries: Entry[], parsed: ParsedQuery) {
  if (parsed.aggregation === "sum") {
    const total = entries.reduce((acc, e) => acc + (e.amount ?? 0), 0);
    const currency = entries.find((e) => e.currency)?.currency ?? "INR";
    return { total, currency, count: entries.length };
  }
  if (parsed.aggregation === "count") {
    return { count: entries.length };
  }
  return null;
}

function summariseEntries(entries: Entry[]): string {
  return entries
    .slice(0, 8)
    .map(
      (e) =>
        `- ${e.summary ?? e.raw_text} | ${
          e.category && typeof e.category !== "string" ? e.category.name : ""
        } | ${e.amount ? `${e.currency ?? ""} ${e.amount}` : ""} | ${new Date(
          e.timestamp,
        ).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
    )
    .join("\n");
}

export async function generateRetrievalAnswer(
  sb: SupabaseClient,
  parsed: ParsedQuery,
  userId: string,
): Promise<RetrievalAnswer> {
  const entries = await hybridSearch(sb, parsed, userId);

  if (entries.length === 0) {
    return {
      answer:
        "I couldn't find anything matching that. Try rephrasing or check if you've logged it.",
      entry_ids: [],
      type: "narrative",
    };
  }

  const precomputed = computeAggregations(entries, parsed);
  const timeContext = parsed.time_filter.range ?? "recently";
  const entrySummary = summariseEntries(entries);

  let aggregationInstruction = "";
  if (parsed.aggregation === "sum" && precomputed && "total" in precomputed) {
    aggregationInstruction = `The total amount is ${precomputed.total} ${precomputed.currency} across ${precomputed.count} entries. Lead with this total, then briefly mention the breakdown or key items that make it up.`;
  } else if (parsed.aggregation === "count" && precomputed) {
    aggregationInstruction = `There are exactly ${precomputed.count} entries. Lead with this number.`;
  } else if (parsed.aggregation === "list") {
    aggregationInstruction =
      "List the entries conversationally. Be concise.";
  } else {
    aggregationInstruction =
      "Give a natural conversational answer based on the entries.";
  }

  const prompt = `You answer questions about someone's personal life logs. Be a smart, brief friend — not a chatbot.

Question: "${parsed.rewritten_query}"
Time context: ${timeContext}
${aggregationInstruction}

Entries found:
${entrySummary}

Rules:
- Keep answer under 3 sentences
- Mention specific names, amounts, or dates from the entries
- If time context is given, mention it
- Do not say "Based on your entries" or "I found" — just answer
- Return only valid JSON, no markdown

Schema: {"answer":"string","entry_ids":["uuid array"],"type":"sum|count|list|narrative"}

Output:`;

  try {
    const result = await chatJSON<RetrievalAnswer>(
      [{ role: "user", content: prompt }],
      { temperature: 0.2, maxTokens: 300 },
    );

    const validIds = new Set(entries.map((e) => e.id));
    result.entry_ids = (result.entry_ids ?? []).filter((id) =>
      validIds.has(id),
    );

    // Instrumentation (diagnostic only): track which entries were actually
    // surfaced in this answer. Non-blocking — never delays the response,
    // never throws.
    scheduleRetrievalLogging(sb, userId, result.entry_ids);

    return result;
  } catch (err) {
    console.error("[ai] retrieval answer failed:", err);
    const fallbackAnswer =
      precomputed && "total" in precomputed
        ? `You spent ${precomputed.currency} ${precomputed.total} across ${precomputed.count} entries ${timeContext}.`
        : `Found ${entries.length} entries ${timeContext}.`;

    const fallback: RetrievalAnswer = {
      answer: fallbackAnswer,
      entry_ids: entries.map((e) => e.id),
      type: parsed.aggregation ?? "narrative",
    };

    scheduleRetrievalLogging(sb, userId, fallback.entry_ids);

    return fallback;
  }
}
