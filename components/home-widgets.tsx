"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  Banknote,
  LayoutGrid,
  Search,
  Sparkles,
} from "lucide-react";
import { EntityNameButton } from "./entity-link";
import type { HomeWidgets } from "@/actions/home";

const EASE = [0.215, 0.61, 0.355, 1] as const;

function formatSpend(amount: number, currency: string): string {
  const symbol = currency === "INR" ? "₹" : `${currency} `;
  return `${symbol}${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

export default function HomeWidgets({
  widgets,
  layout = "grid",
}: {
  widgets: HomeWidgets;
  layout?: "grid" | "rail";
}) {
  const reduceMotion = useReducedMotion();
  const anim = (i: number) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, delay: Math.min(i * 0.06, 0.3), ease: EASE },
  });

  const isRail = layout === "rail";
  const router = useRouter();

  return (
    <section aria-label="Overview" className="mt-6 flex flex-col gap-3">
      {/* ── Briefing + spend bento ── */}
      <div className={isRail ? "flex flex-col gap-3" : "grid gap-3 md:grid-cols-3"}>
        <motion.div {...anim(0)} className={isRail ? undefined : "md:col-span-2"}>
          {widgets.briefing ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => router.push("/insights")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push("/insights");
                }
              }}
              className="group block h-full cursor-pointer rounded-3xl bg-ink p-5 text-white transition-transform hover:scale-[1.005] active:scale-[0.995] md:p-6"
            >
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white/70">
                  <Sparkles size={12} /> Today&apos;s briefing
                </span>
                <ArrowUpRight
                  size={16}
                  className="ml-auto text-white/50 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </div>
              <p className="mt-3 line-clamp-3 font-display text-[19px] leading-snug md:text-[21px]">
                &ldquo;{widgets.briefing.narrative}&rdquo;
              </p>
              {(widgets.briefing.biggestExpense || widgets.briefing.topEntity) && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                  {widgets.briefing.biggestExpense && (
                    <span className="rounded-full bg-white/10 px-3 py-1.5">
                      Top spend · {widgets.briefing.biggestExpense.currency}{" "}
                      {widgets.briefing.biggestExpense.amount}
                    </span>
                  )}
                  {widgets.briefing.topEntity && (
                    <span className="rounded-full bg-white/10 px-3 py-1.5">
                      Top entity ·{" "}
                      <EntityNameButton
                        name={widgets.briefing.topEntity.name}
                        className="font-bold underline-offset-2 hover:underline"
                      />
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/insights"
              className="group block h-full rounded-3xl border border-dashed border-line bg-white p-5 transition-colors hover:border-brand md:p-6"
            >
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-brand">
                <Sparkles size={12} /> Morning briefing
              </span>
              <p className="mt-3 font-display text-[19px] leading-snug text-ink md:text-[21px]">
                Open Insights to generate today&apos;s recap — two sentences on
                your money, books and ideas.
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-ink-2 transition-colors group-hover:text-ink">
                Generate briefing <ArrowUpRight size={15} />
              </span>
            </Link>
          )}
        </motion.div>

        <motion.div
          {...anim(1)}
          className="flex flex-col justify-between rounded-3xl border border-line bg-white p-5 md:p-6"
        >
          <div className="flex items-center justify-between">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#E6F4EE]">
              <Banknote size={19} color="#1D9E75" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">
              {widgets.monthLabel}
            </span>
          </div>
          <div className="mt-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">
              Spent this month
            </p>
            <p className="mt-1 font-display text-[32px] leading-none tabular-nums">
              {formatSpend(widgets.monthSpend, widgets.monthSpendCurrency)}
            </p>
            <Link
              href="/insights"
              className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-success hover:underline"
            >
              Breakdown in Insights <ArrowUpRight size={13} />
            </Link>
          </div>
        </motion.div>
      </div>

      {/* ── Quick actions: 3-column grid that fits small phones ── */}
      <motion.nav
        {...anim(2)}
        aria-label="Quick actions"
        className={isRail ? "flex flex-col gap-2" : "grid grid-cols-3 gap-2"}
      >
        <Link
          href="/search"
          className={
            isRail
              ? "flex items-center justify-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-[13px] font-semibold text-white transition-transform hover:scale-[1.01] active:scale-[0.99]"
              : "flex flex-col items-center justify-center gap-1 rounded-2xl bg-ink px-1 py-3 text-[11px] font-semibold text-white transition-transform hover:scale-[1.01] active:scale-[0.99] sm:flex-row sm:gap-1.5 sm:rounded-full sm:px-4 sm:py-2.5 sm:text-[13px]"
          }
        >
          <Search size={15} className="shrink-0" />
          <span className="sm:hidden">Ask</span>
          <span className="hidden sm:inline">Ask your mind</span>
        </Link>
        <Link
          href="/insights"
          className={
            isRail
              ? "flex items-center justify-center gap-1.5 rounded-full border border-line bg-white px-4 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:border-ink-3"
              : "flex flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-white px-1 py-3 text-[11px] font-semibold text-ink transition-colors hover:border-ink-3 sm:flex-row sm:gap-1.5 sm:rounded-full sm:px-4 sm:py-2.5 sm:text-[13px]"
          }
        >
          <Sparkles size={15} className="shrink-0 text-brand" /> Insights
        </Link>
        <Link
          href="/categories"
          className={
            isRail
              ? "flex items-center justify-center gap-1.5 rounded-full border border-line bg-white px-4 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:border-ink-3"
              : "flex flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-white px-1 py-3 text-[11px] font-semibold text-ink transition-colors hover:border-ink-3 sm:flex-row sm:gap-1.5 sm:rounded-full sm:px-4 sm:py-2.5 sm:text-[13px]"
          }
        >
          <LayoutGrid size={15} className="shrink-0 text-ink-3" /> Categories
        </Link>
      </motion.nav>
    </section>
  );
}
