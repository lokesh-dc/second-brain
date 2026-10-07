"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  BookOpen,
  Brain,
  FolderX,
  Lightbulb,
  Plane,
  ReceiptText,
  Search,
  ShieldCheck,
  Sparkles,
  StickyNote,
  TableProperties,
  TrendingUp,
  Zap,
} from "lucide-react";

const EASE = [0.215, 0.61, 0.355, 1] as const;

const NAV_LINKS = [
  { label: "Problems", href: "#problems" },
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "Why Mindrop", href: "#why" },
];

const PROBLEMS = [
  {
    icon: StickyNote,
    tint: "#7F77DD",
    bg: "#EFEDFB",
    title: "Your head is a browser with 47 tabs open",
    body: "Expenses live in one app, book notes in another, trip ideas in WhatsApp chats with yourself. Nothing talks to anything. When you need it, it's gone.",
  },
  {
    icon: ReceiptText,
    tint: "#1D9E75",
    bg: "#E6F4EE",
    title: "Money evaporates from memory",
    body: "\u201CSpent \u20B980 on chai\u201D feels trivial — until April ends and \u20B96,400 of small spends have vanished with no record. Spreadsheets demand discipline you don't have at a tea stall.",
  },
  {
    icon: Lightbulb,
    tint: "#BA7517",
    bg: "#FAF1E0",
    title: "Ideas die in the notes graveyard",
    body: "You capture the startup idea, the gift for mom, the Coorg weekend plan — then never open that note again. Capture without recall is just hoarding.",
  },
  {
    icon: FolderX,
    tint: "#DC2626",
    bg: "#FBEAEA",
    title: "Folders and Ctrl+F can't answer real questions",
    body: "\u201CHow much did I spend on food in April?\u201D \u201CWhat did I read this week?\u201D No folder structure answers that. You need memory, not storage.",
  },
];

const FEATURES = [
  {
    icon: Zap,
    tint: "#7F77DD",
    bg: "#EFEDFB",
    tag: "Capture",
    title: "One box. Zero organizing.",
    body: "Type like you think — \u201Cspent 240 at Third Wave, idea: Coorg in Dec\u201D. No form, no category picker, no friction. One input handles expenses, books, travel, health, media.",
  },
  {
    icon: Brain,
    tint: "#1D9E75",
    bg: "#E6F4EE",
    tag: "Auto-classify",
    title: "It understands what you mean",
    body: "AI splits multi-item drops (\u201Cmilk 50, keyboard 1000\u201D becomes groceries + electronics), picks from 8 categories, and writes a clean past-tense summary. Always.",
  },
  {
    icon: Banknote,
    tint: "#BA7517",
    bg: "#FAF1E0",
    tag: "Extract",
    title: "Amounts, people, places — pulled out",
    body: "Every drop gets amounts + currency, entities (books, brands, people, movies), 2–4 tags, and a search-optimized embedding doc. Your mess becomes structured data.",
  },
  {
    icon: Search,
    tint: "#3B82F6",
    bg: "#E8F0FE",
    tag: "Hybrid recall",
    title: "Ask in plain English. Get answers.",
    body: "Vector search + structured filters fused with reciprocal-rank fusion. \u201CHow much on food in April?\u201D resolves the category, the time window, and the entity — in one query.",
  },
  {
    icon: TrendingUp,
    tint: "#A855F7",
    bg: "#F3EAFB",
    tag: "Digests",
    title: "Today, week, month — recapped for you",
    body: "Warm AI narratives over your real data: totals by category, biggest expense, most-mentioned entity. Cached for 24h so insights feel instant.",
  },
  {
    icon: ShieldCheck,
    tint: "#0F766E",
    bg: "#E0F2EF",
    tag: "Private",
    title: "Your keys never touch the browser",
    body: "Groq + Gemini run server-side only. Supabase RLS isolates every user. No client-exposed secrets, no cross-user leaks — memory that keeps secrets.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Drop it",
    body: "One line, as messy as real life. \u201CFinished Atomic Habits, spent 400 on Udan chai with Sara\u201D.",
    example: "spent ₹240 at Third Wave Coffee",
  },
  {
    n: "02",
    title: "Mindrop understands",
    body: "Splits, classifies, tags, links entities, embeds. Two entries from one line when it needs to be two.",
    example: "→ expense · food · ₹240 · Third Wave",
  },
  {
    n: "03",
    title: "Ask it back",
    body: "Search \u201Ccoffee with Sara?\u201D or open Insights for your week in two sentences.",
    example: "“how much on coffee this month?” → ₹1,120",
  },
];

const COMPARISON = [
  { label: "Capture", notes: "New note, pick folder", sheets: "Open sheet, find row", mindrop: "Type one line, done" },
  { label: "Organizing", notes: "You do it manually", sheets: "You design schema", mindrop: "AI classifies + tags" },
  { label: "“Spend in April?”", notes: "Ctrl+F, good luck", sheets: "Pivot table pain", mindrop: "Ask, get ₹ total" },
  { label: "Recall", notes: "Keyword match only", sheets: "Exact cells only", mindrop: "Meaning + filters" },
  { label: "Review", notes: "Scroll forever", sheets: "Charts you build", mindrop: "Auto digest narrative" },
];

const DEMO_RESULTS: Record<string, { category: string; color: string; summary: string; tags: string[]; amount: string }> = {
  chai: {
    category: "expense",
    color: "#22c55e",
    summary: "Spent ₹80 on chai (food).",
    tags: ["food", "chai", "daily"],
    amount: "₹80 · INR",
  },
  book: {
    category: "reading",
    color: "#f59e0b",
    summary: "Finished reading Atomic Habits.",
    tags: ["books", "habits", "finished"],
    amount: "no amount",
  },
  trip: {
    category: "travel",
    color: "#3b82f6",
    summary: "Idea: weekend trip to Coorg in December.",
    tags: ["travel", "coorg", "idea"],
    amount: "no amount",
  },
};

function classifyDemo(text: string) {
  const t = text.toLowerCase();
  if (/(spent|paid|bought|₹|\brs\b|chai|coffee|grocer|milk|bread)/.test(t))
    return DEMO_RESULTS.chai;
  if (/(read|book|atomic|finished)/.test(t)) return DEMO_RESULTS.book;
  return DEMO_RESULTS.trip;
}

function DemoCapture() {
  const [value, setValue] = useState("spent 80 on chai with Sara");
  const [result, setResult] = useState(() => classifyDemo("spent 80 on chai"));
  const [pulse, setPulse] = useState(false);

  const run = (text: string) => {
    setPulse(true);
    setTimeout(() => {
      setResult(classifyDemo(text));
      setPulse(false);
    }, 450);
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-[0_32px_80px_-32px_rgba(127,119,221,0.35)]">
      <div className="flex items-center gap-1.5 border-b border-hairline px-5 py-3.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
        <span className="ml-3 text-xs font-semibold text-ink-3">mindrop — capture</span>
      </div>
      <div className="p-5 md:p-6">
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3.5 focus-within:border-brand">
          <Sparkles size={17} className="shrink-0 text-brand" />
          <input
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              run(e.target.value);
            }}
            placeholder="Type anything in your head…"
            className="w-full bg-transparent text-[15px] font-medium text-ink outline-none placeholder:text-ink-3"
          />
          <kbd className="hidden shrink-0 rounded-md bg-ink px-2 py-1 text-[11px] font-bold text-white sm:block">
            ⏎
          </kbd>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {["spent 80 on chai with Sara", "finished reading Atomic Habits", "idea: Coorg trip in Dec"].map(
            (ex) => (
              <button
                key={ex}
                onClick={() => {
                  setValue(ex);
                  run(ex);
                }}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  value === ex
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-white text-ink-2 hover:border-ink-3"
                }`}
              >
                {ex}
              </button>
            ),
          )}
        </div>

        <motion.div
          key={result.summary}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: pulse ? 0.4 : 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="mt-4 rounded-2xl bg-paper p-4"
        >
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: result.color }} />
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">
              {pulse ? "understanding…" : `→ ${result.category}`}
            </span>
            <span className="ml-auto text-xs font-bold tabular-nums text-ink-2">{result.amount}</span>
          </div>
          <p className="mt-2 font-display text-lg leading-snug text-ink">{result.summary}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {result.tags.map((t) => (
              <span key={t} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-2 ring-1 ring-line">
                #{t}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();

  const start = () => {
    document.cookie = "onboarding_complete=true; path=/; max-age=31536000";
    router.push("/login");
  };

  return (
    <main className="min-h-dvh bg-paper text-ink">
      {/* ── Nav ─────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-hairline bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-8">
          <span className="font-display text-[22px] italic tracking-tight">
            Mindrop<span className="not-italic text-brand">.</span>
          </span>
          <nav className="hidden items-center gap-7 text-sm font-medium text-ink-2 md:flex">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="transition-colors hover:text-ink">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => router.push("/login")}
              className="hidden rounded-full px-4 py-2 text-sm font-semibold text-ink-2 transition-colors hover:text-ink sm:block"
            >
              Sign in
            </button>
            <button
              onClick={start}
              className="group flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Start free
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-[20vw] -top-[10vh] h-[560px] w-[560px] rounded-full opacity-[0.07]"
          style={{ backgroundColor: "#7F77DD" }}
        />
        <div className="mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-14 md:grid-cols-2 md:items-center md:px-8 md:pb-24 md:pt-20">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-2"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              Your second brain
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05, ease: EASE }}
              className="font-display text-[44px] leading-[1.04] tracking-tight [text-wrap:balance] md:text-[64px]"
            >
              One box for everything in <em className="italic text-brand">your head.</em>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12, ease: EASE }}
              className="mt-5 max-w-[46ch] text-[16px] leading-7 text-ink-2"
            >
              Expenses, ideas, books, travel — just type it. Mindrop classifies it,
              remembers the amounts, and answers when you ask. No folders. No spreadsheets. No organizing.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <button
                onClick={start}
                className="group flex h-13 items-center justify-center gap-2 rounded-full bg-brand px-7 py-3.5 font-semibold text-white shadow-[0_16px_32px_-12px_rgba(127,119,221,0.6)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Start capturing — it&apos;s free
                <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
              </button>
              <a
                href="#how"
                className="flex items-center justify-center gap-2 rounded-full border border-line bg-white px-7 py-3.5 font-semibold text-ink transition-colors hover:border-ink-3"
              >
                See how it works
              </a>
            </motion.div>
            <div className="mt-8 flex items-center gap-6 text-[13px] font-medium text-ink-3">
              <span className="flex items-center gap-1.5">
                <Zap size={14} className="text-brand" /> No setup rituals
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-success" /> Private by design
              </span>
              <span className="hidden items-center gap-1.5 sm:flex">
                <Search size={14} /> Recall in seconds
              </span>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
          >
            <DemoCapture />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-line bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">This month</p>
                <p className="mt-1 font-display text-2xl">₹6,400</p>
                <p className="text-xs font-medium text-ink-2">across 23 drops · food leads</p>
              </div>
              <div className="rounded-2xl border border-line bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">Asked back</p>
                <p className="mt-1 font-display text-2xl">“chai in April?”</p>
                <p className="text-xs font-medium text-ink-2">→ 14 memories, ranked</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Problems ────────────────────────────── */}
      <section id="problems" className="scroll-mt-20 border-t border-hairline bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-danger">
            The problem
          </p>
          <h2 className="mt-3 max-w-[22ch] font-display text-3xl leading-[1.1] tracking-tight md:text-5xl">
            You don&apos;t have a memory problem. You have a <em className="italic text-brand">system</em> problem.
          </h2>
          <p className="mt-4 max-w-[60ch] text-[15px] leading-7 text-ink-2">
            Notes apps store. Spreadsheets tabulate. Neither remembers. Mindrop was built for
            the gap between “I wrote it down somewhere” and “I actually know the answer.”
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {PROBLEMS.map((p, i) => (
              <motion.article
                key={p.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: i * 0.06, ease: EASE }}
                className="rounded-3xl border border-line bg-paper p-6 md:p-7"
              >
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: p.bg, color: p.tint }}
                >
                  <p.icon size={20} />
                </span>
                <h3 className="mt-4 font-display text-xl leading-snug">{p.title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-2">{p.body}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why built ───────────────────────────── */}
      <section className="border-t border-hairline">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-[1fr_1.2fr] md:items-center md:px-8 md:py-24">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-success">
              Why was this built
            </p>
            <h2 className="mt-3 font-display text-3xl leading-[1.1] tracking-tight md:text-[42px]">
              Built by someone tired of <em className="italic text-success">losing his own life.</em>
            </h2>
          </div>
          <div className="space-y-4 text-[15px] leading-7 text-ink-2">
            <p>
              Mindrop started as a personal fix: expenses scribbled and forgotten, book titles
              lost the week after finishing, trip ideas buried in chat history. The tools all
              demanded the same thing — <strong className="font-semibold text-ink">you</strong> doing
              the organizing, forever.
            </p>
            <p>
              So we flipped it. You bring the raw thought, exactly as it arrives —
              <span className="rounded-md bg-white px-1.5 py-0.5 font-medium text-ink ring-1 ring-line">
                “spent 80 on chai”
              </span>{" "}
              — and the product does the librarian work: splitting, classifying, tagging,
              linking people and places, and filing it where your future self can find it.
            </p>
            <p>
              The bet is simple: <strong className="font-semibold text-ink">capture should be instant,
              recall should feel like memory.</strong> If you have to think about folders, the tool failed.
            </p>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────── */}
      <section id="features" className="scroll-mt-20 bg-ink text-white">
        <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#B9B3F0]">
            Features
          </p>
          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <h2 className="max-w-[20ch] font-display text-3xl leading-[1.1] tracking-tight md:text-5xl">
              Everything you&apos;d want a <em className="italic text-[#B9B3F0]">second mind</em> to do.
            </h2>
            <p className="max-w-[38ch] text-sm leading-6 text-white/60">
              Six capabilities, one flow. Every feature below is live in the product — not a roadmap promise.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.article
                key={f.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: (i % 3) * 0.07, ease: EASE }}
                className="group rounded-3xl bg-white/[0.06] p-6 ring-1 ring-white/10 transition-colors hover:bg-white/[0.09] md:p-7"
              >
                <div className="flex items-center justify-between">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: f.bg, color: f.tint }}
                  >
                    <f.icon size={20} />
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white/70">
                    {f.tag}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-[22px] leading-tight">{f.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/65">{f.body}</p>
              </motion.article>
            ))}
          </div>

          {/* category strip */}
          <div className="mt-8 flex flex-wrap items-center gap-2.5 rounded-3xl bg-white/[0.04] p-5 ring-1 ring-white/10">
            <span className="mr-2 text-xs font-bold uppercase tracking-[0.14em] text-white/50">
              Auto-sorted into
            </span>
            {[
              { n: "Expenses", c: "#f87171", i: Banknote },
              { n: "Reading", c: "#60a5fa", i: BookOpen },
              { n: "Travel", c: "#34d399", i: Plane },
              { n: "Ideas", c: "#fbbf24", i: Lightbulb },
            ].map((c) => (
              <span
                key={c.n}
                className="flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-[13px] font-semibold"
              >
                <c.i size={14} style={{ color: c.c }} /> {c.n}
              </span>
            ))}
            <span className="text-[13px] font-medium text-white/50">+ shopping, health, media, misc</span>
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────── */}
      <section id="how" className="scroll-mt-20 border-t border-hairline bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">How it works</p>
          <h2 className="mt-3 max-w-[24ch] font-display text-3xl leading-[1.1] tracking-tight md:text-5xl">
            Drop it. Forget it. <em className="italic text-brand">Ask for it back.</em>
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
                className="rounded-3xl border border-line bg-paper p-6 md:p-7"
              >
                <p className="font-display text-4xl italic text-ink-3">{s.n}</p>
                <h3 className="mt-3 font-display text-2xl">{s.title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-2">{s.body}</p>
                <p className="mt-4 rounded-xl bg-white px-3.5 py-2.5 font-mono text-[13px] font-medium text-ink ring-1 ring-line">
                  {s.example}
                </p>
              </motion.div>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-3 rounded-3xl bg-paper p-6 ring-1 ring-line sm:flex-row sm:items-center md:p-7">
            <Search size={20} className="shrink-0 text-brand" />
            <p className="text-sm leading-6 text-ink-2">
              <strong className="font-semibold text-ink">Try asking:</strong> “how much on food in
              April?” · “what did I read this week?” · “ideas about Coorg” — time, category and
              entity filters resolve automatically.
            </p>
          </div>
        </div>
      </section>

      {/* ── Why Mindrop ─────────────────────────── */}
      <section id="why" className="scroll-mt-20 border-t border-hairline">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-[1fr_1.15fr] md:px-8 md:py-24">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-caramel">
              Why Mindrop
            </p>
            <h2 className="mt-3 font-display text-3xl leading-[1.1] tracking-tight md:text-[42px]">
              Why should you <em className="italic text-caramel">actually</em> use this?
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-ink-2">
              Because every alternative makes <em>you</em> the database. Mindrop is the only
              option where capture takes seconds and answers come back with numbers.
            </p>
            <button
              onClick={start}
              className="group mt-7 flex items-center gap-2 rounded-full bg-ink px-6 py-3 font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Claim your memory
              <ArrowUpRight size={17} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
            <div className="mt-6 space-y-2.5 text-sm font-medium text-ink-2">
              {["Recall beats storage — answers, not files", "Exact amounts, not vibes", "Weekly digest writes itself"].map(
                (t) => (
                  <p key={t} className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/15 text-[11px] font-bold text-success">
                      ✓
                    </span>
                    {t}
                  </p>
                ),
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-line bg-white">
            <div className="grid grid-cols-[1.1fr_1fr_1fr_1fr] gap-px bg-hairline text-[13px]">
              <div className="bg-white p-4" />
              <div className="flex items-center gap-1.5 bg-white p-4 font-bold text-ink-3">
                <StickyNote size={14} /> Notes
              </div>
              <div className="flex items-center gap-1.5 bg-white p-4 font-bold text-ink-3">
                <TableProperties size={14} /> Sheets
              </div>
              <div className="bg-ink p-4 font-bold text-white">Mindrop</div>
              {COMPARISON.map((r) => (
                <ComparisonRow key={r.label} {...r} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Digest teaser ───────────────────────── */}
      <section className="border-t border-hairline bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-2 md:items-center md:px-8 md:py-24">
          <div className="rounded-3xl bg-ink p-6 text-white md:p-8">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white/70">
                This week
              </span>
              <span className="ml-auto text-xs font-medium text-white/50">auto-generated</span>
            </div>
            <p className="mt-4 font-display text-[22px] leading-snug">
              “Busy, tasty week — 12 drops across food and reading. ₹2,340 on eating out
              (Third Wave twice 👀), finished Atomic Habits, and the Coorg plan is picking up steam.”
            </p>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              {[
                { k: "12 drops", v: "logged" },
                { k: "₹2,340", v: "on food" },
                { k: "Coorg", v: "top entity" },
              ].map((s) => (
                <div key={s.k} className="rounded-2xl bg-white/[0.07] px-2 py-3 ring-1 ring-white/10">
                  <p className="font-display text-lg">{s.k}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{s.v}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">
              Insights without effort
            </p>
            <h2 className="mt-3 font-display text-3xl leading-[1.1] tracking-tight md:text-[42px]">
              Your week, <em className="italic text-brand">narrated back</em> to you.
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-ink-2">
              Open Insights and get today, this week, this month in two warm sentences —
              grounded in your real totals, biggest expense, and most-mentioned people and places.
              No dashboard to configure. It just knows.
            </p>
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────── */}
      <section className="border-t border-hairline">
        <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
          <div className="relative overflow-hidden rounded-[32px] bg-brand px-6 py-14 text-center text-white md:py-20">
            <div
              aria-hidden
              className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-ink/15"
            />
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">
              Free to start · 30 seconds to first drop
            </p>
            <h2 className="mx-auto mt-4 max-w-[20ch] font-display text-4xl leading-[1.05] tracking-tight md:text-6xl">
              Stop losing thoughts. Start <em className="italic">dropping</em> them.
            </h2>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                onClick={start}
                className="group flex items-center gap-2 rounded-full bg-white px-8 py-4 font-semibold text-ink transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Get started free
                <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
              </button>
              <button
                onClick={() => router.push("/login")}
                className="rounded-full px-8 py-4 font-semibold text-white ring-1 ring-white/40 transition-colors hover:bg-white/10"
              >
                I have an account
              </button>
            </div>
          </div>
          <footer className="mt-10 flex flex-col items-center justify-between gap-4 text-[13px] font-medium text-ink-3 sm:flex-row">
            <span className="font-display text-lg italic text-ink">
              Mindrop<span className="not-italic text-brand">.</span>
            </span>
            <span>One box for everything in your head.</span>
            <span>Built for people who think fast and forget faster.</span>
          </footer>
        </div>
      </section>
    </main>
  );
}

function ComparisonRow({
  label,
  notes,
  sheets,
  mindrop,
}: {
  label: string;
  notes: string;
  sheets: string;
  mindrop: string;
}) {
  return (
    <>
      <div className="bg-white p-4 font-bold text-ink">{label}</div>
      <div className="bg-white p-4 text-ink-2">{notes}</div>
      <div className="bg-white p-4 text-ink-2">{sheets}</div>
      <div className="bg-ink/95 p-4 font-semibold text-white">{mindrop}</div>
    </>
  );
}
