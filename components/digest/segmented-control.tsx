"use client";

import { DigestPeriod } from "@/types";

interface Props {
  selected: DigestPeriod;
  onSelect: (period: DigestPeriod) => void;
}

const PERIODS: { label: string; value: DigestPeriod }[] = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
];

export function DigestSegmentedControl({ selected, onSelect }: Props) {
  return (
    <div className="mx-5 mb-5 flex rounded-xl bg-[#eeebe6] p-1">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => onSelect(p.value)}
          className={`flex-1 rounded-[10px] py-2 text-sm transition-all ${
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
