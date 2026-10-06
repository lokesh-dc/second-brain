"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import EntryCard from "./entry-card";
import EntrySheet from "./entry-sheet";
import InputBar from "./input-bar";
import AnswerCard from "./answer-card";
import { askMind } from "@/actions/search";
import { updateEntry, deleteEntry } from "@/actions/entries";
import { Entry, EntryEditData, RetrievalAnswer } from "@/types";

interface SearchScreenProps {
  allEntries: Entry[];
}

export default function SearchScreen({ allEntries }: SearchScreenProps) {
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<RetrievalAnswer | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleDelete = async (id: string) => {
    const { ok, error } = await deleteEntry(id);

    if (!ok) {
      toast.error(error || "Failed to delete entry");
      return;
    }

    setSheetOpen(false);
    setSelectedEntry(null);
    toast.success("Entry deleted");
    router.refresh();
  };

  const handleEdit = async (id: string, data: EntryEditData) => {
    const { ok, error } = await updateEntry(id, data);

    if (!ok) {
      toast.error(error || "Failed to edit entry");
      return;
    }

    const fallbackCategory = {
      id: data.category.toLowerCase(),
      user_id: "",
      name: data.category,
      is_default: true,
    };

    setSelectedEntry((prev) =>
      prev
        ? {
            ...prev,
            raw_text: data.raw_text,
            summary: data.summary,
            amount: data.amount ?? prev.amount,
            currency: data.currency ?? prev.currency,
            tags: data.tags,
            category:
              prev.category?.name?.toLowerCase() === data.category.toLowerCase()
                ? prev.category
                : fallbackCategory,
            entities: data.entities.map((e, i) => ({
              id: `${prev.id}-${i}`,
              user_id: "",
              name: e.name,
              type: e.type,
            })),
          }
        : prev,
    );

    toast.success("Entry updated");
    router.refresh();
  };
  const [, startTransition] = useTransition();

  const handleSearch = (text: string) => {
    if (!text.trim()) return;
    setIsLoading(true);
    startTransition(async () => {
      try {
        const response = await askMind(text);
        if (response) {
          setAiResponse(response);
          // Scroll to top where the results are
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } catch {
        console.error("Search error");
      } finally {
        setIsLoading(false);
      }
    });
  };

  // Filter entries based on AI response if available (model order kept)
  const displayEntries = aiResponse
    ? aiResponse.entry_ids.flatMap(
        (id) => allEntries.find((e) => e.id === id) ?? [],
      )
    : [];

  return (
    <main className="mx-auto min-h-dvh max-w-lg pb-32 md:max-w-4xl md:pb-16">
      {/* Header */}
      <header className="flex items-center px-5 py-4 md:px-8">
        <button
          onClick={() => router.back()}
          className="mr-2 p-1 md:hidden"
          aria-label="Go back"
        >
          <ChevronLeft size={28} className="text-ink" />
        </button>
        <h1 className="font-display text-[28px]">Search</h1>
        {/* Clears the whole thread. Only visible when a thread exists. */}
        {aiResponse && (
          <button
            onClick={() => setAiResponse(null)}
            aria-label="New search"
            className="ml-auto rounded-full px-3 py-2 text-sm font-semibold text-ink-2 transition-colors hover:bg-hairline hover:text-ink"
          >
            New search
          </button>
        )}
      </header>

      {/* Results: answer first, evidence below */}
      <div ref={listRef} className="space-y-3 px-5 md:px-8">
        {!aiResponse ? (
          <div className="flex flex-col items-center pt-32 text-center">
            {isLoading ? (
              <>
                <Loader2 size={36} className="animate-spin text-brand" />
                <p className="mt-6 text-sm text-[#94a3b8]">
                  digging through your memories...
                </p>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-[#94a3b8]">
                  search your mind
                </h2>
                <p className="mt-2 text-sm text-[#cbd5e1]">
                  ask anything about your past entries
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <AnswerCard
              answer={aiResponse.answer}
              followups={aiResponse.followups}
              chipsEnabled={!isLoading}
              onFollowup={handleSearch}
            />
            {displayEntries.length > 0 && (
              <>
                <p className="pt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">
                  {displayEntries.length}{" "}
                  {displayEntries.length === 1 ? "Source" : "Sources"}
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  {displayEntries.map((entry) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      onPress={() => {
                        setSelectedEntry(entry);
                        setSheetOpen(true);
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div
        className="fixed inset-x-4 z-50 mx-auto max-w-lg md:inset-x-auto md:left-[var(--sidebar-w)] md:right-0 md:mx-auto md:max-w-4xl md:px-8"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
      >
        <InputBar onSubmit={handleSearch} isLoading={isLoading} forceSearchMode />
      </div>

      <EntrySheet
        entry={selectedEntry}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onDelete={handleDelete}
        onEdit={handleEdit}
      />
    </main>
  );
}
