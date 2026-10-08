"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createElement, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { format } from "date-fns";
import {
  ArrowLeft,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import EntryCard from "./entry-card";
import EntrySheet from "./entry-sheet";
import { dayKey, dayLabel } from "./entries-feed";
import { entityIconFor, formatEntityName } from "@/constants/entities";
import { formatCategoryName } from "@/constants/categories";
import { deleteEntry, updateEntry } from "@/actions/entries";
import type { EntityStats } from "@/actions/entities";
import type { Entity, Entry, EntryEditData } from "@/types";

const EASE = [0.215, 0.61, 0.355, 1] as const;

const iconFor = entityIconFor;

function formatSpend(amount: number, currency: string | null): string {
  const symbol = currency === "INR" ? "₹" : currency ? `${currency} ` : "";
  return `${symbol}${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

export default function EntityDetailScreen({
  entity,
  entries,
  stats,
}: {
  entity: Entity;
  entries: Entry[];
  stats: EntityStats;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const displayName = formatEntityName(entity.name);

  const groups = useMemo(() => {
    const byDay = new Map<string, Entry[]>();
    for (const entry of entries) {
      const key = dayKey(entry.timestamp);
      const bucket = byDay.get(key);
      if (bucket) bucket.push(entry);
      else byDay.set(key, [entry]);
    }
    return [...byDay.entries()].map(([key, dayEntries]) => ({
      key,
      label: dayLabel(key),
      entries: dayEntries,
    }));
  }, [entries]);

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
    toast.success("Entry updated");
    router.refresh();
  };

  const rangeLabel =
    stats.firstSeen && stats.lastSeen
      ? `${format(new Date(stats.firstSeen), "d MMM")} – ${format(new Date(stats.lastSeen), "d MMM yyyy")}`
      : "—";

  return (
    <main className="mx-auto max-w-lg px-5 pb-48 pt-8 md:max-w-4xl md:px-8 md:pb-16">
      <Link
        href="/home"
        className="flex w-fit items-center gap-1 text-sm font-medium text-ink-3 transition-colors hover:text-ink"
        aria-label="Back to home"
      >
        <ArrowLeft size={18} />
        Drops
      </Link>

      <header className="mt-3">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ink text-white">
            {createElement(iconFor(entity.type), { size: 22 })}
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-display text-[30px] leading-none tracking-tight">
              {displayName}
              <span className="text-brand">.</span>
            </h1>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
              {entity.type || "entity"} · {stats.dropCount}{" "}
              {stats.dropCount === 1 ? "drop" : "drops"}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <div className="rounded-2xl border border-line bg-white px-4 py-3.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-3">
              Drops
            </p>
            <p className="mt-1 font-display text-2xl leading-none tabular-nums">
              {stats.dropCount}
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-white px-4 py-3.5">
            <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-3">
              <Wallet size={12} className="text-success" />
              Spent
            </p>
            <p className="mt-1 truncate font-display text-2xl leading-none tabular-nums">
              {stats.spendTotal > 0
                ? formatSpend(stats.spendTotal, stats.spendCurrency)
                : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-white px-4 py-3.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-3">
              Range
            </p>
            <p className="mt-1 truncate font-display text-[19px] leading-none">
              {rangeLabel}
            </p>
          </div>
        </div>

        {stats.categories.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {stats.categories.map((c) => (
              <span
                key={c.name}
                className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink-2"
              >
                {formatCategoryName(c.name)}{" "}
                <span className="tabular-nums text-ink-3">×{c.count}</span>
              </span>
            ))}
          </div>
        )}

        <div className="mt-6 h-px bg-line" />
      </header>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center pb-10 pt-16 text-center">
          <h2 className="font-display text-[24px] leading-tight">
            nothing linked <em className="italic text-brand">anymore</em>.
          </h2>
          <p className="mt-3 max-w-[30ch] text-sm leading-relaxed text-pretty text-ink-2">
            Every drop mentioning {displayName} was deleted or moved.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 flex items-baseline justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-3">
              Full history
            </h2>
            <span className="text-xs font-medium tabular-nums text-ink-3">
              newest first
            </span>
          </div>
          {groups.map((group, gi) => (
            <section key={group.key} className="pt-5">
              <div className="sticky top-0 z-10 -mx-5 bg-paper/85 px-5 py-2.5 backdrop-blur-sm md:-mx-8 md:px-8">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-3">
                  {group.label}
                </h3>
              </div>
              <div className="mt-2 flex flex-col gap-2.5 md:grid md:grid-cols-2 md:gap-3">
                {group.entries.map((entry, i) => (
                  <motion.div
                    key={entry.id}
                    initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: reduceMotion ? 0 : 0.45,
                      delay: reduceMotion ? 0 : Math.min((gi * 3 + i) * 0.045, 0.36),
                      ease: EASE,
                    }}
                  >
                    <EntryCard
                      entry={entry}
                      onPress={() => {
                        setSelectedEntry(entry);
                        setSheetOpen(true);
                      }}
                    />
                  </motion.div>
                ))}
              </div>
            </section>
          ))}
        </>
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
