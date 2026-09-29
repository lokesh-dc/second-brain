import { loadCategoriesWithCounts } from "@/lib/categories";
import { loadEntries } from "@/lib/entries";
import CategoriesScreen from "@/components/categories-screen";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const [categories, entries] = await Promise.all([
    loadCategoriesWithCounts(),
    loadEntries(),
  ]);

  return <CategoriesScreen categories={categories} entries={entries} />;
}
