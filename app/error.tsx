"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-paper px-6 text-center text-ink">
      <h1 className="font-display text-3xl leading-tight">
        Something went <em className="italic text-danger">wrong</em>.
      </h1>
      <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-ink-3">
        We couldn&apos;t load this screen right now. Your drops are safe.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          Try again
        </button>
        <Link
          href="/home"
          className="rounded-full border border-line bg-white px-6 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-ink-3"
        >
          Back home
        </Link>
      </div>
    </main>
  );
}

