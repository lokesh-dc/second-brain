"use client";

import { formatDistanceToNow } from "date-fns";

interface Props {
  narrative: string;
  updatedAt: string;
}

export function DigestNarrativeCard({ narrative, updatedAt }: Props) {
  const timeAgo = formatDistanceToNow(new Date(updatedAt), { addSuffix: true });

  return (
    <div className="mx-5 mb-5 rounded-2xl bg-white p-5 shadow-sm shadow-black/5">
      <p className="mb-3 font-display text-lg leading-relaxed">{narrative}</p>
      <p className="text-xs text-ink-3">Updated {timeAgo}</p>
    </div>
  );
}
