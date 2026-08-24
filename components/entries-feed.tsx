"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { format, isToday, isYesterday } from "date-fns";
import EntryCard from "./entry-card";
import EntrySheet from "./entry-sheet";
import { Entry } from "@/types";

interface EntriesFeedProps {
  firstName: string;
  dateLabel: string;
  initialEntries: Entry[];
}

const EASE = [0.215, 0.61, 0.355, 1] as const;

function dayKey(timestamp: string) {
  return format(new Date(timestamp), "yyyy-MM-dd");
}

function dayLabel(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEEE, d MMM");
}

const EXAMPLE_DROPS = [
  { text: "spent ₹240 at Third Wave Coffee", dot: "#22c55e", rotate: "-rotate-2" },
  { text: "idea: weekend trip to Coorg", dot: "#a855f7", rotate: "rotate-1" },
  { text: "finished reading Atomic Habits", dot: "#f59e0b", rotate: "-rotate-1" },
];

export default function EntriesFeed({
  firstName,
  dateLabel,
  initialEntries,
}: EntriesFeedProps) {
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  const groups = useMemo(() => {
    const byDay = new Map<string, Entry[]>();
    for (const entry of initialEntries) {
      const key = dayKey(entry.timestamp);
      const bucket = byDay.get(key);
      if (bucket) bucket.push(entry);
      else byDay.set(key, [entry]);
    }
    return Array.from(byDay.entries()).reduce(
      ({ groups, count }, [key, entries]) => ({
        groups: [
          ...groups,
          { key, label: dayLabel(key), entries, startIndex: count },
        ],
        count: count + entries.length,
      }),
      {
        groups: [] as Array<{
          key: string;
          label: string;
          entries: Entry[];
          startIndex: number;
        }>,
        count: 0,
      },
    ).groups;
  }, [initialEntries]);

  const openEntry = (entry: Entry) => {
    setSelectedEntry(entry);
    setSheetOpen(true);
  };

  const entryMotionProps = (i: number) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: reduceMotion ? 0 : 0.45,
      delay: reduceMotion ? 0 : Math.min(i * 0.045, 0.36),
      ease: EASE,
    },
  });

  return (
    <main className="mx-auto max-w-lg px-5 pb-48 pt-8">
      {/* Masthead */}
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-3">
          {dateLabel}
        </p>
        <div className="mt-2 flex items-baseline justify-between gap-4">
          <h1 className="font-display text-[32px] leading-none tracking-tight text-ink [text-wrap:balance]">
            hey {firstName}
            <span className="text-brand">.</span>
          </h1>
          {initialEntries.length > 0 && (
            <p className="shrink-0 text-xs font-medium tabular-nums text-ink-3">
              {initialEntries.length}{" "}
              {initialEntries.length === 1 ? "drop" : "drops"}
            </p>
          )}
        </div>
        <div className="mt-6 h-px bg-line" />
      </header>

      {initialEntries.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center pb-10 pt-16 text-center">
          <h2 className="font-display text-[26px] leading-tight text-ink">
            your mind is <em className="italic text-brand">quiet</em> right now.
          </h2>
          <p className="mt-3 max-w-[30ch] text-sm leading-relaxed text-pretty text-ink-2">
            Type anything below — an expense, an idea, a book you finished.
            It lands here.
          </p>

          <div aria-hidden="true" className="mt-14 flex w-full flex-col items-center gap-4">
            {EXAMPLE_DROPS.map((drop) => (
              <div
                key={drop.text}
                className={`flex w-fit max-w-full items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 shadow-[0_10px_24px_-18px_rgba(26,26,26,0.35)] ${drop.rotate}`}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: drop.dot }}
                />
                <span className="truncate text-[13px] font-medium text-ink-2">
                  {drop.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="pt-5">
            {/* Sticky day header */}
            <div className="sticky top-0 z-10 -mx-5 bg-paper/85 px-5 py-2.5 backdrop-blur-sm">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-3">
                {group.label}
              </h2>
            </div>

            <div className="mt-2 flex flex-col gap-2.5">
              {group.entries.map((entry, i) => (
                <motion.div key={entry.id} {...entryMotionProps(group.startIndex + i)}>
                  <EntryCard entry={entry} onPress={() => openEntry(entry)} />
                </motion.div>
              ))}
            </div>
          </section>
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
