"use client";

import { Sparkles, X } from "lucide-react";

interface RetrievalResultProps {
  answer: string;
  entryCount: number;
  onClose: () => void;
  onPress: () => void;
}

export default function RetrievalResult({
  answer,
  entryCount,
  onClose,
  onPress,
}: RetrievalResultProps) {
  if (!answer) return null;

  return (
    <button
      onClick={onPress}
      className="w-full rounded-2xl border border-[#ddd6fe] bg-[#f5f3ff] p-4 text-left shadow-lg shadow-indigo-500/10"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center">
          <Sparkles size={16} className="text-indigo-500" />
          <span className="ml-1.5 text-xs font-bold uppercase tracking-wider text-indigo-500">
            Memory Assistant
          </span>
        </div>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          onKeyDown={(e) => e.key === "Enter" && onClose()}
          className="p-0.5"
        >
          <X size={18} className="text-[#94a3b8]" />
        </span>
      </div>

      <p className="mb-2 text-[15px] leading-relaxed text-[#1e1b4b]">
        {answer}
      </p>

      <p className="text-[11px] italic text-[#94a3b8]">
        Based on {entryCount} {entryCount === 1 ? "entry" : "entries"}
      </p>
    </button>
  );
}
