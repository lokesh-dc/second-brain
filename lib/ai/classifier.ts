import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ClassifierItem, ClassifierResult, EntityInput } from "@/types";
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
Output:`;

  return chatJSON<ClassifierResult>(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.1, maxTokens: 600 },
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
  const { data } = await sb
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", name)
    .single();

  if (data) return data.id;

  const { data: defaultCat } = await sb
    .from("categories")
    .select("id")
    .ilike("name", name)
    .eq("is_default", true)
    .limit(1)
    .single();

  return defaultCat?.id || null;
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

export async function classifyAndSave(
  sb: SupabaseClient,
  rawText: string,
  userId: string,
): Promise<void> {
  let result: ClassifierResult;

  try {
    result = await callClassifier(rawText);
  } catch (err) {
    console.error("[classifier] classification failed, using fallback:", err);
    result = {
      items: [
        {
          category: "misc",
          entities: [],
          amount: null,
          currency: null,
          summary: rawText,
          tags: ["misc"],
          embedding_doc: `[misc] | general | ${new Date()
            .toISOString()
            .split("T")[0]}\nSummary: ${rawText}`,
        },
      ],
    };
  }

  await Promise.all(result.items.map((item) => saveSingleItem(sb, item, rawText, userId)));
}
