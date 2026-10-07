"use client";

import { Sparkles } from "lucide-react";
import { formatEntityName } from "@/constants/entities";
import type { AnswerBreakdownItem } from "@/types";

interface AnswerCardProps {
  answer: string;
  breakdown?: AnswerBreakdownItem[] | null;
}

function money(amount: number, currency: string): string {
  const symbol = currency === "INR" ? "₹" : `${currency} `;
  return `${symbol}${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

function BreakdownTable({ rows }: { rows: AnswerBreakdownItem[] }) {
  const totals = new Map<string, number>();
  for (const r of rows) {
    totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.amount);
  }

  return (
    <div className="mt-3 overflow-hidden rounded-xl bg-paper">
      <ul className="divide-y divide-hairline">
        {rows.map((r, i) => (
          <li
            key={`${r.label}-${i}`}
            className="flex items-baseline justify-between gap-3 px-3.5 py-2"
          >
            <span className="truncate text-sm font-medium text-ink-2">
              {formatEntityName(r.label)}
            </span>
            <span className="shrink-0 text-sm font-bold tabular-nums text-ink">
              {money(r.amount, r.currency)}
            </span>
          </li>
        ))}
      </ul>
      <div className="border-t border-line bg-white px-3.5 py-2.5">
        {[...totals.entries()].map(([currency, total]) => (
          <div key={currency} className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-bold text-ink">
              Total{totals.size > 1 ? ` (${currency})` : ""}
            </span>
            <span className="font-display text-[17px] tabular-nums text-ink">
              {money(total, currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Neutral answer card: white, floating shadow, no border, no accent bar.
 * Rendered ABOVE its sources entry-point inside each thread turn.
 * No dismiss control — clearing the thread is the header "New search" action.
 */
export default function AnswerCard({ answer, breakdown }: AnswerCardProps) {
  if (!answer) return null;

  return (
    <section
      aria-live="polite"
      className="turn-enter rounded-2xl bg-white p-4 shadow-[0_10px_28px_-14px_rgba(26,26,26,0.28)]"
    >
      <div className="mb-2 flex items-center gap-1.5">
        <Sparkles size={14} className="shrink-0 text-brand" aria-hidden="true" />
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand">
          Memory Assistant
        </span>
      </div>
      <p className="text-[16px] leading-relaxed text-ink">{answer}</p>
      {breakdown && breakdown.length > 0 && (
        <BreakdownTable rows={breakdown} />
      )}
    </section>
  );
}

/** Lightweight loading placeholder for the in-flight turn. */
export function AnswerCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="rounded-2xl bg-white p-4 shadow-[0_10px_28px_-14px_rgba(26,26,26,0.28)]"
    >
      <div className="mb-3 h-3 w-32 animate-pulse rounded-full bg-line" />
      <div className="h-4 w-full animate-pulse rounded-md bg-hairline" />
      <div className="mt-2 h-4 w-4/5 animate-pulse rounded-md bg-hairline" />
      <div className="mt-2 h-4 w-3/5 animate-pulse rounded-md bg-hairline" />
    </div>
  );
}

interface AnswerErrorCardProps {
  onRetry: () => void;
}

/** Inline error for a failed turn — earlier turns stay intact. */
export function AnswerErrorCard({ onRetry }: AnswerErrorCardProps) {
  return (
    <section
      aria-live="polite"
      className="turn-enter rounded-2xl bg-white p-4 shadow-[0_10px_28px_-14px_rgba(26,26,26,0.28)]"
    >
      <p className="text-[15px] leading-relaxed text-ink">
        Something went wrong answering that. Your earlier results are still
        below.
      </p>
      <button
        type="button"
        onClick={onRetry}
        aria-label="Try again"
        className="mt-3 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Try again
      </button>
    </section>
  );
}
