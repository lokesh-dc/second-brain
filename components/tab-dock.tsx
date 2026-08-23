"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  House,
  LayoutGrid,
  Plus,
  Search,
  Send,
  Sparkle,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import EntityChip from "./entity-chip";
import { logEntry } from "@/actions/entries";

const tabs = [
  { href: "/home", icon: House },
  { href: "/search", icon: Search },
  { href: "/insights", icon: Sparkles },
  { href: "/categories", icon: LayoutGrid },
];

export default function TabDock() {
  const pathname = usePathname();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [isInputActive, setIsInputActive] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isPending, startTransition] = useTransition();

  // Reset capture state whenever the route changes (render-time sync,
  // avoids cascading renders from an effect)
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setIsInputActive(false);
    setInputText("");
  }

  // Hide the dock on the Search screen (it has its own input bar)
  if (pathname.startsWith("/search")) return null;

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
    <div
      className="fixed inset-x-4 z-50"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
    >
      {/* Entity chip */}
      <AnimatePresence>
        {showEntityChip && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute -top-12 left-0"
          >
            <EntityChip label="Food" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Droplet close button */}
      <AnimatePresence>
        {isInputActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: -68 }}
            exit={{ opacity: 0, scale: 0.6, y: 16 }}
            transition={{ type: "spring", damping: 18, stiffness: 150 }}
            className="absolute bottom-4 right-1.5 z-[-1] grid h-10 w-10 place-items-center rounded-full bg-white shadow-md shadow-black/10"
          >
            <button onClick={closeInput} aria-label="Close input">
              <X size={20} className="text-[#1a1a1a]" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center">
        <div className="relative min-w-0 flex-1">
          <AnimatePresence mode="popLayout" initial={false}>
            {!isInputActive ? (
              /* Tabs pill */
              <motion.nav
                key="pill"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, ease: [0.215, 0.61, 0.355, 1] }}
                className="relative flex h-[52px] items-center rounded-full border border-black/20 border-b-black/5 bg-white px-1.5"
              >
                {tabs.map((tab) => {
                  const active = pathname === tab.href;
                  return (
                    <button
                      key={tab.href}
                      onClick={() => router.push(tab.href)}
                      className="relative flex h-10 flex-1 items-center justify-center"
                      aria-label={tab.href}
                    >
                      {active && (
                        <motion.span
                          layoutId="dock-indicator"
                          transition={{
                            type: "spring",
                            damping: 20,
                            stiffness: 180,
                          }}
                          className="absolute inset-0 rounded-full bg-black"
                        />
                      )}
                      <tab.icon
                        size={20}
                        strokeWidth={active ? 2.5 : 2}
                        className={`relative z-10 ${
                          active ? "text-white" : "text-black"
                        }`}
                      />
                    </button>
                  );
                })}
              </motion.nav>
            ) : (
              /* Morphing input bar */
              <motion.form
                key="input"
                initial={{ x: 480, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 480, opacity: 0 }}
                transition={{ duration: 0.38, ease: [0.215, 0.61, 0.355, 1] }}
                onSubmit={(e) => {
                  e.preventDefault();
                  toggleInput();
                }}
                className="absolute inset-0 flex h-[52px] items-center rounded-full bg-white px-2 shadow-md shadow-black/5"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center">
                  <Sparkle size={20} className="text-brand" />
                </span>
                <input
                  ref={inputRef}
                  autoFocus
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="drop a thought..."
                  className="h-full min-w-0 flex-1 bg-transparent pr-3 font-sans text-base outline-none placeholder:text-[#94a3b8]"
                />
              </motion.form>
            )}
          </AnimatePresence>

          {/* Keeps layout height when the input form is absolutely positioned */}
          {isInputActive && <div className="h-[52px]" />}
        </div>

        {/* Accent action button */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={toggleInput}
          disabled={isPending}
          aria-label={isInputActive ? "Send" : "New entry"}
          className="ml-3 grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-black text-white shadow-xl shadow-black/30"
        >
          {isInputActive ? (
            <Send size={22} />
          ) : (
            <Plus size={26} />
          )}
        </motion.button>
      </div>
    </div>
  );
}
