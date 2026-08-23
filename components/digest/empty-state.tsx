"use client";

import { CloudRain } from "lucide-react";

export function DigestEmptyState() {
  return (
    <div className="flex flex-col items-center px-10 pt-24 text-center">
      <div className="mb-6 grid h-[100px] w-[100px] place-items-center rounded-full bg-brand/10">
        <CloudRain size={48} className="text-brand" strokeWidth={1.5} />
      </div>
      <h2 className="mb-3 font-display text-[22px]">Nothing logged yet</h2>
      <p className="text-base leading-relaxed text-[#666666]">
        Drop a thought to get started and see your daily digest here.
      </p>
    </div>
  );
}
