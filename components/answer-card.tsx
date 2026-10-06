"use client";

import { Sparkles } from "lucide-react";

interface AnswerCardProps {
  answer: string;
}

/**
 * Neutral answer card: white, floating shadow, violet left accent bar.
 * Rendered ABOVE its sources inside each thread turn. No dismiss control —
 * clearing the thread is the header "New search" action (Task 3).
 */
export default function AnswerCard({ answer }: AnswerCardProps) {
  if (!answer) return null;

  return (
    <section
      aria-live="polite"
      className="turn-enter relative overflow-hidden rounded-2xl bg-white py-4 pl-5 pr-4 shadow-[0_10px_28px_-14px_rgba(26,26,26,0.28)]"
    >
      {/* Violet left accent bar (small accent only — no full fill) */}
      <span
        aria-hidden="true"
        className="absolute bottom-4 left-2.5 top-4 w-1 rounded-full bg-brand"
      />
      <div className="mb-2 flex items-center gap-1.5">
        <Sparkles size={14} className="shrink-0 text-brand" aria-hidden="true" />
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand">
          Memory Assistant
        </span>
      </div>
      <p className="text-[16px] leading-relaxed text-ink">{answer}</p>
    </section>
  );
}

/** Lightweight loading placeholder for the in-flight turn. */
export function AnswerCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="relative overflow-hidden rounded-2xl bg-white py-4 pl-5 pr-4 shadow-[0_10px_28px_-14px_rgba(26,26,26,0.28)]"
    >
      <span className="absolute bottom-4 left-2.5 top-4 w-1 rounded-full bg-brand/30" />
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
      className="turn-enter relative overflow-hidden rounded-2xl bg-white px-5 py-4 shadow-[0_10px_28px_-14px_rgba(26,26,26,0.28)]"
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
