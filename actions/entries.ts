"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadEntriesBefore } from "@/lib/entries";
import { applyEntryEdit, enrichEntryEdit, classifyAndSave } from "@/lib/ai/classifier";
import { EntryEditData, Entry } from "@/types";

export async function loadMoreEntries(
  before: string,
): Promise<{ ok: boolean; entries?: Entry[]; error?: string }> {
  if (!before) return { ok: false, error: "Missing cursor" };

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be logged in to load drops." };
  }

  try {
    const entries = await loadEntriesBefore(before);
    return { ok: true, entries };
  } catch (err) {
    console.error("[loadMoreEntries] failed:", err);
    return { ok: false, error: "Failed to load older drops" };
  }
}

export async function logEntry(
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Empty input" };

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be logged in to save entries." };
  }

  try {
    await classifyAndSave(sb, trimmed, user.id);
    revalidatePath("/home");
    return { ok: true };
  } catch (err) {
    console.error("[logEntry] failed:", err);
    return { ok: false, error: "Failed to log entry" };
  }
}

export async function updateEntry(
  id: string,
  data: EntryEditData,
): Promise<{ ok: boolean; error?: string }> {
  if (!id) return { ok: false, error: "Missing entry id" };
  if (!data.raw_text.trim()) return { ok: false, error: "Empty text" };

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be logged in to edit entries." };
  }

  try {
    // Fast write — apply the user's text + category immediately so the
    // action returns in <1s instead of blocking on the AI classify + embed.
    await applyEntryEdit(sb, id, user.id, data);
    revalidatePath("/home");
    revalidatePath("/categories");

    // Background AI pass: fill in entities, tags, amount, embedding, etc.
    after(async () => {
      try {
        const sb2 = await createClient();
        await enrichEntryEdit(sb2, id, user.id, data);
        revalidatePath("/home");
        revalidatePath("/categories");
      } catch (err) {
        console.error("[updateEntry] background enrichment failed:", err);
      }
    });

    return { ok: true };
  } catch (err) {
    console.error("[updateEntry] failed:", err);
    return { ok: false, error: "Failed to edit entry" };
  }
}

export async function deleteEntry(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!id) return { ok: false, error: "Missing entry id" };

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be logged in to delete entries." };
  }

  const { error } = await sb
    .from("entries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("[deleteEntry] failed:", error);
    return { ok: false, error: "Failed to delete entry" };
  }

  revalidatePath("/home");
  revalidatePath("/categories");
  return { ok: true };
}
