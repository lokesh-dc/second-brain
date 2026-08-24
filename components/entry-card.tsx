"use client";

import { format } from "date-fns";
import { Entry } from "@/types";
import { getCategoryConfig } from "@/constants/categories";

interface EntryCardProps {
  entry: Entry;
  onPress: () => void;
}

export default function EntryCard({ entry, onPress }: EntryCardProps) {
  const categoryName = entry.category?.name || "Misc";
  const config = getCategoryConfig(categoryName);
  const Icon = config.icon;

  const dateObj = new Date(entry.timestamp);
  const isExpense = categoryName.toLowerCase().includes("expense");

  const amount =
    isExpense && entry.amount != null
      ? `${entry.currency === "INR" ? "₹" : entry.currency || ""}${new Intl.NumberFormat(
          "en-IN",
          { maximumFractionDigits: 2 },
        ).format(entry.amount)}`
      : null;

  const entities = entry.entities?.slice(0, 2) ?? [];

  return (
    <button
      onClick={onPress}
      className="block w-full rounded-2xl border border-line bg-white p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-ink-3/40 hover:shadow-[0_12px_28px_-16px_rgba(26,26,26,0.25)] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <div className="flex items-center gap-2">
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
          style={{ backgroundColor: `${config.accent}1A` }}
        >
          <Icon size={15} color={config.accent} strokeWidth={2} />
        </span>
        <span className="truncate text-xs font-semibold tracking-wide text-ink-2">
          {categoryName}
        </span>
        <span className="ml-auto shrink-0 text-[11px] font-medium tabular-nums text-ink-3">
          {format(dateObj, "h:mm a")}
        </span>
      </div>

      <p className="mt-2.5 line-clamp-2 text-[15px] font-medium leading-snug text-pretty text-ink">
        {entry.summary || entry.raw_text}
      </p>

      {(amount || entities.length > 0) && (
        <div className="mt-2.5 flex items-center gap-2">
          {amount && (
            <span className="text-[13px] font-bold tabular-nums text-success">
              {amount}
            </span>
          )}
          {entities.map((e) => (
            <span
              key={e.id}
              className="rounded-md border border-line bg-paper px-1.5 py-0.5 text-[11px] font-medium text-ink-2"
            >
              {e.name}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
