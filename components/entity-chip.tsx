"use client";

import { ChevronDown } from "lucide-react";

interface EntityChipProps {
  label: string;
}

export default function EntityChip({ label }: EntityChipProps) {
  return (
    <div className="ml-4 flex w-fit items-center rounded-full border border-[#e2e8f0] bg-[#f1f5f9] px-3 py-1.5">
      <span className="mr-1 text-xs text-[#64748b]">logging into →</span>
      <span className="text-xs font-semibold text-[#0f172a]">{label}</span>
      <ChevronDown size={14} className="ml-1 text-[#64748b]" />
    </div>
  );
}
