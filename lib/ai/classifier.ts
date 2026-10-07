import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ClassifierItem,
  ClassifierResult,
  EntityInput,
  EntryEditData,
} from "@/types";
import { chatJSON } from "./groq";
import { generateEmbedding } from "./embeddings";

async function callClassifier(text: string): Promise<ClassifierResult> {
  const today = new Date().toISOString().split("T")[0];

  const systemPrompt = `Classify this life log entry for a personal journal app.
If the user mentions multiple distinct facts or a list of items, split them into logical groups.

Groups should be based on:
1. Different Categories (e.g., one 'reading' item and one 'expense' item).
2. Different expense types (e.g., group all groceries together, all electronics together).

Return ONLY valid JSON. No explanation. No markdown.

Categories: expense, reading, travel, idea, shopping, health, media, misc.

Schema:
{"items": [{
  "category":"string",
  "entities":[{"name":"string","type":"book|place|person|brand|project|product|movie|tv_show|song|game|app|event|course"}],
  "amount":number|null,
  "currency":"INR|USD|EUR|null",
  "summary":"one sentence past tense listing items",
  "tags":["2 to 4 lowercase tags"],
  "embedding_doc":"string"
}]}

Rules for items:
- If user lists many groceries and a few electronics, create TWO 'expense' items.
- Item 1 summary: "Bought groceries: milk (50), bread (40), eggs (60)." (Total amount: 150)
- Item 2 summary: "Bought electronics: charger (500), cable (200)." (Total amount: 700)
- Always include the specific item names and their individual costs (if provided) in the 'summary' and 'embedding_doc'.
- embedding_doc format: "[category] amount currency | item names | ${today}\\nSummary: list items and costs\\nTags: tag1, tag2"`;

  const userPrompt = `Input: "Spent 50 on milk, 40 on bread, 1000 on a keyboard and 300 on a mouse"
Output: {
  "items": [
    {
      "category": "expense",
      "entities": [{"name": "milk", "type": "product"}, {"name": "bread", "type": "product"}],
      "amount": 90,
      "currency": "INR",
      "summary": "Bought groceries: milk (50) and bread (40).",
      "tags": ["groceries", "food", "daily"],
      "embedding_doc": "[expense] 90 INR | milk, bread | ${today}\\nSummary: Bought milk (50) and bread (40)\\nTags: groceries, food"
    },
    {
      "category": "expense",
      "entities": [{"name": "keyboard", "type": "product"}, {"name": "mouse", "type": "product"}],
      "amount": 1300,
      "currency": "INR",
      "summary": "Bought electronics: keyboard (1000) and mouse (300).",
      "tags": ["electronics", "tech", "accessories"],
      "embedding_doc": "[expense] 1300 INR | keyboard, mouse | ${today}\\nSummary: Bought keyboard (1000) and mouse (300)\\nTags: electronics, tech"
    }
  ]
}

Input: "${text.replace(/"/g, "'")}"
Output: Return a top-level object with an "items" key per the schema above.`;

  return chatJSON<ClassifierResult>(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.5, maxTokens: 2000 },
  );
}

async function upsertEntity(
  sb: SupabaseClient,
  entity: EntityInput,
  userId: string,
): Promise<string | null> {
  const type = entity.type.toLowerCase();

  try {
    const { data: existing } = await sb
      .from("entities")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", entity.name)
      .eq("type", type)
      .maybeSingle();

    if (existing) return existing.id;

    const { data: created, error } = await sb
      .from("entities")
      .insert({ user_id: userId, name: entity.name, type })
      .select("id")
      .single();

    if (error) {
      console.error("[classifier] entity upsert failed:", error);
      return null;
    }
    return created.id;
  } catch (err) {
    console.error("[classifier] unexpected entity error:", err);
    return null;
  }
}

async function getCategoryId(
  sb: SupabaseClient,
  name: string,
  userId: string,
): Promise<string | null> {
  const { data: exact } = await sb
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", name)
    .maybeSingle();
  if (exact) return exact.id;

  // 2. Substring match — display names like "Expenses"/"Ideas" vs slugs.
  const { data: fuzzy } = await sb
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", `%${name}%`)
    .limit(1)
    .maybeSingle();
  if (fuzzy) return fuzzy.id;

  const { data: defaultCat } = await sb
    .from("categories")
    .select("id")
    .ilike("name", `%${name}%`)
    .eq("is_default", true)
    .limit(1)
    .maybeSingle();

  if (defaultCat) return defaultCat.id;

  // None of the user's categories match (e.g. a standard option like "Media"
  // the user hasn't hit yet) — create it so the entry keeps its category.
  const { data: created, error } = await sb
    .from("categories")
    .insert({ user_id: userId, name, is_default: true })
    .select("id")
    .single();

  if (error || !created) {
    console.error("[classifier] category create failed:", error);
    return null;
  }
  return created.id;
}

async function saveSingleItem(
  sb: SupabaseClient,
  item: ClassifierItem,
  rawText: string,
  userId: string,
) {
  const categoryId = await getCategoryId(sb, item.category, userId);

  let embedding: number[] | null = null;
  try {
    const result = await generateEmbedding(item.embedding_doc);
    if (result) embedding = result;
  } catch (err) {
    console.error("[classifier] embedding failed for item:", err);
  }

  const { data: entry, error: entryError } = await sb
    .from("entries")
    .insert({
      user_id: userId,
      raw_text: rawText,
      category_id: categoryId,
      summary: item.summary,
      amount: item.amount,
      currency: item.currency,
      tags: item.tags,
      embedding_doc: item.embedding_doc,
      embedding,
    })
    .select("id")
    .single();

  if (entryError || !entry) {
    console.error("[classifier] entry insert failed:", entryError);
    return;
  }

  if (item.entities.length > 0) {
    const entityIds = await Promise.all(
      item.entities.map((e) => upsertEntity(sb, e, userId)),
    );

    const links = entityIds
      .filter((id): id is string => id !== null)
      .map((entityId) => ({ entry_id: entry.id, entity_id: entityId }));

    if (links.length > 0) {
      const { error: linkError } = await sb
        .from("entry_entities")
        .insert(links);

      if (linkError) {
        console.error("[classifier] entry_entities insert failed:", linkError);
      }
    }
  }
}

export async function classifyItems(rawText: string): Promise<ClassifierItem[]> {
  let result: ClassifierResult;

  try {
    result = await callClassifier(rawText);
  } catch (err) {
    console.error("[classifier] classification failed, using fallback:", err);
    result = { items: [fallbackItem(rawText)] };
  }

  const items = (result.items ?? []).filter(
    (item) => item && typeof item.category === "string",
  );

  return items.length === 0 ? [fallbackItem(rawText)] : items;
}

export async function classifyAndSave(
  sb: SupabaseClient,
  rawText: string,
  userId: string,
): Promise<void> {
  const items = await classifyItems(rawText);
  await Promise.all(items.map((item) => saveSingleItem(sb, item, rawText, userId)));
}

function buildEmbeddingDoc(data: EntryEditData): string {
  const today = new Date().toISOString().split("T")[0];
  const entityNames = data.entities.map((e) => e.name).join(", ") || "general";
  return `[${data.category}] ${data.amount ?? ""} ${data.currency ?? ""} | ${entityNames} | ${today}\nSummary: ${data.summary || data.raw_text}\nTags: ${data.tags.join(", ")}`;
}

// Fast, synchronous part of an edit save — just the text and category the
// user edited. Runs immediately so Save never blocks on the AI.
export async function applyEntryEdit(
  sb: SupabaseClient,
  entryId: string,
  userId: string,
  data: EntryEditData,
): Promise<void> {
  const categoryId = await getCategoryId(sb, data.category.trim() || "Misc", userId);

  const { error } = await sb
    .from("entries")
    .update({
      raw_text: data.raw_text.trim(),
      ...(categoryId ? { category_id: categoryId } : {}),
    })
    .eq("id", entryId)
    .eq("user_id", userId);

  if (error) {
    console.error("[classifier] entry update (fast) failed:", error);
    throw error;
  }
}

// Background AI pass after the fast save: re-classifies the edited text,
// keeps the user's chosen category, and fills in entities, tags, amount,
// summary, currency and the embedding. Best-effort — never throws.
export async function enrichEntryEdit(
  sb: SupabaseClient,
  entryId: string,
  userId: string,
  data: EntryEditData,
): Promise<void> {
  try {
    const ai = (await classifyItems(data.raw_text))[0];

    const merged: EntryEditData = {
      raw_text: data.raw_text.trim(),
      category: data.category.trim() || ai.category,
      summary: data.summary.trim() || ai.summary,
      amount: data.amount != null ? data.amount : ai.amount,
      currency: data.currency || ai.currency || null,
      tags: data.tags.length > 0 ? data.tags : ai.tags,
      entities: mergeEntities(data.entities, ai.entities),
    };

    const categoryId = await getCategoryId(sb, merged.category, userId);

    const embeddingDoc = buildEmbeddingDoc(merged);
    let embedding: number[] | null = null;
    try {
      const result = await generateEmbedding(embeddingDoc);
      if (result) embedding = result;
    } catch (err) {
      console.error("[classifier] embedding failed on edit:", err);
    }

    const { error: updateError } = await sb
      .from("entries")
      .update({
        ...(categoryId ? { category_id: categoryId } : {}),
        summary: merged.summary,
        amount: merged.amount,
        currency: merged.currency,
        tags: merged.tags,
        embedding_doc: embeddingDoc,
        embedding,
      })
      .eq("id", entryId)
      .eq("user_id", userId);

    if (updateError) {
      console.error("[classifier] entry enrichment failed:", updateError);
      return;
    }

    const { error: unlinkError } = await sb
      .from("entry_entities")
      .delete()
      .eq("entry_id", entryId);

    if (unlinkError) {
      console.error("[classifier] entry_entities unlink failed:", unlinkError);
    }

    if (merged.entities.length > 0) {
      const entityIds = await Promise.all(
        merged.entities.map((e) => upsertEntity(sb, e, userId)),
      );

      const links = entityIds
        .filter((id): id is string => id !== null)
        .map((entityId) => ({ entry_id: entryId, entity_id: entityId }));

      if (links.length > 0) {
        const { error: linkError } = await sb
          .from("entry_entities")
          .insert(links);

        if (linkError) {
          console.error("[classifier] entry_entities relink failed:", linkError);
        }
      }
    }
  } catch (err) {
    console.error("[classifier] edit enrichment failed:", err);
  }
}

function mergeEntities(
  user: EntityInput[],
  ai: EntityInput[],
): EntityInput[] {
  const seen = new Set<string>();
  const merged: EntityInput[] = [];

  for (const e of [...user, ...ai]) {
    if (!e.name.trim()) continue;
    const key = e.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      name: e.name.trim(),
      type: e.type.trim().toLowerCase() || "misc",
    });
  }

  return merged;
}

function fallbackItem(rawText: string): ClassifierItem {
  const today = new Date().toISOString().split("T")[0];
  return {
    category: "misc",
    entities: [],
    amount: null,
    currency: null,
    summary: rawText,
    tags: ["misc"],
    embedding_doc: `[misc] | general | ${today}\nSummary: ${rawText}`,
  };
}
