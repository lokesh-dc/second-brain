import "server-only";
import { chatJSON } from "./groq";
import { ParsedQuery, TimeFilter } from "@/types";

function resolveTimeFilter(raw: TimeFilter): TimeFilter {  if (!raw.range) return raw;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const iso = (d: Date) => d.toISOString();

  const dayStart = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayEnd = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  switch (raw.range) {
    case "today":
      return { ...raw, from: iso(dayStart(today)), to: iso(dayEnd(today)) };

    case "yesterday": {
      const yd = new Date(today);
      yd.setDate(yd.getDate() - 1);
      return { ...raw, from: iso(dayStart(yd)), to: iso(dayEnd(yd)) };
    }

    case "this_week": {
      const mon = new Date(today);
      mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      return { ...raw, from: iso(dayStart(mon)), to: iso(dayEnd(today)) };
    }

    case "last_week": {
      const mon = new Date(today);
      mon.setDate(today.getDate() - ((today.getDay() + 6) % 7) - 7);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { ...raw, from: iso(dayStart(mon)), to: iso(dayEnd(sun)) };
    }

    case "this_month": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { ...raw, from: iso(start), to: iso(dayEnd(today)) };
    }

    case "last_month": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { ...raw, from: iso(dayStart(start)), to: iso(dayEnd(end)) };
    }

    default:
      return raw;
  }
}

export async function parseQuery(input: string): Promise<ParsedQuery> {  const systemPrompt = `You parse user queries for a personal life-logging app.
Return ONLY valid JSON. No explanation. No markdown.

Schema:
{"intent":"retrieve|log","rewritten_query":"string","category_filter":"expense|reading|idea|travel|shopping|health|media|misc|null","time_filter":{"type":"relative|absolute|null","range":"today|yesterday|this_week|last_week|this_month|last_month|null","from":null,"to":null},"entity_filter":"string or null","aggregation":"sum|count|list|null"}

Rules:
- intent is "retrieve" if asking a question (how, what, show, find).
- intent is "log" if recording activity or stating a fact (read, bought, did, had).
- If it's a statement of activity, it's ALWAYS a log.
- category_filter: expense, reading, idea, travel, shopping, health, media, or misc.
- entity_filter: ONE short noun only — a place, person, or title ("jibhi", "kafka"). Never a phrase ("bus fare to jibhi").
- aggregation: sum, count, or list.`;

  const userPrompt = `Input: "what did I spend this week"
Output: {"intent":"retrieve","rewritten_query":"expenses and money spent","category_filter":"expense","time_filter":{"type":"relative","range":"this_week","from":null,"to":null},"entity_filter":null,"aggregation":"sum"}

Input: "Read Kafka today"
Output: {"intent":"log","rewritten_query":"Read Kafka today","category_filter":"reading","time_filter":{"type":null,"range":null,"from":null,"to":null},"entity_filter":"Kafka","aggregation":null}

Input: "had coffee this morning"
Output: {"intent":"log","rewritten_query":"had coffee this morning","category_filter":null,"time_filter":{"type":null,"range":null,"from":null,"to":null},"entity_filter":null,"aggregation":null}

Input: "What was my bus fare to Jibhi"
Output: {"intent":"retrieve","rewritten_query":"bus fare to Jibhi","category_filter":"expense","time_filter":{"type":null,"range":null,"from":null,"to":null},"entity_filter":"jibhi","aggregation":"list"}

Input: "${input.replace(/"/g, "'")}"
Output:`;

  try {
    const parsed = await chatJSON<ParsedQuery>(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      // Headroom for reasoning models (see retrieval.ts).
      { temperature: 0, maxTokens: 600 },
    );
    parsed.time_filter = resolveTimeFilter(parsed.time_filter);
    return parsed;
  } catch (err) {
    console.error("[queryParser] failed:", err);
    return {
      intent: "retrieve",
      rewritten_query: input,
      category_filter: null,
      time_filter: { type: null, range: null, from: null, to: null },
      entity_filter: null,
      aggregation: null,
    };
  }
}

const LEADING_QUESTION_WORDS =
  /^(what|which|who|whom|when|where|why|how|show|find|list|give|tell)( me)?\s+(did|do|does|was|were|is|are|have|has|had|can|could|would|should)\s+(i|my|we|our)?\s*/i;

/**
 * Cheap rule-based rewrite for follow-ups: a bare "compare to last month"
 * embeds poorly, so short follow-ups inherit the previous question's main
 * subject (e.g. "what did I read today" + "which one was longer" ->
 * "read today which one was longer"). Longer queries are already standalone.
 *
 * Limitation: this is a heuristic, not a real coreference rewrite — a cheap
 * model call that rewrites the follow-up into a standalone query would be
 * more robust (left as a follow-up).
 */
export function rewriteFollowUpForSearch(
  query: string,
  priorQueries: string[],
): string {
  const q = query.trim();
  if (priorQueries.length === 0 || q.split(/\s+/).length > 6) return query;
  const last = priorQueries[priorQueries.length - 1]
    .replace(/\?+\s*$/, "")
    .trim();
  if (!last) return query;
  const subject = last.replace(LEADING_QUESTION_WORDS, "").trim();
  const anchor = subject.length >= 3 ? subject : last;
  if (q.toLowerCase().includes(anchor.slice(0, 12).toLowerCase())) return query;
  return `${anchor} ${q}`.slice(0, 300);
}
