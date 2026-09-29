import "server-only";
import { createClient } from "@/lib/supabase/server";
import { Category } from "@/types";

export type CategoryWithCount = Category & { entryCount: number };

/**
 * Load the user's categories with total entry counts.
 * Counts come from a lightweight id-only query so they reflect the full
 * history, not just the recent-entries window used for display.
 */
export async function loadCategoriesWithCounts(): Promise<CategoryWithCount[]> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return [];

  const [{ data: cats }, { data: ids }] = await Promise.all([
    sb
      .from("categories")
      .select("id, user_id, name, icon, is_default")
      .eq("user_id", user.id)
      .order("name"),
    sb
      .from("entries")
      .select("category_id")
      .eq("user_id", user.id)
      .limit(5000),
  ]);

  const counts = new Map<string, number>();
  for (const row of (ids ?? []) as Array<{ category_id: string | null }>) {
    if (!row.category_id) continue;
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
  }

  return ((cats ?? []) as Category[]).map((c) => ({
    ...c,
    entryCount: counts.get(c.id) ?? 0,
  }));
}
