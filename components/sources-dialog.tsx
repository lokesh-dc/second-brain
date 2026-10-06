"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import EntryCard from "./entry-card";
import { Entry } from "@/types";

interface SourcesDialogProps {
  entries: Entry[];
  open: boolean;
  title?: string;
  onClose: () => void;
  onOpenEntry: (entry: Entry) => void;
}

/**
 * Lists a turn's sources stacked in a centered dialog (z-30, below the
 * entry sheet's z-40/z-50). Tapping a source opens the entry detail sheet
 * above this dialog, so the two dialogs visibly stack.
 */
export default function SourcesDialog({
  entries,
  open,
  title,
  onClose,
  onOpenEntry,
}: SourcesDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30" role="dialog" aria-modal="true" aria-label={title ?? "Sources"}>
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-ink/30"
      />
      <div className="turn-enter absolute left-1/2 top-1/2 max-h-[70dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-paper p-4 shadow-2xl">
        <div className="mb-3 flex items-center">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">
            {title ?? `${entries.length} ${entries.length === 1 ? "Source" : "Sources"}`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sources"
            className="ml-auto grid h-8 w-8 place-items-center rounded-full text-ink-3 transition-colors hover:bg-hairline hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          {entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onPress={() => onOpenEntry(entry)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
