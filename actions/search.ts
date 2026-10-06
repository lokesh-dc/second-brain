"use server";

import { createClient } from "@/lib/supabase/server";
import { parseQuery } from "@/lib/ai/query-parser";
import { generateRetrievalAnswer } from "@/lib/ai/retrieval";
import { RetrievalAnswer, RetrievalHistoryTurn } from "@/types";

export async function askMind(
  question: string,
  history: RetrievalHistoryTurn[] = [],
): Promise<RetrievalAnswer | null> {
  const trimmed = question.trim();
  if (!trimmed) return null;

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) return null;

  const parsed = await parseQuery(trimmed);
  return generateRetrievalAnswer(sb, parsed, user.id, { history });
}
