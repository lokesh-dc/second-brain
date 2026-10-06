import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Entry,
  ParsedQuery,
  RetrievalAnswer,
  RetrievalHistoryTurn,
} from "@/types";
import {
  getEntriesByIds,
  hybridSearch,
  scheduleRetrievalLogging,
} from "./hybrid-search";
import { chatJSONLenient } from "./groq";

export interface RetrievalOptions {
  /** Override "now" (defaults to server time). Mainly useful for tests. */
  now?: Date;
  /** Previous turns of the current thread (query + answer), oldest first. */
  history?: RetrievalHistoryTurn[];
  /** Entry ids cited by the previous turn — merged back into context. */
  priorEntryIds?: string[];
  /** What the user actually typed (may differ from the rewritten search). */
  originalQuery?: string;
}

/** Shape of the raw JSON we expect back from the model (all fields unknown). */
interface RetrievalModelOutput {
  answer: unknown;
  entry_ids: unknown;
  followups: unknown;
  type: unknown;
}

const MAX_CONTEXT_ENTRIES = 20;
const MAX_FOLLOWUPS = 3;
const MAX_FOLLOWUP_WORDS = 5;

const NO_MATCH_ANSWER =
  "I couldn't find that in your entries. Try asking about something you've logged — like reading, spending, ideas, or travel.";

/** "today" / "yesterday" / "3 days ago" / "12 April" relative to `now`. */
function describeDay(iso: string, now: Date): string {
  const d = new Date(iso);
  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round(
    (startOfDay(now) - startOfDay(d)) / (24 * 60 * 60 * 1000),
  );
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long" });
}

function truncate(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function categoryName(entry: Entry): string {
  return entry.category && typeof entry.category !== "string"
    ? entry.category.name
    : "misc";
}

function formatEntryLine(entry: Entry, now: Date): string {
  const parts = [
    `[${entry.id}] ${truncate(entry.summary ?? entry.raw_text, 160)}`,
    `category: ${categoryName(entry)}`,
  ];
  if (entry.amount != null) {
    parts.push(`amount: ${entry.currency ?? ""} ${entry.amount}`.trim());
  }
  parts.push(
    `date: ${new Date(entry.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} (${describeDay(entry.timestamp, now)})`,
  );
  if (entry.tags && entry.tags.length > 0) {
    parts.push(`tags: ${entry.tags.join(", ")}`);
  }
  if (entry.raw_text && entry.raw_text !== entry.summary) {
    parts.push(`note: "${truncate(entry.raw_text, 200)}"`);
  }
  return `- ${parts.join(" | ")}`;
}

function totalsByCurrency(
  entries: Entry[],
): Array<{ currency: string; total: number; count: number }> {
  const map = new Map<string, { total: number; count: number }>();
  for (const e of entries) {
    if (e.amount == null) continue;
    const key = e.currency ?? "unknown";
    const prev = map.get(key) ?? { total: 0, count: 0 };
    prev.total += e.amount;
    prev.count += 1;
    map.set(key, prev);
  }
  return [...map.entries()].map(([currency, v]) => ({ currency, ...v }));
}

/**
 * Validate the model's JSON and coerce it into the strict RetrievalAnswer
 * contract. Unknown entry ids are dropped; follow-ups are capped at 3 items
 * of at most 5 words each; `no_match` turns always get empty follow-ups.
 */
function sanitizeModelOutput(
  raw: unknown,
  validIds: Set<string>,
): RetrievalAnswer {
  const out = (raw ?? {}) as Partial<RetrievalModelOutput>;

  const answer =
    typeof out.answer === "string" && out.answer.trim().length > 0
      ? out.answer.trim()
      : NO_MATCH_ANSWER;

  const seen = new Set<string>();
  const entry_ids: string[] = [];
  if (Array.isArray(out.entry_ids)) {
    for (const id of out.entry_ids) {
      if (typeof id !== "string" || !validIds.has(id) || seen.has(id)) continue;
      seen.add(id);
      entry_ids.push(id);
      if (entry_ids.length >= MAX_CONTEXT_ENTRIES) break;
    }
  }

  let followups: string[] = [];
  if (Array.isArray(out.followups)) {
    for (const f of out.followups) {
      if (typeof f !== "string") continue;
      const text = f.trim();
      const words = text.split(/\s+/).filter(Boolean);
      if (words.length === 0 || words.length > MAX_FOLLOWUP_WORDS) continue;
      if (followups.some((x) => x.toLowerCase() === text.toLowerCase()))
        continue;
      followups.push(text);
      if (followups.length >= MAX_FOLLOWUPS) break;
    }
  }

  const type = out.type === "answer" || out.type === "no_match" ? out.type : null;
  if (type === "no_match") followups = [];
  // Model claimed no match: never surface sources or chips for it.
  if (type === "no_match") return { answer, entry_ids: [], followups, type };

  return {
    answer,
    entry_ids,
    followups,
    type: type ?? (entry_ids.length > 0 ? "answer" : "no_match"),
  };
}

function buildPrompt(
  originalQuery: string,
  entries: Entry[],
  history: RetrievalHistoryTurn[],
  now: Date,
): string {
  const timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  const nowLabel = now.toLocaleString("en-IN", {
    dateStyle: "full",
    timeStyle: "short",
  });

  const historyBlock =
    history.length === 0
      ? "None — this is the first question in this thread."
      : history
          .slice(-5)
          .map((t) => `Q: ${t.query}\nA: ${t.answer}`)
          .join("\n");

  const totals = totalsByCurrency(entries);
  const totalsBlock =
    totals.length === 0
      ? "No money amounts in these entries."
      : totals
          .map(
            (t) =>
              `${t.currency} ${t.total} total across ${t.count} ${t.count === 1 ? "entry" : "entries"}`,
          )
          .join("; ");

  return `You answer questions about someone's personal life logs. Answer like a smart friend, not a robot.

Current date and time: ${nowLabel} (${timeZone}; ${now.toISOString()})

Conversation so far in this thread (most recent last):
${historyBlock}

Question: "${originalQuery}"

Entries (these are the ONLY entries that exist for this question — never invent others):
${entries.map((e) => formatEntryLine(e, now)).join("\n")}

Computed money totals (use these numbers exactly, do not recompute): ${totalsBlock}

Rules:
- Answer the question directly using ONLY the entries above.
- Never reply with only a count of entries ("Found 2 entries"). Mention a count only when the user asked how many.
- Use relative time words ("today", "yesterday", "this week", "in April") based on the current date above.
- For money questions, state the totals separately per currency. Never add different currencies together.
- If the entries do not actually answer the question, say so plainly in one sentence and suggest a better query. Do not pad with weak matches.
- One to three short sentences, unless the user asked for detail.
- Never invent entries, amounts, or dates.
- Suggest 0-3 follow-ups the user could type next. Each must be under 5 words, phrased as something the user could type (e.g. "This week only", "Show all reading"), and answerable from their data. Empty array when there is no real match.

Return ONLY this JSON object, no markdown, no code fences:
{"answer":"string","entry_ids":["uuid, most relevant first"],"followups":["..."],"type":"answer|no_match"}

- entry_ids must be a subset of the ids listed above.
- type is "no_match" when the entries do not answer the question (one plain sentence + a better query suggestion, followups []).`;
}

export async function generateRetrievalAnswer(
  sb: SupabaseClient,
  parsed: ParsedQuery,
  userId: string,
  opts: RetrievalOptions = {},
): Promise<RetrievalAnswer> {
  const now = opts.now ?? new Date();
  const history = (opts.history ?? []).filter(
    (t) => t.query.trim().length > 0,
  );

  const entries = await hybridSearch(sb, parsed, userId);

  // Follow-up support: union fresh matches with the previous turn's cited
  // entries (deduped, new matches ranked first, capped). This keeps
  // follow-ups like "only the comic" or "compare to last month" grounded
  // even when the new query alone embeds or filters poorly.
  let contextEntries = entries.slice(0, MAX_CONTEXT_ENTRIES);
  if (opts.priorEntryIds && opts.priorEntryIds.length > 0) {
    const seen = new Set(contextEntries.map((e) => e.id));
    const prior = (await getEntriesByIds(sb, userId, opts.priorEntryIds)).filter(
      (e) => !seen.has(e.id),
    );
    contextEntries = [...contextEntries, ...prior].slice(0, MAX_CONTEXT_ENTRIES);
  }

  if (contextEntries.length === 0) {
    return { answer: NO_MATCH_ANSWER, entry_ids: [], followups: [], type: "no_match" };
  }

  const prompt = buildPrompt(
    opts.originalQuery?.trim() || parsed.rewritten_query,
    contextEntries,
    history,
    now,
  );

  try {
    const { data, raw } = await chatJSONLenient<RetrievalModelOutput>(
      [{ role: "user", content: prompt }],
      { temperature: 0.2, maxTokens: 400 },
    );

    if (!data) {
      console.error("[ai] retrieval answer was not valid JSON:", raw);
      return {
        answer: NO_MATCH_ANSWER,
        entry_ids: [],
        followups: [],
        type: "no_match",
      };
    }

    const validIds = new Set(contextEntries.map((e) => e.id));
    const result = sanitizeModelOutput(data, validIds);

    // Instrumentation (diagnostic only): track which entries were actually
    // surfaced in this answer. Non-blocking — never delays the response,
    // never throws.
    scheduleRetrievalLogging(sb, userId, result.entry_ids);

    return result;
  } catch (err) {
    console.error("[ai] retrieval answer failed:", err);
    return {
      answer: NO_MATCH_ANSWER,
      entry_ids: [],
      followups: [],
      type: "no_match",
    };
  }
}
