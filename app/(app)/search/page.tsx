import { loadEntries } from "@/lib/entries";
import SearchScreen from "@/components/search-screen";

export const dynamic = "force-dynamic";

export default async function SearchPage() {
  const entries = await loadEntries();
  return <SearchScreen allEntries={entries} />;
}
