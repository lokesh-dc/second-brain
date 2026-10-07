"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Check, Loader2, Plus, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { ALL_CATEGORY_NAMES, getCategoryConfig } from "@/constants/categories";
import { logEntry } from "@/actions/entries";

const CaptureContext = createContext<{ open: () => void }>({
  open: () => {},
});

export const useCapture = () => useContext(CaptureContext);

const EXAMPLES = [
  "spent ₹240 at Third Wave with Sara",
  "idea: weekend trip to Coorg in December",
  "finished reading Atomic Habits",
];

// Instant client-side guess so the dialog never shows a wrong hardcoded
// chip. This is only a *hint* passed to the AI — it still splits distinct
// facts (e.g. a trip vs its fare) into separate items.
const CATEGORY_KEYWORDS: { name: string; words: string[] }[] = [
  {
    name: "Travel",
    words: ["trip", "travel", "flight", "hotel", "hostel", "bus", "train", "taxi", "cab", "vacation", "holiday", "stay", "check-in", "checkin", "airport", "station"],
  },
  {
    name: "Expenses",
    words: ["spent", "paid", "bought", "pay", "fare", "cost", "bill", "rent", "fee", "ticket", "price", "purchase", "ordered", "₹", "rs.", "rs "],
  },
  {
    name: "Reading",
    words: ["read", "reading", "book", "novel", "article", "blog"],
  },
  {
    name: "Ideas",
    words: ["idea", "thought", "startup", "plan", "someday", "what if"],
  },
  {
    name: "Shopping",
    words: ["shopping", "amazon", "flipkart", "shoes", "clothes", "shirt", "order"],
  },
  {
    name: "Health",
    words: ["gym", "run", "running", "doctor", "workout", "yoga", "sleep", "weight", "health"],
  },
  {
    name: "Media",
    words: ["movie", "watched", "song", "show", "series", "game", "anime", "podcast"],
  },
];

function guessCategories(text: string): string[] {
  const t = ` ${text.toLowerCase()} `;
  const hits: string[] = [];
  for (const { name, words } of CATEGORY_KEYWORDS) {
    if (words.some((w) => t.includes(w))) hits.push(name);
    if (hits.length >= 2) break;
  }
  return hits;
}

function CaptureDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  // User-corrected categories (null = let the AI decide). Passed as a hint,
  // not a constraint — the AI still splits distinct facts into separate items.
  const [override, setOverride] = useState<string[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open ]);

  const close = useCallback(() => {
    setText("");
    setOverride(null);
    setPickerOpen(false);
    onClose();
  }, [onClose]);

  const submit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const res = await logEntry(trimmed, override ?? undefined);
      if (!res.ok) {
        toast.error(res.error || "Couldn't log that. Try again.");
        return;
      }
      setText("");
      setOverride(null);
      setPickerOpen(false);
      onClose();
      toast.success("Logged to your mind");
      router.refresh();
    } catch {
      toast.error("Couldn't log that. Try again.");
    } finally {
      setSaving(false);
    }
  }, [text, saving, override, onClose, router]);

  // Esc to close, Cmd/Ctrl+Enter to save
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, submit]);

  const autogrow = () => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  };

  const toggleOverride = (name: string) => {
    setOverride((prev) => {
      const base = prev ?? guessCategories(text);
      if (base.includes(name)) {
        const next = base.filter((n) => n !== name);
        return next.length === 0 ? null : next;
      }
      if (base.length >= 3) return base;
      return [...base, name];
    });
  };

  const guessed = guessCategories(text);
  const shown = override ?? guessed;

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="New drop"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
            className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ opacity: 0, y: 48, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 48, scale: 0.98 }}
            transition={{ duration: 0.32, ease: [0.215, 0.61, 0.355, 1] }}
            className="relative max-h-[88dvh] w-full overflow-y-auto rounded-t-[28px] bg-paper p-6 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] shadow-2xl sm:max-w-lg sm:rounded-[28px] sm:p-7 sm:pb-7"
          >
            {/* Mobile grab handle */}
            <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-line sm:hidden" />

            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">
                New drop
              </p>
              <button
                onClick={close}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-full text-ink-3 transition-colors hover:bg-white hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <textarea
              ref={areaRef}
              autoFocus
              value={text}
              rows={3}
              onChange={(e) => {
                setText(e.target.value);
                autogrow();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="What's on your mind?"
              className="mt-3 max-h-[220px] min-h-[110px] w-full resize-none bg-transparent font-display text-[22px] leading-snug text-ink outline-none placeholder:text-ink-3"
            />

            {shown.length > 0 && (
              <div className="mt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-medium text-ink-3">
                    {override ? "You picked" : "Looks like"}
                  </span>
                  {shown.map((name) => {
                    const c = getCategoryConfig(name);
                    const CatIcon = c.icon;
                    return (
                      <span
                        key={name}
                        className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-ink"
                      >
                        <CatIcon size={13} color={c.accent} />
                        {name}
                      </span>
                    );
                  })}
                  <button
                    onClick={() => setPickerOpen((o) => !o)}
                    aria-expanded={pickerOpen}
                    className="rounded-full px-2 py-1 text-xs font-bold text-brand hover:underline"
                  >
                    {pickerOpen ? "Done" : "Change"}
                  </button>
                </div>

                {pickerOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3"
                  >
                    <div className="grid grid-cols-4 gap-2">
                      {ALL_CATEGORY_NAMES.map((name) => {
                        const c = getCategoryConfig(name);
                        const CatIcon = c.icon;
                        const selected = (override ?? guessed).includes(name);
                        return (
                          <button
                            key={name}
                            onClick={() => toggleOverride(name)}
                            aria-pressed={selected}
                            className={`flex flex-col items-center gap-1.5 rounded-2xl border px-1 py-3 transition-colors ${
                              selected
                                ? "border-ink bg-ink text-white"
                                : "border-line bg-white text-ink-2 hover:border-ink-3"
                            }`}
                          >
                            <span
                              className="grid h-8 w-8 place-items-center rounded-xl"
                              style={{
                                backgroundColor: selected
                                  ? "rgba(255,255,255,0.15)"
                                  : `${c.accent}1A`,
                              }}
                            >
                              <CatIcon
                                size={16}
                                color={selected ? "#fff" : c.accent}
                              />
                            </span>
                            <span className="text-[11px] font-semibold">
                              {name}
                            </span>
                            {selected && (
                              <Check size={12} className="text-white/70" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs text-ink-3">
                        A hint for the AI — it still splits trips from fares.
                      </p>
                      {override && (
                        <button
                          onClick={() => setOverride(null)}
                          className="shrink-0 rounded-full px-2 py-1 text-xs font-bold text-ink-2 hover:text-ink"
                        >
                          Reset to auto
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {text.trim().length === 0 ? (
              <div className="mt-4 flex flex-col gap-2">
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink-3">
                  <Sparkles size={14} className="text-brand" />
                  AI sorts it into categories, amounts &amp; tags — you just type.
                </p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => {
                        setText(ex);
                        requestAnimationFrame(autogrow);
                        areaRef.current?.focus();
                      }}
                      className="rounded-full border border-line bg-white px-3.5 py-1.5 text-xs font-semibold text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-3 flex items-center gap-1.5 text-[13px] font-medium text-ink-3">
                <Sparkles size={14} className="text-brand" />
                Mindrop will classify, tag &amp; file this automatically.
              </p>
            )}

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-hairline pt-4">
              <span className="hidden text-xs font-medium text-ink-3 sm:block">
                ⌘↵ to save · esc to close
              </span>
              <span className="text-xs font-medium text-ink-3 sm:hidden">
                one line is enough
              </span>
              <button
                onClick={submit}
                disabled={!text.trim() || saving}
                className="flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Logging…
                  </>
                ) : (
                  <>
                    Drop it <ArrowUp size={16} />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function CaptureProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openDialog = useCallback(() => setOpen(true), []);
  const closeDialog = useCallback(() => setOpen(false), []);

  // Press N (outside inputs) to capture — desktop fast path
  useEffect(() => {
    if (open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "n" && e.key !== "N") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      )
        return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open ]);

  return (
    <CaptureContext.Provider value={{ open: openDialog }}>
      {children}
      <CaptureDialog open={open} onClose={closeDialog} />
    </CaptureContext.Provider>
  );
}

export function CaptureFab() {
  const { open } = useCapture();
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={open}
      aria-label="New drop"
      title="New drop (N)"
      className="fixed bottom-6 right-6 z-40 hidden h-14 w-14 place-items-center rounded-full bg-ink text-white shadow-xl shadow-black/25 transition-transform hover:scale-105 md:grid"
    >
      <Plus size={24} />
    </motion.button>
  );
}
