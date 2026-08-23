"use client";

import { format } from "date-fns";
import { X } from "lucide-react";
import { Drawer } from "vaul";
import { Entry } from "@/types";
import { getCategoryConfig } from "@/constants/categories";

interface EntrySheetProps {
  entry: Entry | null;
  open: boolean;
  onClose: () => void;
}

export default function EntrySheet({ entry, open, onClose }: EntrySheetProps) {
  if (!entry) return null;

  const categoryName = entry.category?.name || "Misc";
  const config = getCategoryConfig(categoryName);
  const Icon = config.icon;

  return (
    <Drawer.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[80vh] overflow-y-auto rounded-t-3xl bg-white px-6 pb-10 pt-1 outline-none">
          <Drawer.Title className="sr-only">Entry details</Drawer.Title>

          {/* Handle bar */}
          <div className="mx-auto mb-5 mt-3 h-1 w-10 rounded-full bg-[#e2e8f0]" />

          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className="grid h-9 w-9 place-items-center rounded-xl"
                style={{ backgroundColor: `${config.accent}20` }}
              >
                <Icon size={20} color={config.accent} />
              </span>
              <span className="text-lg font-bold" style={{ color: config.accent }}>
                {categoryName}
              </span>
            </div>
            <button onClick={onClose} className="p-1">
              <X size={24} className="text-[#94a3b8]" />
            </button>
          </div>

          {/* Raw text */}
          <p className="mb-6 text-xl font-medium leading-relaxed text-[#0f172a]">
            {entry.raw_text}
          </p>

          {/* Entities */}
          {entry.entities && entry.entities.length > 0 && (
            <section className="mb-6">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-[#94a3b8]">
                Entities
              </h3>
              <div className="flex flex-wrap gap-2">
                {entry.entities.map((e) => (
                  <span
                    key={e.id}
                    className="rounded-lg bg-[#f1f5f9] px-3 py-1.5 text-sm font-semibold text-[#475569]"
                  >
                    {e.name}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Transaction */}
          {entry.amount && (
            <section className="mb-6">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-[#94a3b8]">
                Transaction
              </h3>
              <p className="text-2xl font-bold text-green-500">
                {entry.currency === "INR" ? "₹" : entry.currency || ""}
                {entry.amount}
              </p>
            </section>
          )}

          {/* Logged at */}
          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-[#94a3b8]">
              Logged At
            </h3>
            <p className="font-medium text-[#64748b]">
              {format(new Date(entry.timestamp), "EEEE, d MMMM yyyy 'at' h:mm a")}
            </p>
          </section>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
