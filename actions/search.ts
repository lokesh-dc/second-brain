"use server";

import { createClient } from "@/lib/supabase/server";
import { parseQuery, rewriteFollowUpForSearch } from "@/lib/ai/query-parser";
import { generateRetrievalAnswer } from "@/lib/ai/retrieval";
import { AskHistoryTurn, RetrievalAnswer } from "@/types";

export async function askMind(
  question: string,
  history: AskHistoryTurn[] = [],
): Promise<RetrievalAnswer | null> {
  const trimmed = question.trim();
  if (!trimmed) return null;

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) return null;

  // Previous 4-6 turns travel with every follow-up as conversation context.
  const recent = history
    .filter((t) => t.query.trim().length > 0)
    .slice(-6);
  const searchText = rewriteFollowUpForSearch(
    trimmed,
    recent.map((t) => t.query),
  );
  const parsed = await parseQuery(searchText);

  // The previous turn's cited entries are unioned back into model context
  // (see generateRetrievalAnswer), so follow-ups stay grounded.
  const priorEntryIds =
    recent.length > 0 ? (recent[recent.length - 1].entryIds ?? []) : [];

  return generateRetrievalAnswer(sb, parsed, user.id, {
    history: recent.map(({ query, answer }) => ({ query, answer })),
    priorEntryIds,
    originalQuery: trimmed,
  });
}
