"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Search, Tags } from "lucide-react";
import { entityIconFor, formatEntityName } from "@/constants/entities";
import type { EntityWithMeta } from "@/actions/entities";

const EASE = [0.215, 0.61, 0.355, 1] as const;

function formatSpend(amount: number, currency: string | null): string {
  if (amount <= 0) return "";
  const symbol = currency === "INR" ? "₹" : currency ? `${currency} ` : "";
  return `${symbol}${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

export default function EntityIndexScreen({
  entities,
}: {
  entities: EntityWithMeta[];
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const types = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entities) {
      const t = (e.type || "other").toLowerCase();
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [entities]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entities.filter((e) => {
      if (typeFilter && (e.type || "other").toLowerCase() !== typeFilter)
        return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entities, query, typeFilter]);

  const total = entities.length;

  return (
    <main className="mx-auto max-w-lg px-5 pb-48 pt-8 md:max-w-4xl md:px-8 md:pb-16">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-3">
          people · places · books · brands
        </p>
        <div className="mt-2 flex items-baseline justify-between gap-4">
          <h1 className="font-display text-[32px] leading-none tracking-tight text-ink [text-wrap:balance]">
            entities<span className="text-brand">.</span>
          </h1>
          {total > 0 && (
            <p className="shrink-0 text-xs font-medium tabular-nums text-ink-3">
              {total} {total === 1 ? "entity" : "entities"}
            </p>
          )}
        </div>
        <div className="mt-6 h-px bg-line" />
      </header>

      {total === 0 ? (
        <div className="flex flex-col items-center pb-10 pt-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-ink text-white">
            <Tags size={24} />
          </span>
          <h2 className="mt-5 font-display text-[26px] leading-tight text-ink">
            no entities <em className="italic text-brand">yet</em>.
          </h2>
          <p className="mt-3 max-w-[32ch] text-sm leading-relaxed text-pretty text-ink-2">
            Drop a thought mentioning a place, person, book or brand — it will
            be tracked here automatically.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 flex items-center gap-2.5 rounded-2xl border border-line bg-white px-4 transition-colors focus-within:border-brand">
            <Search size={17} className="shrink-0 text-ink-3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people, places, books…"
              className="h-12 w-full bg-transparent text-[15px] font-medium text-ink outline-none placeholder:text-ink-3"
            />
          </div>

          {types.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => setTypeFilter(null)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  typeFilter === null
                    ? "bg-ink text-white"
                    : "border border-line bg-white text-ink-2 hover:border-ink-3"
                }`}
              >
                All
              </button>
              {types.map(([t, count]) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(typeFilter === t ? null : t)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold capitalize transition-colors ${
                    typeFilter === t
                      ? "bg-ink text-white"
                      : "border border-line bg-white text-ink-2 hover:border-ink-3"
                  }`}
                >
                  {t} · {count}
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="pt-12 text-center text-sm font-medium text-ink-3">
              nothing matches “{query.trim()}”.
            </p>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-3">
              {filtered.map((entity, i) => {
                const Icon = entityIconFor(entity.type);
                const spend = formatSpend(entity.spendTotal, entity.spendCurrency);
                return (
                  <motion.button
                    key={entity.id}
                    initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: reduceMotion ? 0 : 0.4,
                      delay: reduceMotion ? 0 : Math.min(i * 0.03, 0.3),
                      ease: EASE,
                    }}
                    onClick={() => router.push(`/entities/${entity.id}`)}
                    className="flex min-w-0 flex-col rounded-2xl border border-line bg-white p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-ink-3/40 hover:shadow-[0_12px_28px_-16px_rgba(26,26,26,0.25)] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-white">
                      <Icon size={19} />
                    </span>
                    <span className="mt-3 truncate text-[15px] font-semibold text-ink">
                      {formatEntityName(entity.name)}
                    </span>
                    <span className="mt-0.5 text-xs font-medium tabular-nums text-ink-3">
                      {entity.dropCount}{" "}
                      {entity.dropCount === 1 ? "drop" : "drops"}
                      {spend ? ` · ${spend}` : ""}
                    </span>
                    <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-3/70">
                      {entity.type || "entity"}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
}
