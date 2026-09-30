"use client";

import { formatDistanceToNow } from "date-fns";

interface Props {
  narrative: string;
  updatedAt: string;
}

export function DigestNarrativeCard({ narrative, updatedAt }: Props) {
  const timeAgo = formatDistanceToNow(new Date(updatedAt), { addSuffix: true });

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <p className="mb-3 font-display text-lg leading-relaxed text-pretty">
        {narrative}
      </p>
      <p className="text-xs text-ink-3">Updated {timeAgo}</p>
    </div>
  );
}
