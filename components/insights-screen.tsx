"use client";

import { useEffect, useState } from "react";
import { Banknote, Loader2, Users } from "lucide-react";
import { DigestPeriod } from "@/types";
import { fetchDigest } from "@/actions/digest";
import { DigestSegmentedControl } from "@/components/digest/segmented-control";
import { DigestNarrativeCard } from "@/components/digest/narrative-card";
import { DigestCategoryRow } from "@/components/digest/category-row";
import { DigestCalloutCard } from "@/components/digest/callout-card";
import { DigestEmptyState } from "@/components/digest/empty-state";

export default function InsightsScreen() {
  const [period, setPeriod] = useState<DigestPeriod>("today");
  const [digest, setDigest] = useState<Awaited<
    ReturnType<typeof fetchDigest>
  >>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchDigest(period).then((result) => {
      if (!active) return;
      setDigest(result);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [period]);

  const hasEntries =
    digest && Object.keys(digest.raw_data.entryCountByCategory).length > 0;

  return (
    <main className="mx-auto max-w-lg pb-32">
      <header className="px-5 pb-4 pt-6">
        <h1 className="font-display text-[32px]">Insights</h1>
      </header>

      <DigestSegmentedControl
        selected={period}
        onSelect={(p) => {
          setPeriod(p);
          setLoading(true);
        }}
      />

      {loading && !digest ? (
        <div className="flex flex-col items-center pt-16">
          <Loader2 size={36} className="animate-spin text-brand" />
          <p className="mt-4 text-base text-[#666666]">
            Generating your digest...
          </p>
        </div>
      ) : !hasEntries ? (
        <DigestEmptyState />
      ) : (
        <>
          {digest && (
            <DigestNarrativeCard
              narrative={digest.narrative}
              updatedAt={digest.generated_at}
            />
          )}

          {/* Activity Breakdown */}
          <section className="mb-6 mt-3">
            <h2 className="mb-4 px-5 text-sm font-bold uppercase tracking-widest text-ink-3">
              Activity Breakdown
            </h2>
            {Object.entries(digest!.raw_data.entryCountByCategory).map(
              ([cat, count]) => (
                <DigestCategoryRow
                  key={cat}
                  category={cat}
                  count={count}
                  amount={digest!.raw_data.totalAmountByCategory[cat]}
                  currency={digest!.raw_data.biggestExpense?.currency}
                />
              ),
            )}
          </section>

          {/* Key Highlights */}
          <section>
            <h2 className="mb-4 px-5 text-sm font-bold uppercase tracking-widest text-ink-3">
              Key Highlights
            </h2>
            <div className="overflow-x-auto px-5 pb-2">
              <div className="flex w-max">
                {digest!.raw_data.biggestExpense && (
                  <DigestCalloutCard
                    title="Biggest Expense"
                    value={`${digest!.raw_data.biggestExpense.currency} ${digest!.raw_data.biggestExpense.amount}`}
                    subtitle={digest!.raw_data.biggestExpense.summary}
                    icon={Banknote}
                    color="#1D9E75"
                  />
                )}
                {digest!.raw_data.topEntity && (
                  <DigestCalloutCard
                    title="Most Logged"
                    value={digest!.raw_data.topEntity.name}
                    subtitle={`${digest!.raw_data.topEntity.count} entries`}
                    icon={Users}
                    color="#7F77DD"
                  />
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
