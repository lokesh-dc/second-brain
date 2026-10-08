"use client";

import { Banknote } from "lucide-react";
import { DigestPeriod, DigestRawData } from "@/types";

interface Props {
  raw: DigestRawData;
  period: DigestPeriod;
}

function money(amount: number, currency: string): string {
  const symbol = currency === "INR" ? "₹" : `${currency} `;
  return `${symbol}${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

/** Days elapsed in the period (for the per-day average). */
function elapsedDays(period: DigestPeriod): number {
  const now = new Date();
  if (period === "today") return 1;
  if (period === "week") {
    // Monday = 1 … Sunday = 7
    return ((now.getDay() + 6) % 7) + 1;
  }
  return Math.max(1, now.getDate());
}

export function DigestSpendWidget({ raw, period }: Props) {
  let total = 0;
  let expenseDrops = 0;
  for (const [cat, amount] of Object.entries(raw.totalAmountByCategory)) {
    if (!cat.toLowerCase().includes("expense")) continue;
    total += amount;
  }
  for (const [cat, count] of Object.entries(raw.entryCountByCategory)) {
    if (!cat.toLowerCase().includes("expense")) continue;
    expenseDrops += count;
  }

  if (total <= 0 && expenseDrops === 0) return null;

  const currency = raw.biggestExpense?.currency ?? "INR";
  const days = elapsedDays(period);
  const perDay = days > 1 ? total / days : null;

  const periodLabel =
    period === "today" ? "today" : period === "week" ? "this week" : "this month";

  return (
    <div className="flex items-center gap-4 rounded-3xl bg-ink p-5 text-white md:p-6">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10">
        <Banknote size={22} className="text-white" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/60">
          Spent {periodLabel}
        </p>
        <p className="mt-0.5 truncate font-display text-[30px] leading-none tabular-nums md:text-4xl">
          {money(total, currency)}
        </p>
        <p className="mt-1.5 text-[13px] font-medium text-white/60">
          {expenseDrops} {expenseDrops === 1 ? "expense" : "expenses"}
          {perDay != null && (
            <>
              {" "}· ~{money(Math.round(perDay), currency)}/day
            </>
          )}
        </p>
      </div>
    </div>
  );
}
