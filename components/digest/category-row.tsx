"use client";

import { getCategoryConfig } from "@/constants/categories";

interface Props {
  category: string;
  count: number;
  amount?: number;
  currency?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  expense: "#1D9E75",
  reading: "#BA7517",
  travel: "#185FA5",
  idea: "#7F77DD",
  shopping: "#D4537E",
  health: "#D85A30",
  misc: "#8c8c8c",
};

export function DigestCategoryRow({
  category,
  count,
  amount,
  currency,
}: Props) {
  const config = getCategoryConfig(category);
  const Icon = config.icon;
  const normalizedCat = category
    .toLowerCase()
    .includes("expense")
    ? "expense"
    : category.toLowerCase().includes("read")
      ? "reading"
      : category.toLowerCase().includes("travel")
        ? "travel"
        : category.toLowerCase().includes("idea")
          ? "idea"
          : category.toLowerCase().includes("shop")
            ? "shopping"
            : category.toLowerCase().includes("health")
              ? "health"
              : "misc";

  const accentColor = CATEGORY_COLORS[normalizedCat] || CATEGORY_COLORS.misc;

  return (
    <div className="flex min-w-0 items-center overflow-hidden rounded-xl border border-line bg-white">
      <div className="w-1 shrink-0 self-stretch" style={{ backgroundColor: accentColor }} />
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 py-3 pl-4 pr-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
            style={{ backgroundColor: `${accentColor}15` }}
          >
            <Icon size={20} color={accentColor} />
          </span>
          <span className="truncate font-medium capitalize">{category}</span>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[13px] whitespace-nowrap text-[#666666]">
            {count} logs
          </p>
          {amount !== undefined && (
            <p className="mt-0.5 text-sm font-bold whitespace-nowrap tabular-nums text-success">
              {currency} {amount.toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
