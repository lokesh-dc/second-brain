"use client";

import { format, formatDistanceToNow } from "date-fns";
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

  const isExpense = categoryName.toLowerCase().includes("expense");

  const dateObj = new Date(entry.timestamp);
  const monthStr = format(dateObj, "MMM");
  const dayStr = format(dateObj, "dd");

  return (
    <div className="mb-3 flex flex-row gap-2">
      {/* Date column */}
      <div className="flex w-12 shrink-0 flex-col items-center pt-3">
        <span className="text-xs font-bold uppercase text-[#94a3b8]">
          {monthStr}
        </span>
        <span className="mt-0.5 text-[22px] font-extrabold text-[#1e293b]">
          {dayStr}
        </span>
      </div>

      {/* Card */}
      <button
        onClick={onPress}
        className="flex-1 rounded-2xl border-l-4 bg-white p-4 text-left shadow-sm transition-transform active:scale-[0.99]"
        style={{ borderLeftColor: config.accent }}
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center">
            <Icon size={16} color={config.accent} />
            <span
              className="ml-1.5 text-xs font-bold uppercase tracking-wider"
              style={{ color: config.accent }}
            >
              {categoryName}
            </span>
          </div>

          {entry.entities && entry.entities.length > 0 && (
            <span className="rounded-md bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-semibold text-[#64748b]">
              {entry.entities[0].name}
            </span>
          )}
        </div>

        <p className="mb-3 line-clamp-2 text-base font-medium leading-snug text-[#1e293b]">
          {entry.summary || entry.raw_text}
        </p>

        <div className="flex items-center">
          {isExpense && entry.amount && (
            <span className="rounded-xl bg-[#dcfce7] px-2 py-0.5 text-xs font-bold text-[#166534]">
              {entry.currency === "INR" ? "₹" : entry.currency || ""}
              {entry.amount}
            </span>
          )}
          <span className="flex-1" />
          <span className="text-[11px] text-[#94a3b8]">
            {formatDistanceToNow(dateObj, { addSuffix: true })}
          </span>
        </div>
      </button>
    </div>
  );
}
