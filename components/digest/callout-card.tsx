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
    <div className="mr-3 w-[200px] shrink-0 rounded-2xl bg-white p-4 shadow-sm shadow-black/5 md:mr-0 md:w-full">
      <span
        className="mb-3 grid h-9 w-9 place-items-center rounded-full"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon size={20} color={color} />
      </span>
      <p className="mb-1 text-xs uppercase tracking-wider text-[#666666]">
        {title}
      </p>
      <p className="truncate font-display text-lg">{value}</p>
      {subtitle && <p className="text-xs text-ink-3">{subtitle}</p>}
    </div>
  );
}
