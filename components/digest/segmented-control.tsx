"use client";

import { DigestPeriod } from "@/types";

interface Props {
  selected: DigestPeriod;
  onSelect: (period: DigestPeriod) => void;
  busy?: boolean;
}

const PERIODS: { label: string; value: DigestPeriod }[] = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
];

export function DigestSegmentedControl({ selected, onSelect, busy }: Props) {
  return (
    <div
      role="tablist"
      aria-busy={busy}
      aria-label="Digest period"
      className="mb-5 flex rounded-xl bg-[#eeebe6] p-1"
    >
      {PERIODS.map((p) => (
        <button
          key={p.value}
          role="tab"
          type="button"
          aria-selected={selected === p.value}
          onClick={() => onSelect(p.value)}
          className={`min-w-0 flex-1 truncate rounded-[10px] px-1 py-2 text-sm whitespace-nowrap transition-all ${
            selected === p.value
              ? "bg-white font-medium text-ink shadow-sm shadow-black/10"
              : "text-[#666666]"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
