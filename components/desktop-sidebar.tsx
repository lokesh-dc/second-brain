"use client";

import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  House,
  LayoutGrid,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { useCapture } from "./capture";

const tabs = [
  { href: "/home", icon: House, label: "Home" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/insights", icon: Sparkles, label: "Insights" },
  { href: "/categories", icon: LayoutGrid, label: "Categories" },
];

export default function DesktopSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { open: openCapture } = useCapture();

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

      {/* New drop */}
      <div className="px-3 pb-5">
        <button
          onClick={openCapture}
          className="group flex h-11 w-full items-center gap-2.5 rounded-xl bg-ink px-3 text-white transition-transform hover:scale-[1.01] active:scale-[0.99]"
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/15 transition-colors group-hover:bg-white/25">
            <Plus size={16} />
          </span>
          <span className="text-sm font-semibold">New drop</span>
          <kbd className="ml-auto rounded-md bg-white/15 px-1.5 py-0.5 text-[11px] font-bold text-white/80">
            N
          </kbd>
        </button>
      </div>
    </aside>
  );
}
