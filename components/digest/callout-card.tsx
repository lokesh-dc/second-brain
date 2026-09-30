"use client";

import type { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  color: string;
}

export function DigestCalloutCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
}: Props) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-white p-4">
      <span
        className="mb-3 grid h-9 w-9 shrink-0 place-items-center rounded-full"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon size={20} color={color} />
      </span>
      <p className="mb-1 truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
        {title}
      </p>
      <p className="truncate font-display text-[17px] leading-tight">
        {value}
      </p>
      {subtitle && (
        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-ink-3">
          {subtitle}
        </p>
      )}
    </div>
  );
}
