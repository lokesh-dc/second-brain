"use server";

import { createClient } from "@/lib/supabase/server";

export interface SetupInput {
  fullName?: string;
  selectedCategories?: string[];
  customCategories?: string[];
  books?: string[];
  projects?: string[];
  skip?: boolean;
}

export async function completeSetup(
  input: SetupInput,
): Promise<{ ok: boolean; error?: string }> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) return { ok: false, error: "Not signed in" };

  try {
    // 1. Update user_profiles
    const { error: profileError } = await sb.from("user_profiles").upsert({
      id: user.id,
      full_name: input.fullName?.trim() || null,
      setup_complete: true,
      default_categories: input.selectedCategories ?? [],
    });
    if (profileError) throw profileError;

    if (!input.skip) {
      // 2. Save books as entities
      if (input.books && input.books.length > 0) {
        await sb.from("entities").insert(
          input.books.map((book) => ({
            user_id: user.id,
            name: book,
            type: "book",
          })),
        );
      }

      // 3. Save projects as entities
      if (input.projects && input.projects.length > 0) {
        await sb.from("entities").insert(
          input.projects.map((proj) => ({
            user_id: user.id,
            name: proj,
            type: "project",
          })),
        );
      }

      // 4. Save custom categories
      if (input.customCategories && input.customCategories.length > 0) {
        await sb.from("categories").insert(
          input.customCategories.map((cat) => ({
            user_id: user.id,
            name: cat,
            is_default: true,
            icon: "Hash",
          })),
        );
      }
    }

    return { ok: true };
  } catch (err) {
    console.error("[completeSetup] failed:", err);
    return { ok: false, error: "Failed to save setup" };
  }
}

export async function signOut(): Promise<void> {
  const sb = await createClient();
  await sb.auth.signOut();
}
