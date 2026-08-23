import "server-only";
import { createClient } from "@/lib/supabase/server";
import { Entry } from "@/types";

const ENTRY_SELECT = `id, user_id, raw_text, summary, amount, currency, timestamp, tags,
  category:categories(id, name, icon, is_default),
  entry_entities(entity:entities(id, name, type))`;

type RawEntry = Entry & {
  entry_entities?: Array<{
    entity?: NonNullable<Entry["entities"]>[number];
  }>;
};

export function normalizeEntries(data: RawEntry[]): Entry[] {
  return data.map((row) => ({
    ...row,
    category:
      row.category && typeof row.category !== "string"
        ? (row.category as Entry["category"])
        : undefined,
    entities: row.entry_entities
      ?.map((ee) => ee.entity)
      .filter((e): e is NonNullable<typeof e> => Boolean(e)),
  }));
}

export async function loadEntries(limit = 200): Promise<Entry[]> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return [];

  const { data, error } = await sb
    .from("entries")
    .select(ENTRY_SELECT)
    .eq("user_id", user.id)
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.error("Error fetching entries:", error);
    return [];
  }

  return normalizeEntries(data as unknown as RawEntry[]);
}
