"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import EntrySheet from "./entry-sheet";
import InputBar from "./input-bar";
import AnswerCard, { AnswerCardSkeleton, AnswerErrorCard } from "./answer-card";
import SourcesDialog from "./sources-dialog";
import { useAskThread } from "./search-thread-provider";
import { updateEntry, deleteEntry } from "@/actions/entries";
import { Entry, EntryEditData, ThreadTurn } from "@/types";

interface SearchScreenProps {
  allEntries: Entry[];
}

function TurnBlock({
  turn,
  sourceCount,
  onViewSources,
  onRetry,
}: {
  turn: ThreadTurn;
  sourceCount: number;
  onViewSources: () => void;
  onRetry: () => void;
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
          <AnswerCard answer={turn.answer} breakdown={turn.breakdown} />
          {sourceCount > 0 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onViewSources}
                aria-label={`View ${sourceCount} ${sourceCount === 1 ? "drop" : "drops"}`}
                className="flex items-center gap-0.5 px-1 py-1 text-[13px] font-medium text-ink-3 transition-colors hover:text-ink"
              >
                <span>
                  {sourceCount} {sourceCount === 1 ? "Drop" : "Drops"}
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FollowupBar({
  followups,
  onFollowup,
}: {
  followups: string[];
  onFollowup: (query: string) => void;
}) {
  if (followups.length === 0) return null;

  return (
    <div className="mb-2 flex gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {followups.map((chip) => (
        <button
          key={chip}
          type="button"
          onClick={() => onFollowup(chip)}
          aria-label={`Send follow-up: ${chip}`}
          className="shrink-0 rounded-full border border-line bg-white px-3.5 py-1.5 text-[13px] font-medium text-ink-2 shadow-sm transition-colors hover:border-brand/50 hover:text-ink"
        >
          {chip}
        </button>
      ))}
    </div>
  );
}

export default function SearchScreen({ allEntries }: SearchScreenProps) {
  const router = useRouter();
  const { turns, hasTurns, isAsking, ask, retry, clear, setEntriesCache } =
    useAskThread();

  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sourcesTurnId, setSourcesTurnId] = useState<string | null>(null);

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
  }, [lastTurnKey]);

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

  const handleOpenEntry = (entry: Entry) => {
    // The entry sheet (z-40/z-50) opens above the sources dialog (z-30),
    // so the two dialogs visibly stack.
    setSelectedEntry(entry);
    setSheetOpen(true);
  };

  // Follow-ups live above the input field and always reflect the latest
  // finished turn. Hidden while an answer is loading or when empty.
  const lastDoneTurn =
    turns.length > 0 && turns[turns.length - 1].status === "done"
      ? turns[turns.length - 1]
      : null;
  const visibleFollowups =
    !isAsking && lastDoneTurn ? lastDoneTurn.followups : [];

  const dialogEntries =
    sourcesTurnId != null ? (entriesByTurn.get(sourcesTurnId) ?? []) : [];

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
          turns.map((turn) => (
            <TurnBlock
              key={turn.id}
              turn={turn}
              sourceCount={(entriesByTurn.get(turn.id) ?? []).length}
              onViewSources={() => setSourcesTurnId(turn.id)}
              onRetry={() => void retry(turn.id)}
            />
          ))
        )}
      </div>

      {/* Input + follow-ups docked above it, frosted so cards scrolling
          underneath don't visually merge with them */}
      <div className="fixed inset-x-0 bottom-0 z-50 md:left-[var(--sidebar-w)]">
        <div className="bg-gradient-to-t from-paper via-paper/90 to-transparent px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-8 backdrop-blur-[2px] md:px-8">
          <div className="mx-auto max-w-lg md:max-w-4xl">
            <FollowupBar followups={visibleFollowups} onFollowup={handleSearch} />
            <InputBar
              onSubmit={handleSearch}
              isLoading={isAsking}
              forceSearchMode
              placeholder={
                hasTurns ? "Ask a follow-up..." : "Ask your mind anything..."
              }
            />
          </div>
        </div>
      </div>

      <SourcesDialog
        entries={dialogEntries}
        open={sourcesTurnId != null}
        onClose={() => setSourcesTurnId(null)}
        onOpenEntry={handleOpenEntry}
      />

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
