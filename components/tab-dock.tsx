"use client";

import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
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
  { href: "/home", icon: House },
  { href: "/search", icon: Search },
  { href: "/insights", icon: Sparkles },
  { href: "/categories", icon: LayoutGrid },
];

export default function TabDock() {
  const pathname = usePathname();
  const router = useRouter();
  const { open: openCapture } = useCapture();

  // Hide the dock on the Search screen (it has its own input bar)
  if (pathname.startsWith("/search")) return null;

  return (
    <div
      className="fixed inset-x-4 z-50 md:hidden"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
    >
      <div className="flex items-center">
        <nav className="relative flex h-[52px] min-w-0 flex-1 items-center rounded-full border border-black/20 border-b-black/5 bg-white px-1.5">
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
        </nav>

        {/* Sticky capture action — opens the drop dialog */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={openCapture}
          aria-label="New drop"
          className="ml-3 grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-black text-white shadow-xl shadow-black/30"
        >
          <Plus size={26} />
        </motion.button>
      </div>
    </div>
  );
}
