import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { endOfDay, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { Digest, DigestPeriod, DigestRawData, Entry } from "@/types";
import { chatText } from "./groq";

function getRange(p: DigestPeriod) {
  const now = new Date();
  const end = endOfDay(now);

  let start: Date;
  if (p === "today") {
    start = startOfDay(now);
  } else if (p === "week") {
    start = startOfWeek(now, { weekStartsOn: 1 }); // Monday
  } else {
    start = startOfMonth(now);
  }

  return { start: start.toISOString(), end: end.toISOString() };
}

async function aggregateData(
  sb: SupabaseClient,
  userId: string,
  start: string,
  end: string,
): Promise<DigestRawData> {
  const { data: entries, error } = await sb
    .from("entries")
    .select(
      `id, raw_text, summary, amount, currency, timestamp,
       category:categories(id, name),
       entry_entities(entity:entities(id, name))`,
    )
    .eq("user_id", userId)
    .gte("timestamp", start)
    .lte("timestamp", end);

  if (error) throw error;
  if (!entries || entries.length === 0) {
    return { entryCountByCategory: {}, totalAmountByCategory: {} };
  }

  const typedEntries = entries as unknown as Array<
    Entry & { entry_entities?: Array<{ entity?: { name: string } }> }
  >;

  const entryCountByCategory: Record<string, number> = {};
  const totalAmountByCategory: Record<string, number> = {};
  let biggestExpense: DigestRawData["biggestExpense"] = undefined;

  typedEntries.forEach((entry) => {
    const catName =
      (entry.category && typeof entry.category !== "string"
        ? entry.category.name
        : "") || "misc";
    entryCountByCategory[catName] = (entryCountByCategory[catName] || 0) + 1;

    if (catName.toLowerCase().includes("expense") && entry.amount) {
      totalAmountByCategory[catName] =
        (totalAmountByCategory[catName] || 0) + entry.amount;
      if (!biggestExpense || entry.amount > biggestExpense.amount) {
        biggestExpense = {
          amount: entry.amount,
          currency: entry.currency || "INR",
          summary: entry.summary || entry.raw_text,
          timestamp: entry.timestamp,
        };
      }
    }
  });

  // Top Entity logic
  const entityCounts: Record<string, number> = {};
  typedEntries.forEach((entry) => {
    entry.entry_entities?.forEach((ee) => {
      if (!ee.entity) return;
      entityCounts[ee.entity.name] = (entityCounts[ee.entity.name] || 0) + 1;
    });
  });

  let topEntity: DigestRawData["topEntity"] = undefined;
  Object.entries(entityCounts).forEach(([name, count]) => {
    if (!topEntity || count > topEntity.count) {
      topEntity = { name, count };
    }
  });

  return {
    entryCountByCategory,
    totalAmountByCategory,
    biggestExpense,
    topEntity,
  };
}

async function generateNarrative(
  rawData: DigestRawData,
  p: DigestPeriod,
): Promise<string> {
  const stats = {
    period: p,
    categories: rawData.entryCountByCategory,
    totals: rawData.totalAmountByCategory,
    top_expense: rawData.biggestExpense,
    top_entity: rawData.topEntity,
  };

  const prompt = `You are a friendly personal AI summarising the user's life logs for ${p}. Be warm, specific, and concise. Tone: smart friend recapping your day/week/month — not robotic.

Aggregated data:
${JSON.stringify(stats, null, 2)}

Rules:
- 2–3 sentences paragraph
- No bullet points
- No markdown
- Be specific about what they did (reading, spending, ideas, etc.)
- Use the provided amounts and entity names naturally.`;

  return chatText(
    [
      {
        role: "system",
        content: "You are a warm, helpful personal log summarizer.",
      },
      { role: "user", content: prompt },
    ],
    // Reasoning models (gpt-oss) spend completion tokens thinking — a 200
    // budget 400s with "max completion tokens reached", which surfaced as
    // an eternally empty briefing. Headroom for thinking + 2-3 sentences.
    { temperature: 0.7, maxTokens: 1000 },
  );
}

export async function getDigest(
  sb: SupabaseClient,
  period: DigestPeriod,
  forceRegenerate = false,
): Promise<Digest> {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // 1. Check Supabase cache. A cached digest is fresh only if ALL hold:
  //   - generated <24h ago (backstop),
  //   - generated inside the current period window (a "today" digest from
  //     yesterday evening must not serve as today's briefing),
  //   - no entries logged since generation (new drops invalidate it).
  const range = getRange(period);
  if (!forceRegenerate) {
    const { data: dbDigest } = await sb
      .from("digests")
      .select("*")
      .eq("user_id", user.id)
      .eq("period", period)
      .maybeSingle();

    if (dbDigest) {
      const generatedAt = new Date(dbDigest.generated_at).getTime();
      const ageInHours = (Date.now() - generatedAt) / (1000 * 60 * 60);
      const predatesWindow = generatedAt < new Date(range.start).getTime();
      if (ageInHours < 24 && !predatesWindow) {
        const { count: newerCount } = await sb
          .from("entries")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gt("timestamp", dbDigest.generated_at);
        if (!newerCount) return dbDigest as Digest;
      }
    }
  }

  // 2. Regenerate
  const rawData = await aggregateData(sb, user.id, range.start, range.end);

  const hasEntries = Object.keys(rawData.entryCountByCategory).length > 0;
  let narrative = "Nothing logged yet — drop a thought to get started";

  if (hasEntries) {
    narrative = await generateNarrative(rawData, period);
  }

  const newDigest = {
    user_id: user.id,
    period,
    narrative,
    raw_data: rawData,
    generated_at: new Date().toISOString(),
  };

  const { data: upserted, error } = await sb
    .from("digests")
    .upsert(newDigest, { onConflict: "user_id,period" })
    .select()
    .single();

  if (error) throw error;
  return upserted as Digest;
}
