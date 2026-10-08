"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { format, isToday, isYesterday } from "date-fns";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import EntryCard from "./entry-card";
import EntrySheet from "./entry-sheet";
import HomeWidgets from "./home-widgets";
import { useCapture } from "./capture";
import type { HomeWidgets as HomeWidgetsData } from "@/actions/home";
import { updateEntry, deleteEntry, loadMoreEntries } from "@/actions/entries";
import { ENTRIES_PAGE_SIZE } from "@/constants/entries";
import { Entry, EntryEditData } from "@/types";

interface EntriesFeedProps {
  firstName: string;
  dateLabel: string;
  initialEntries: Entry[];
  widgets?: HomeWidgetsData | null;
}

const EASE = [0.215, 0.61, 0.355, 1] as const;

export function dayKey(timestamp: string) {
  return format(new Date(timestamp), "yyyy-MM-dd");
}

export function dayLabel(key: string) {
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
  widgets,
}: EntriesFeedProps) {
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [olderEntries, setOlderEntries] = useState<Entry[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadedAll, setLoadedAll] = useState(false);
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const { open: openCapture } = useCapture();

  const allEntries = useMemo(
    () => [...initialEntries, ...olderEntries],
    [initialEntries, olderEntries],
  );

  const loadOlder = async () => {
    if (loadingOlder || loadedAll) return;
    const before = allEntries[allEntries.length - 1]?.timestamp;
    if (!before) return;

    setLoadingOlder(true);
    const res = await loadMoreEntries(before);
    setLoadingOlder(false);

    if (!res.ok) {
      toast.error(res.error || "Failed to load older drops");
      return;
    }

    const seen = new Set(allEntries.map((e) => e.id));
    const fresh = (res.entries ?? []).filter((e) => !seen.has(e.id));

    setOlderEntries((prev) => [...prev, ...fresh]);
    if (fresh.length < ENTRIES_PAGE_SIZE) setLoadedAll(true);
  };

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

  const groups = useMemo(() => {
    const byDay = new Map<string, Entry[]>();
    for (const entry of allEntries) {
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
  }, [allEntries]);

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
    <main className="mx-auto max-w-lg px-5 pb-48 pt-8 md:max-w-4xl md:px-8 md:pb-16 xl:max-w-6xl">
      {/* Masthead */}
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-3">
          {dateLabel}
        </p>
        <div className="mt-2 flex items-center justify-between gap-4">
          <h1 className="font-display text-[32px] leading-none tracking-tight text-ink [text-wrap:balance] xl:text-[40px]">
            hey {firstName}
            <span className="text-brand">.</span>
          </h1>
          <div className="flex shrink-0 items-center gap-3">
            {((widgets?.totalDrops ?? allEntries.length) > 0) && (
              <p className="text-xs font-medium tabular-nums text-ink-3">
                {(widgets?.totalDrops ?? allEntries.length)}{" "}
                {(widgets?.totalDrops ?? allEntries.length) === 1 ? "drop" : "drops"}
              </p>
            )}
            <Link
              href="/search"
              className="hidden items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] md:flex"
            >
              <Search size={14} /> Ask your mind
            </Link>
          </div>
        </div>
        <div className="mt-6 h-px bg-line" />
      </header>

      {widgets && (
        <div className="xl:hidden">
          <HomeWidgets widgets={widgets} />
        </div>
      )}

      {allEntries.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center pb-10 pt-16 text-center">
          <h2 className="font-display text-[26px] leading-tight text-ink">
            your mind is <em className="italic text-brand">quiet</em> right now.
          </h2>
          <p className="mt-3 max-w-[30ch] text-sm leading-relaxed text-pretty text-ink-2">
            Type anything below — an expense, an idea, a book you finished.
            It lands here.
          </p>

          <button
            onClick={openCapture}
            className="mt-8 flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-black/20 transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus size={16} /> Drop your first thought
          </button>
          <p className="mt-3 hidden text-xs font-medium text-ink-3 md:block">
            tip: press N anywhere to capture
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
        <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start xl:gap-8">
          <div className="min-w-0">
            <div className="mt-8 flex items-baseline justify-between xl:mt-6">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-3">
                Recent drops
              </h2>
              <span className="text-xs font-medium tabular-nums text-ink-3">
                newest first
              </span>
            </div>
            {groups.map((group) => (
              <section key={group.key} className="pt-5">
                {/* Sticky day header */}
                <div className="sticky top-0 z-10 -mx-5 bg-paper/85 px-5 py-2.5 backdrop-blur-sm md:-mx-8 md:px-8">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-3">
                    {group.label}
                  </h3>
                </div>

                <div className="mt-2 flex flex-col gap-2.5 md:grid md:grid-cols-2 md:gap-3">
                  {group.entries.map((entry, i) => (
                    <motion.div key={entry.id} {...entryMotionProps(group.startIndex + i)}>
                      <EntryCard entry={entry} onPress={() => openEntry(entry)} />
                    </motion.div>
                  ))}
                </div>
              </section>
            ))}

            {allEntries.length > 0 && (
              <div className="mt-10 flex flex-col items-center gap-2">
                {loadedAll ? (
                  <p className="text-xs font-medium text-ink-3">
                    that&apos;s every drop — nothing older.
                  </p>
                ) : (
                  <button
                    onClick={loadOlder}
                    disabled={loadingOlder}
                    className="flex items-center gap-2 rounded-full border border-line bg-white px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-paper disabled:opacity-60"
                  >
                    {loadingOlder && <Loader2 size={16} className="animate-spin" />}
                    {loadingOlder ? "Loading…" : "View Older Drops"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Desktop insights rail ── */}
          {widgets && (
            <aside className="mt-6 sticky top-6 hidden min-w-0 xl:block">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-3">
                At a glance
              </p>
              <HomeWidgets widgets={widgets} layout="rail" />
            </aside>
          )}
        </div>
      )}

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
