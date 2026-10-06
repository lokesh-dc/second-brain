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
 * Bottom sheet listing a turn's sources stacked (z-60: above the input
 * dock + tab dock, below the entry sheet's z-70/z-80). Tapping a source
 * opens the entry detail sheet above this sheet, so the two stack exactly
 * like the entry sheet does.
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
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={title ?? "Sources"}>
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-ink/30"
      />
      <div className="turn-enter absolute inset-x-0 bottom-0 mx-auto max-h-[75dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-paper px-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-2 shadow-2xl">
        {/* Handle bar */}
        <div className="mx-auto mb-4 mt-2 h-1 w-10 rounded-full bg-line" />
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
