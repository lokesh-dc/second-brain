import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ClassifierItem,
  ClassifierResult,
  EntityInput,
  EntryEditData,
} from "@/types";
import { chatJSON, type ChatMessage } from "./groq";
import { generateEmbedding } from "./embeddings";
import { formatCategoryName } from "@/constants/categories";

async function callClassifier(
  text: string,
  hint?: string[],
  noExamples = false,
): Promise<ClassifierResult> {
  const today = new Date().toISOString().split("T")[0];

  const hintLine =
    hint && hint.length > 0
      ? `\nUser hint: the user thinks this looks like ${hint.join(", ")}. Prefer these categories when the text is ambiguous, but still split distinct facts (an event vs its cost) into separate items.`
      : "";

  const systemPrompt = `Classify this life log entry for a personal journal app.
If the user mentions multiple distinct facts, split them into logical groups.

Groups should be based on:
1. Different Categories (e.g., one 'reading' item and one 'expense' item).
2. Different expense types (e.g., group all groceries together, all electronics together).
3. An event and its cost are ALWAYS two separate items. E.g. "trip to Jibhi, bus fare 2500" must become one 'travel' item (amount null) AND one 'expense' item — never a single merged item. Costs belong only in 'expense' (or 'shopping') items; every other category gets amount null.

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
- Do the math: if the user gives a rate plus a quantity, record the COMPUTED TOTAL, not the rate. "2500 one way, return trip" means amount 5000. "800 per night, 3 nights" means 2400. Only multiply when the quantity is stated or clearly implied (return/round trip, nights, people); otherwise record the stated figure.
- Show the working in the summary: "Paid 5000 for return bus fare (2500 one way)."
- Places and people mentioned anywhere in the entry belong to EVERY item. If the trip is to Jibhi & Shoja, the travel item, the bus-fare item AND the hostel item must each list Jibhi and Shoja in their entities.
- Keep stated dates in the summary and embedding_doc: "Trip to Jibhi & Shoja, 2-5 Oct." Dates are part of the memory.
- Always include the specific item names and their individual costs (if provided) in the 'summary' and 'embedding_doc'.
- embedding_doc format: "[category] amount currency | item names | ${today}\\nSummary: list items and costs\\nTags: tag1, tag2"`;

  // Few-shot examples travel as real user/assistant turns (not one giant
  // user message) so the model learns the FORMAT without echoing the
  // example content as the answer.
  const groceryInput = `Input: "Spent 50 on milk, 40 on bread, 1000 on a keyboard and 300 on a mouse"`;
  const groceryOutput = `{
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
}`;

  const jibhiInput = `Input: "Had a trip to Jibhi & Shoja, bus fare was 2500 one way for the return trip, spent 2 Oct - 5 Oct there and the hostel fare was 1500 for 3 days". This is ONLY an example — never copy its places, amounts, or summaries into your answer.`;
  const jibhiOutput = `{
  "items": [
    {
      "category": "travel",
      "entities": [{"name": "Jibhi", "type": "place"}, {"name": "Shoja", "type": "place"}],
      "amount": null,
      "currency": null,
      "summary": "Trip to Jibhi & Shoja, 2-5 Oct.",
      "tags": ["travel", "mountains", "october"],
      "embedding_doc": "[travel] | Jibhi, Shoja | ${today}\\nSummary: Trip to Jibhi & Shoja, 2-5 Oct\\nTags: travel, mountains"
    },
    {
      "category": "expense",
      "entities": [{"name": "Jibhi", "type": "place"}, {"name": "Shoja", "type": "place"}],
      "amount": 5000,
      "currency": "INR",
      "summary": "Paid 5000 for return bus fare to Jibhi & Shoja (2500 one way).",
      "tags": ["travel", "bus", "transport"],
      "embedding_doc": "[expense] 5000 INR | bus fare, Jibhi, Shoja | ${today}\\nSummary: Paid 5000 for return bus fare (2500 one way)\\nTags: travel, bus"
    },
    {
      "category": "expense",
      "entities": [{"name": "Jibhi", "type": "place"}, {"name": "Shoja", "type": "place"}],
      "amount": 1500,
      "currency": "INR",
      "summary": "Paid 1500 for the 3-day hostel stay in Jibhi.",
      "tags": ["travel", "hostel", "stay"],
      "embedding_doc": "[expense] 1500 INR | hostel, Jibhi, Shoja | ${today}\\nSummary: Paid 1500 for the 3-day hostel stay\\nTags: travel, hostel"
    }
  ]
}`;

  const realInput =
    `Now classify this NEW input (it is NOT one of the examples above — never reuse example names, amounts, or summaries): "${text.replace(/"/g, "'")}"${hintLine}\n` +
    `Return ONLY the JSON object with an "items" key for the input above.`;

  const messages: ChatMessage[] = noExamples
    ? [
        { role: "system", content: systemPrompt },
        { role: "user", content: realInput },
      ]
    : [
        { role: "system", content: systemPrompt },
        { role: "user", content: groceryInput },
        { role: "assistant", content: groceryOutput },
        { role: "user", content: jibhiInput },
        { role: "assistant", content: jibhiOutput },
        { role: "user", content: realInput },
      ];

  return chatJSON<ClassifierResult>(messages, {
    temperature: 0.5,
    maxTokens: 2000,
  });
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
  // Normalize AI slugs ("expense") to display names ("Expenses") so newly
  // created categories are stored capitalized from the start.
  const display = formatCategoryName(name);
  const key = display.toLowerCase();

  // Compare normalized on both sides in JS: "expense" and "Expenses" (and
  // "idea"/"Ideas") resolve to the same row instead of creating duplicates.
  // One query replaces the old exact/fuzzy/default triple.
  const { data: cats, error: listError } = await sb
    .from("categories")
    .select("id, name")
    .eq("user_id", userId);

  if (listError) {
    console.error("[classifier] category list failed:", listError);
  } else {
    const hit = (cats ?? []).find(
      (c) => formatCategoryName(c.name).toLowerCase() === key,
    );
    if (hit) return hit.id;
  }

  // None of the user's categories match (e.g. a standard option like "Media"
  // the user hasn't hit yet) — create it so the entry keeps its category.
  const { data: created, error } = await sb
    .from("categories")
    .insert({ user_id: userId, name: display, is_default: true })
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

export async function classifyItems(rawText: string, hint?: string[]): Promise<ClassifierItem[]> {
  let result: ClassifierResult;

  try {
    result = await callClassifier(rawText, hint);
  } catch (err) {
    console.error("[classifier] classification failed, using fallback:", err);
    result = { items: [fallbackItem(rawText)] };
  }

  const valid = (r: ClassifierResult): ClassifierItem[] =>
    (r.items ?? []).filter(
      (item) => item && typeof item.category === "string",
    );

  let items = valid(result);

  // The model sometimes echoes a few-shot example (milk/keyboard) instead
  // of classifying. Retry once with the examples stripped; if it still
  // echoes, fall back to misc — honest raw text beats fake groceries.
  if (items.length > 0 && looksEchoed(rawText, items)) {
    console.error("[classifier] output echoes the examples, retrying bare");
    try {
      const retry = await callClassifier(rawText, hint, true);
      const retryItems = valid(retry);
      if (retryItems.length > 0 && !looksEchoed(rawText, retryItems)) {
        items = retryItems;
      }
    } catch (err) {
      console.error("[classifier] bare retry failed:", err);
    }
    if (looksEchoed(rawText, items)) return [fallbackItem(rawText)];
  }

  const withShared = propagateSharedEntities(items);
  return withShared.length === 0 ? [fallbackItem(rawText)] : withShared;
}

/**
 * True when NONE of the result's entities or amounts appear anywhere in
 * the input — i.e. the model regurgitated example content (groceries,
 * electronics) instead of classifying the user's text.
 */
function looksEchoed(input: string, items: ClassifierItem[]): boolean {
  const t = input.toLowerCase();
  let hasContent = false;
  for (const item of items) {
    for (const e of item.entities ?? []) {
      const name = e.name.trim().toLowerCase();
      if (!name) continue;
      hasContent = true;
      if (t.includes(name)) return false;
    }
    if (item.amount != null) {
      hasContent = true;
      if (t.includes(String(item.amount))) return false;
    }
  }
  return hasContent;
}

// Backstop for the "shared places" prompt rule: places, people and events
// mentioned in ANY split item are attached to EVERY item, so "trip to Jibhi
// + bus fare + hostel" keeps Jibhi on all three entries even if the model
// only listed it on the first. Item-specific entities (milk, keyboard) are
// never spread — only place/person/event types propagate.
const SHARED_ENTITY_TYPES = new Set(["place", "person", "event"]);

function propagateSharedEntities(items: ClassifierItem[]): ClassifierItem[] {
  const shared = new Map<string, EntityInput>();
  for (const item of items) {
    for (const e of item.entities ?? []) {
      const key = e.name.trim().toLowerCase();
      if (!key || shared.has(key)) continue;
      if (!SHARED_ENTITY_TYPES.has((e.type || "").toLowerCase())) continue;
      shared.set(key, { name: e.name.trim(), type: e.type.trim().toLowerCase() });
    }
  }
  if (shared.size === 0) return items;

  return items.map((item) => {
    const seen = new Set(
      (item.entities ?? []).map((e) => e.name.trim().toLowerCase()),
    );
    const missing = [...shared.values()].filter(
      (e) => !seen.has(e.name.toLowerCase()),
    );
    if (missing.length === 0) return item;
    return { ...item, entities: [...(item.entities ?? []), ...missing] };
  });
}

export async function classifyAndSave(
  sb: SupabaseClient,
  rawText: string,
  userId: string,
  hint?: string[],
): Promise<void> {
  const items = await classifyItems(rawText, hint);
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
  const categoryId = await getCategoryId(sb, formatCategoryName(data.category) || "Misc", userId);

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
