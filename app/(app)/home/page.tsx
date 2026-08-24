import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { loadEntries } from "@/lib/entries";
import EntriesFeed from "@/components/entries-feed";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  let firstName = "there";
  if (user) {
    const { data: profile } = await sb
      .from("user_profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    if (profile?.full_name) {
      firstName = profile.full_name.split(" ")[0];
    }
  }

  const entries = await loadEntries();
  const dateLabel = format(new Date(), "EEEE, d MMMM");

  return (
    <EntriesFeed
      firstName={firstName}
      dateLabel={dateLabel}
      initialEntries={entries}
    />
  );
}
