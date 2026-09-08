"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2 } from "lucide-react";
import EntryCard from "./entry-card";
import EntrySheet from "./entry-sheet";
import InputBar from "./input-bar";
import RetrievalResult from "./retrieval-result";
import { askMind } from "@/actions/search";
import { Entry, RetrievalAnswer } from "@/types";

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

  // Filter entries based on AI response if available
  const displayEntries = aiResponse
    ? allEntries.filter((e) => aiResponse.entry_ids.includes(e.id))
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
      </header>

      {/* Results */}
      <div ref={listRef} className="px-5 md:px-8 md:columns-2 md:gap-3 [&>*]:mb-3">
        {displayEntries.length === 0 ? (
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
                  {aiResponse ? "no matching memories found" : "search your mind"}
                </h2>
                <p className="mt-2 text-sm text-[#cbd5e1]">
                  {aiResponse
                    ? "try a different query"
                    : "ask anything about your past entries"}
                </p>
              </>
            )}
          </div>
        ) : (
          displayEntries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onPress={() => {
                setSelectedEntry(entry);
                setSheetOpen(true);
              }}
            />
          ))
        )}
      </div>

      {/* AI answer overlay */}
      {aiResponse && (
        <div
          className="fixed inset-x-4 z-40 mx-auto max-w-lg md:left-auto md:right-8 md:top-6 md:mx-0 md:max-w-md"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 84px)" }}
        >
          <RetrievalResult
            answer={aiResponse.answer}
            entryCount={aiResponse.entry_ids.length}
            onClose={() => setAiResponse(null)}
            onPress={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          />
        </div>
      )}

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
      />
    </main>
  );
}
