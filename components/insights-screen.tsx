"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, RotateCw, Users } from "lucide-react";
import { toast } from "sonner";
import { Digest, DigestPeriod } from "@/types";
import { fetchDigest, type DigestResult } from "@/actions/digest";
import { getEntityIdByName } from "@/actions/entities";
import { DigestSegmentedControl } from "@/components/digest/segmented-control";
import { DigestNarrativeCard } from "@/components/digest/narrative-card";
import { DigestCategoryRow } from "@/components/digest/category-row";
import { DigestCalloutCard } from "@/components/digest/callout-card";
import { DigestEmptyState } from "@/components/digest/empty-state";
import { DigestSkeleton } from "@/components/digest/digest-skeleton";
import { DigestSpendWidget } from "@/components/digest/spend-widget";
import { formatEntityName } from "@/constants/entities";

interface View {
  period: DigestPeriod;
  data: Digest | null;
  error: string | null;
  pending: boolean;
}

function TopEntityCallout({ name, count }: { name: string; count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const open = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await getEntityIdByName(name);
      if (res.ok && res.id) {
        router.push(`/entities/${res.id}`);
      } else {
        toast.error("No linked drops found");
      }
    } catch {
      toast.error("Couldn't open entity");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void open()}
      disabled={busy}
      className="w-full text-left transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70"
      aria-label={`Open history for ${name}`}
    >
      <DigestCalloutCard
        title="Most Logged"
        value={formatEntityName(name)}
        subtitle={`${count} entries · tap to explore`}
        icon={Users}
        color="#7F77DD"
      />
    </button>
  );
}

export default function InsightsScreen() {
  const [period, setPeriod] = useState<DigestPeriod>("today");
  const [nonce, setNonce] = useState(0);
  const [view, setView] = useState<View>({
    period: "today",
    data: null,
    error: null,
    pending: true,
  });

  // Digests already resolved this session, so re-selecting a period is instant.
  const cache = useRef(new Map<DigestPeriod, DigestResult>());
  // Set before bumping nonce to force regeneration, bypassing the cache.
  const forceRef = useRef(false);

  useEffect(() => {
    if (cache.current.has(period) && !forceRef.current) {
      const cached = cache.current.get(period)!;
      setView({
        period,
        data: cached.digest,
        error: cached.error,
        pending: false,
      });
      return;
    }

    let active = true;
    setView((v) => ({ ...v, pending: true, error: null }));

    const force = forceRef.current;
    forceRef.current = false;
    fetchDigest(period, force)
      .then((result) => {
        if (!active) return;
        cache.current.set(period, result);
        setView({ period, data: result.digest, error: result.error, pending: false });
      })
      .catch((err) => {
        if (!active) return;
        console.error("[insights] digest failed:", err);
        setView({ period, data: null, error: "Couldn't load insights.", pending: false });
      });

    return () => {
      active = false;
    };
  }, [period, nonce]);

  // `view` still trails the selected period for one frame after a tap —
  // treating that as pending avoids flashing the previous period's content.
  const digest = view.period === period ? view.data : null;
  const error = view.period === period ? view.error : null;
  const pending = view.pending || view.period !== period;

  const retry = (force = false) => {
    cache.current.delete(period);
    forceRef.current = force;
    setNonce((n) => n + 1);
  };

  const raw = digest?.raw_data;
  const categories = Object.entries(raw?.entryCountByCategory ?? {});
  const hasEntries = categories.length > 0;

  return (
    <main className="mx-auto max-w-lg px-5 pb-32 pt-6 md:max-w-4xl md:px-8 md:pb-20 md:pt-8">
      <header className="flex items-center justify-between pb-5">
        <h1 className="font-display text-[32px] leading-none tracking-tight">
          Insights
        </h1>
        <button
          onClick={() => retry(true)}
          disabled={pending}
          aria-label="Regenerate insights"
          title="Regenerate insights"
          className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-ink-2 transition-colors hover:border-ink-3 hover:text-ink disabled:opacity-50"
        >
          <RotateCw size={17} className={pending ? "animate-spin" : undefined} />
        </button>
      </header>

      <DigestSegmentedControl
        selected={period}
        busy={pending}
        onSelect={(p) => {
          if (p !== period) setPeriod(p);
        }}
      />

      {pending ? (
        <DigestSkeleton />
      ) : error ? (
        <div className="flex flex-col items-center rounded-3xl border border-line bg-white px-6 py-14 text-center">
          <p className="font-display text-[22px] leading-tight text-ink">
            insights hit a <em className="italic text-danger">snag</em>.
          </p>
          <p className="mt-2 max-w-[32ch] text-sm leading-relaxed text-ink-2">
            {error}
          </p>
          <button
            onClick={() => retry()}
            className="mt-6 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Try again
          </button>
        </div>
      ) : !hasEntries || !raw ? (
        <DigestEmptyState />
      ) : (
        <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start md:gap-x-8">
          <div className="min-w-0 md:col-span-2">
            <DigestSpendWidget raw={raw} period={period} />
          </div>
          <div className="min-w-0 md:col-start-1 md:row-start-2">
            <DigestNarrativeCard
              narrative={digest!.narrative}
              updatedAt={digest!.generated_at}
            />
          </div>

          {/* Highlights sit above the long list on mobile, beside it on desktop */}
          <section className="min-w-0 md:col-start-2 md:row-start-2 md:row-span-3">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-3">
              Key Highlights
            </h2>
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-1 md:gap-3">
              {raw.biggestExpense && (
                <DigestCalloutCard
                  title="Biggest Expense"
                  value={`${raw.biggestExpense.currency} ${raw.biggestExpense.amount}`}
                  subtitle={raw.biggestExpense.summary}
                  icon={Banknote}
                  color="#1D9E75"
                />
              )}
              {raw.topEntity && (
                <TopEntityCallout name={raw.topEntity.name} count={raw.topEntity.count} />
              )}
            </div>
          </section>

          <section className="min-w-0 md:col-start-1 md:row-start-3">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-3">
              Activity Breakdown
            </h2>
            <div className="flex flex-col gap-2.5">
              {categories.map(([cat, count]) => (
                <DigestCategoryRow
                  key={cat}
                  category={cat}
                  count={count}
                  amount={raw.totalAmountByCategory[cat]}
                  currency={raw.biggestExpense?.currency}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
