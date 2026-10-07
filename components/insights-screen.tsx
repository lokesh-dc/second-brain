"use client";

import { useEffect, useRef, useState } from "react";
import { Banknote, Users } from "lucide-react";
import { Digest, DigestPeriod } from "@/types";
import { fetchDigest } from "@/actions/digest";
import { DigestSegmentedControl } from "@/components/digest/segmented-control";
import { DigestNarrativeCard } from "@/components/digest/narrative-card";
import { DigestCategoryRow } from "@/components/digest/category-row";
import { DigestCalloutCard } from "@/components/digest/callout-card";
import { DigestEmptyState } from "@/components/digest/empty-state";
import { DigestSkeleton } from "@/components/digest/digest-skeleton";
import { formatEntityName } from "@/constants/entities";

interface View {
  period: DigestPeriod;
  data: Digest | null;
  pending: boolean;
}

export default function InsightsScreen() {
  const [period, setPeriod] = useState<DigestPeriod>("today");
  const [view, setView] = useState<View>({
    period: "today",
    data: null,
    pending: true,
  });

  // Digests already resolved this session, so re-selecting a period is instant.
  const cache = useRef(new Map<DigestPeriod, Digest | null>());

  useEffect(() => {
    if (cache.current.has(period)) {
      setView({
        period,
        data: cache.current.get(period) ?? null,
        pending: false,
      });
      return;
    }

    let active = true;
    setView((v) => ({ ...v, pending: true }));

    fetchDigest(period)
      .then((result) => {
        if (!active) return;
        cache.current.set(period, result);
        setView({ period, data: result, pending: false });
      })
      .catch((err) => {
        if (!active) return;
        console.error("[insights] digest failed:", err);
        setView({ period, data: null, pending: false });
      });

    return () => {
      active = false;
    };
  }, [period]);

  // `view` still trails the selected period for one frame after a tap —
  // treating that as pending avoids flashing the previous period's content.
  const digest = view.period === period ? view.data : null;
  const pending = view.pending || view.period !== period;

  const raw = digest?.raw_data;
  const categories = Object.entries(raw?.entryCountByCategory ?? {});
  const hasEntries = categories.length > 0;

  return (
    <main className="mx-auto max-w-lg px-5 pb-32 pt-6 md:max-w-4xl md:px-8 md:pb-20 md:pt-8">
      <header className="pb-5">
        <h1 className="font-display text-[32px] leading-none tracking-tight">
          Insights
        </h1>
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
      ) : !hasEntries || !raw ? (
        <DigestEmptyState />
      ) : (
        <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start md:gap-x-8">
          <div className="min-w-0 md:col-start-1 md:row-start-1">
            <DigestNarrativeCard
              narrative={digest!.narrative}
              updatedAt={digest!.generated_at}
            />
          </div>

          {/* Highlights sit above the long list on mobile, beside it on desktop */}
          <section className="min-w-0 md:col-start-2 md:row-start-1 md:row-span-2">
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
                <DigestCalloutCard
                  title="Most Logged"
                  value={formatEntityName(raw.topEntity.name)}
                  subtitle={`${raw.topEntity.count} entries`}
                  icon={Users}
                  color="#7F77DD"
                />
              )}
            </div>
          </section>

          <section className="min-w-0 md:col-start-1 md:row-start-2">
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
