"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { classifyAndSave } from "@/lib/ai/classifier";

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
