"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  House,
  LayoutGrid,
  Search,
  Send,
  Sparkle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import EntityChip from "./entity-chip";
import { logEntry } from "@/actions/entries";

const tabs = [
  { href: "/home", icon: House, label: "Home" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/insights", icon: Sparkles, label: "Insights" },
  { href: "/categories", icon: LayoutGrid, label: "Categories" },
];

export default function DesktopSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [isInputActive, setIsInputActive] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isPending, startTransition] = useTransition();

  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setIsInputActive(false);
    setInputText("");
  }

  const toggleInput = () => {
    if (isInputActive && inputText.trim()) {
      const text = inputText;
      setInputText("");
      setIsInputActive(false);
      startTransition(async () => {
        try {
          await logEntry(text);
          toast.success("Logged to your mind");
          router.refresh();
        } catch {
          toast.error("Couldn't log that. Try again.");
        }
      });
    } else if (!isInputActive) {
      setIsInputActive(true);
    }
  };

  const closeInput = () => {
    setIsInputActive(false);
    setInputText("");
  };

  const showEntityChip =
    isInputActive && inputText.toLowerCase().includes("spent");

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-w)] flex-col border-r border-line bg-white md:flex">
      {/* Logo */}
      <div className="px-5 pb-6 pt-6">
        <span className="font-display text-xl italic">mindrop</span>
      </div>

      {/* Nav links */}
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <button
              key={tab.href}
              onClick={() => router.push(tab.href)}
              className="relative flex h-10 items-center gap-3 rounded-xl px-3 text-left transition-colors"
            >
              {active && (
                <motion.span
                  layoutId="sidebar-indicator"
                  transition={{
                    type: "spring",
                    damping: 20,
                    stiffness: 180,
                  }}
                  className="absolute inset-0 rounded-xl bg-black"
                />
              )}
              <tab.icon
                size={20}
                strokeWidth={active ? 2.5 : 2}
                className={`relative z-10 ${
                  active ? "text-white" : "text-ink-3"
                }`}
              />
              <span
                className={`relative z-10 text-sm font-medium ${
                  active ? "text-white" : "text-ink-2"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Quick entry input */}
      <div className="relative px-3 pb-5">
        {/* Entity chip */}
        <AnimatePresence>
          {showEntityChip && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute -top-11 left-3"
            >
              <EntityChip label="Food" />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="popLayout" initial={false}>
          {!isInputActive ? (
            /* Inactive: simple input bar */
            <motion.div
              key="inactive"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25, ease: [0.215, 0.61, 0.355, 1] }}
              className="flex h-11 items-center rounded-xl border border-line bg-paper px-3"
            >
              <button
                onClick={toggleInput}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black text-white"
                aria-label="New entry"
              >
                <span className="text-lg leading-none">+</span>
              </button>
              <span
                onClick={toggleInput}
                className="ml-2 cursor-pointer text-sm text-ink-3"
              >
                drop a thought...
              </span>
            </motion.div>
          ) : (
            /* Active: morphing input */
            <motion.form
              key="active"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.25, ease: [0.215, 0.61, 0.355, 1] }}
              onSubmit={(e) => {
                e.preventDefault();
                toggleInput();
              }}
              className="flex h-11 items-center rounded-xl border border-brand/30 bg-white px-2 shadow-sm shadow-brand/5"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center">
                <Sparkle size={16} className="text-brand" />
              </span>
              <input
                ref={inputRef}
                autoFocus
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="drop a thought..."
                className="h-full min-w-0 flex-1 bg-transparent pr-2 text-sm outline-none placeholder:text-ink-3"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isPending}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-black text-white disabled:opacity-50"
                aria-label="Send"
              >
                <Send size={14} />
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Close button when input is active */}
        <AnimatePresence>
          {isInputActive && (
            <motion.button
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: "spring", damping: 18, stiffness: 150 }}
              onClick={closeInput}
              className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-white text-ink-3 shadow-md shadow-black/10 hover:text-ink"
              aria-label="Close input"
            >
              <span className="text-xs leading-none">&times;</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}
