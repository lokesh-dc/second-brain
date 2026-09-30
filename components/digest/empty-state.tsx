"use client";

import { CloudRain } from "lucide-react";

export function DigestEmptyState() {
  return (
    <div className="flex flex-col items-center px-2 pb-10 pt-20 text-center">
      <div className="mb-6 grid h-20 w-20 place-items-center rounded-full bg-brand/10">
        <CloudRain size={40} className="text-brand" strokeWidth={1.5} />
      </div>
      <h2 className="font-display text-[24px] leading-tight">
        Nothing logged yet
      </h2>
      <p className="mt-3 max-w-[30ch] text-sm leading-relaxed text-pretty text-ink-2">
        Drop a thought to get started and see your daily digest here.
      </p>
    </div>
  );
}
