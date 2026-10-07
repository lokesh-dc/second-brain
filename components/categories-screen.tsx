"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import EntryCard from "./entry-card";
import EntrySheet from "./entry-sheet";
import { deleteEntry, updateEntry } from "@/actions/entries";
import { dayKey, dayLabel } from "./entries-feed";
import { getCategoryConfig, formatCategoryName, ALL_CATEGORY_NAMES } from "@/constants/categories";
import { CategoryWithCount } from "@/lib/categories";
import { Entry, EntryEditData } from "@/types";

interface CategoriesScreenProps {
  categories: CategoryWithCount[];
  entries: Entry[];
}

const EASE = [0.215, 0.61, 0.355, 1] as const;

function entryCategoryId(entry: Entry): string | null {
  if (entry.category_id) return entry.category_id;
  const c = entry.category;
  if (c && typeof c !== "string") return c.id;
  return null;
}

function dropLabel(n: number) {
  return `${n} ${n === 1 ? "drop" : "drops"}`;
}

export default function CategoriesScreen({
  categories,
  entries,
}: CategoriesScreenProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const uncategorizedCount = useMemo(
    () => entries.filter((e) => !entryCategoryId(e)).length,
    [entries],
  );

  const sorted = useMemo(
    () => [...categories].sort((a, b) => b.entryCount - a.entryCount),
    [categories],
  );

  const miscConfig = getCategoryConfig("misc");
  const MiscIcon = miscConfig.icon;

  const total = categories.reduce((acc, c) => acc + c.entryCount, 0);

  const selected = selectedId
    ? selectedId === "uncategorized"
      ? { id: "uncategorized", name: "Uncategorized" }
      : categories.find((c) => c.id === selectedId) ?? null
    : null;

  const selectedEntries = useMemo(() => {
    if (!selectedId) return [];
    if (selectedId === "uncategorized")
      return entries.filter((e) => !entryCategoryId(e));
    return entries.filter((e) => entryCategoryId(e) === selectedId);
  }, [selectedId, entries]);

  // Newer first, grouped by day (same as the Home feed)
  const selectedGroups = useMemo(() => {
    const byDay = new Map<string, Entry[]>();
    for (const entry of selectedEntries) {
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
  }, [selectedEntries]);

  const openEntry = (entry: Entry) => {
    setSelectedEntry(entry);
    setSheetOpen(true);
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

    const nextCat =
      categories.find(
        (c) => c.name.toLowerCase() === data.category.toLowerCase(),
      ) ??
      (ALL_CATEGORY_NAMES.some(
        (n) => n.toLowerCase() === data.category.toLowerCase(),
      )
        ? {
            id: data.category.toLowerCase(),
            user_id: "",
            name: data.category,
            is_default: true,
          }
        : undefined);
    setSelectedEntry((prev) =>
      prev
        ? {
            ...prev,
            raw_text: data.raw_text,
            summary: data.summary,
            amount: data.amount ?? prev.amount,
            currency: data.currency ?? prev.currency,
            tags: data.tags,
            category: nextCat ?? prev.category,
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

  const tileMotionProps = (i: number) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: reduceMotion ? 0 : 0.45,
      delay: reduceMotion ? 0 : Math.min(i * 0.045, 0.36),
      ease: EASE,
    },
  });

  // Detail view: recent entries in the selected category
  if (selected) {
    const config = getCategoryConfig(selected.name);
    const Icon = config.icon;
    const selectedDisplayName = formatCategoryName(selected.name);
    return (
      <main className="mx-auto max-w-lg px-5 pb-48 pt-8 md:max-w-4xl md:px-8 md:pb-16">
        <header>
          <button
            onClick={() => setSelectedId(null)}
            className="flex items-center gap-1 text-sm font-medium text-ink-3 transition-colors hover:text-ink"
            aria-label="Back to categories"
          >
            <ChevronLeft size={18} />
            Categories
          </button>
          <div className="mt-3 flex items-center gap-3">
            <span
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
              style={{ backgroundColor: `${config.accent}1A` }}
            >
              <Icon size={22} color={config.accent} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <h1 className="truncate font-display text-[28px] leading-none tracking-tight text-ink">
                {selectedDisplayName}
                <span className="text-brand">.</span>
              </h1>
              <p className="mt-1 text-xs font-medium tabular-nums text-ink-3">
                {selectedId === "uncategorized"
                  ? dropLabel(selectedEntries.length)
                  : dropLabel(
                      categories.find((c) => c.id === selectedId)?.entryCount ??
                        selectedEntries.length,
                    )}
              </p>
            </div>
          </div>
          <div className="mt-6 h-px bg-line" />
        </header>

        {selectedEntries.length === 0 ? (
          <div className="flex flex-col items-center pb-10 pt-16 text-center">
            <h2 className="font-display text-[24px] leading-tight text-ink">
              nothing here <em className="italic text-brand">yet</em>.
            </h2>
            <p className="mt-3 max-w-[30ch] text-sm leading-relaxed text-pretty text-ink-2">
              Drops you log as {selected.name.toLowerCase()} will land here.
            </p>
          </div>
        ) : (
          selectedGroups.map((group) => (
            <section key={group.key} className="pt-5">
              {/* Sticky day header */}
              <div className="sticky top-0 z-10 -mx-5 bg-paper/85 px-5 py-2.5 backdrop-blur-sm md:-mx-8 md:px-8">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-3">
                  {group.label}
                </h2>
              </div>

              <div className="mt-2 flex flex-col gap-2.5 md:grid md:grid-cols-2 md:gap-3">
                {group.entries.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    onPress={() => openEntry(entry)}
                  />
                ))}
              </div>
            </section>
          ))
        )}

        <EntrySheet
          entry={selectedEntry}
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          onDelete={handleDelete}
          onEdit={handleEdit}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        />
      </main>
    );
  }

  // Grid view
  return (
    <main className="mx-auto max-w-lg px-5 pb-48 pt-8 md:max-w-4xl md:px-8 md:pb-16">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-3">
          browse by type
        </p>
        <div className="mt-2 flex items-baseline justify-between gap-4">
          <h1 className="font-display text-[32px] leading-none tracking-tight text-ink [text-wrap:balance]">
            categories<span className="text-brand">.</span>
          </h1>
          {total > 0 && (
            <p className="shrink-0 text-xs font-medium tabular-nums text-ink-3">
              {dropLabel(total)}
            </p>
          )}
        </div>
        <div className="mt-6 h-px bg-line" />
      </header>

      {sorted.length === 0 && uncategorizedCount === 0 ? (
        <div className="flex flex-col items-center pb-10 pt-16 text-center">
          <h2 className="font-display text-[26px] leading-tight text-ink">
            no categories <em className="italic text-brand">yet</em>.
          </h2>
          <p className="mt-3 max-w-[30ch] text-sm leading-relaxed text-pretty text-ink-2">
            Log your first drop and it will be sorted here automatically.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-3">
          {sorted.map((category, i) => {
            const config = getCategoryConfig(category.name);
            const Icon = config.icon;
            return (
              <motion.button
                key={category.id}
                {...tileMotionProps(i)}
                onClick={() => setSelectedId(category.id)}
                className="flex flex-col rounded-2xl border border-line bg-white p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-ink-3/40 hover:shadow-[0_12px_28px_-16px_rgba(26,26,26,0.25)] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <span
                  className="grid h-10 w-10 place-items-center rounded-xl"
                  style={{ backgroundColor: `${config.accent}1A` }}
                >
                  <Icon size={20} color={config.accent} strokeWidth={2} />
                </span>
                <span className="mt-3 truncate text-[15px] font-semibold text-ink">
                  {formatCategoryName(category.name)}
                </span>
                <span className="mt-0.5 text-xs font-medium tabular-nums text-ink-3">
                  {dropLabel(category.entryCount)}
                </span>
              </motion.button>
            );
          })}
          {uncategorizedCount > 0 && (
            <motion.button
              {...tileMotionProps(sorted.length)}
              onClick={() => setSelectedId("uncategorized")}
              className="flex flex-col rounded-2xl border border-line bg-white p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-ink-3/40 hover:shadow-[0_12px_28px_-16px_rgba(26,26,26,0.25)] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <span
                className="grid h-10 w-10 place-items-center rounded-xl"
                style={{ backgroundColor: `${miscConfig.accent}1A` }}
              >
                <MiscIcon
                  size={20}
                  color={miscConfig.accent}
                  strokeWidth={2}
                />
              </span>
              <span className="mt-3 truncate text-[15px] font-semibold text-ink">
                Uncategorized
              </span>
              <span className="mt-0.5 text-xs font-medium tabular-nums text-ink-3">
                {dropLabel(uncategorizedCount)}
              </span>
            </motion.button>
          )}
        </div>
      )}

      <EntrySheet
        entry={selectedEntry}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onDelete={handleDelete}
        onEdit={handleEdit}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </main>
  );
}
