"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import EntryCard from "./entry-card";
import EntrySheet from "./entry-sheet";
import InputBar from "./input-bar";
import AnswerCard, { AnswerCardSkeleton, AnswerErrorCard } from "./answer-card";
import { useAskThread } from "./search-thread-provider";
import { updateEntry, deleteEntry } from "@/actions/entries";
import { Entry, EntryEditData, ThreadTurn } from "@/types";

interface SearchScreenProps {
  allEntries: Entry[];
}

function TurnBlock({
  turn,
  isLatest,
  isAsking,
  entries,
  onFollowup,
  onRetry,
  onOpenEntry,
}: {
  turn: ThreadTurn;
  isLatest: boolean;
  isAsking: boolean;
  entries: Entry[];
  onFollowup: (query: string) => void;
  onRetry: () => void;
  onOpenEntry: (entry: Entry) => void;
}) {
  return (
    <div id={`turn-${turn.id}`} className="scroll-mt-4 space-y-3">
      <p className="truncate text-[13px] text-ink-3">
        <span className="font-semibold text-ink-2">You asked: </span>
        {turn.query}
      </p>
      {turn.status === "loading" && <AnswerCardSkeleton />}
      {turn.status === "error" && <AnswerErrorCard onRetry={onRetry} />}
      {turn.status === "done" && (
        <>
          <AnswerCard
            answer={turn.answer}
            followups={turn.followups}
            chipsEnabled={isLatest && !isAsking}
            onFollowup={onFollowup}
          />
          {entries.length > 0 && (
            <div className="space-y-3">
              <p className="pt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">
                {entries.length} {entries.length === 1 ? "Source" : "Sources"}
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {entries.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    onPress={() => onOpenEntry(entry)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SearchScreen({ allEntries }: SearchScreenProps) {
  const router = useRouter();
  const { turns, hasTurns, isAsking, ask, retry, clear, setEntriesCache } =
    useAskThread();

  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Keep the provider's id -> entry cache fresh so new answers resolve.
  useEffect(() => {
    setEntriesCache(allEntries);
  }, [allEntries, setEntriesCache]);

  // Auto-scroll to the newest turn when it is added or finishes.
  const lastTurn = turns.length > 0 ? turns[turns.length - 1] : null;
  const lastTurnKey = lastTurn ? `${lastTurn.id}:${lastTurn.status}` : null;
  useEffect(() => {
    if (!lastTurnKey) return;
    const id = lastTurnKey.split(":")[0];
    const el = document.getElementById(`turn-${id}`);
    if (!el) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "end",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns.length, lastTurnKey]);

  // Resolve each turn's cited ids against fresh entries first (so edits show
  // up), falling back to the snapshot stored with the turn. Ids missing from
  // both (e.g. deleted entries) are dropped from sources.
  const entriesByTurn = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const turn of turns) {
      map.set(
        turn.id,
        turn.entryIds.flatMap(
          (id) =>
            allEntries.find((e) => e.id === id) ??
            turn.entries.find((e) => e.id === id) ??
            [],
        ),
      );
    }
    return map;
  }, [turns, allEntries]);

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

  const handleSearch = (text: string) => {
    void ask(text);
  };

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
        {hasTurns && (
          <button
            onClick={clear}
            aria-label="New search"
            className="ml-auto rounded-full px-3 py-2 text-sm font-semibold text-ink-2 transition-colors hover:bg-hairline hover:text-ink"
          >
            New search
          </button>
        )}
      </header>

      {/* Thread: each turn is an answer followed by its sources */}
      <div className="space-y-6 px-5 md:px-8">
        {!hasTurns && !isAsking ? (
          <div className="flex flex-col items-center pt-32 text-center">
            <h2 className="text-lg font-semibold text-[#94a3b8]">
              search your mind
            </h2>
            <p className="mt-2 text-sm text-[#cbd5e1]">
              ask anything about your past entries
            </p>
          </div>
        ) : (
          turns.map((turn, i) => (
            <TurnBlock
              key={turn.id}
              turn={turn}
              isLatest={i === turns.length - 1}
              isAsking={isAsking}
              entries={entriesByTurn.get(turn.id) ?? []}
              onFollowup={handleSearch}
              onRetry={() => void retry(turn.id)}
              onOpenEntry={(entry) => {
                setSelectedEntry(entry);
                setSheetOpen(true);
              }}
            />
          ))
        )}
      </div>

      {/* Input */}
      <div
        className="fixed inset-x-4 z-50 mx-auto max-w-lg md:inset-x-auto md:left-[var(--sidebar-w)] md:right-0 md:mx-auto md:max-w-4xl md:px-8"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
      >
        <InputBar
          onSubmit={handleSearch}
          isLoading={isAsking}
          forceSearchMode
          placeholder={
            hasTurns ? "Ask a follow-up..." : "Ask your mind anything..."
          }
        />
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
