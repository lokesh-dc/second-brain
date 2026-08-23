"use client";

import { useState } from "react";
import { Brain } from "lucide-react";
import EntryCard from "./entry-card";
import EntrySheet from "./entry-sheet";
import { Entry } from "@/types";

interface EntriesFeedProps {
  firstName: string;
  initialEntries: Entry[];
}

export default function EntriesFeed({
  firstName,
  initialEntries,
}: EntriesFeedProps) {
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const openEntry = (entry: Entry) => {
    setSelectedEntry(entry);
    setSheetOpen(true);
  };

  return (
    <main className="mx-auto max-w-lg px-5 pb-40 pt-6">
      {/* Greeting */}
      <h1 className="mb-6 mt-2 font-display text-[28px]">
        Hello, {firstName}
      </h1>

      {initialEntries.length === 0 ? (
        <div className="flex flex-col items-center pb-24 pt-40 text-center">
          <Brain size={48} strokeWidth={1.5} className="text-[#e2e8f0]" />
          <h2 className="mt-4 text-lg font-semibold text-[#94a3b8]">
            your mind is quiet right now
          </h2>
          <p className="mt-2 text-sm text-[#cbd5e1]">
            drop a thought below to get started
          </p>
        </div>
      ) : (
        initialEntries.map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            onPress={() => openEntry(entry)}
          />
        ))
      )}

      <EntrySheet
        entry={selectedEntry}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </main>
  );
}
