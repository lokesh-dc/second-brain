"use client";

import { X } from "lucide-react";
import { Drawer } from "vaul";
import { DEFAULT_CATEGORIES } from "@/constants/categories";

interface CategoryPickerProps {
  visible: boolean;
  onClose: () => void;
}

export default function CategoryPicker({
  visible,
  onClose,
}: CategoryPickerProps) {
  return (
    <Drawer.Root open={visible} onOpenChange={(o) => !o && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[70vh] rounded-t-3xl bg-white p-6 pb-10 outline-none">
          <Drawer.Title className="sr-only">Select category</Drawer.Title>

          <div className="mx-auto mb-5 mt-2 h-1 w-10 rounded-full bg-[#e2e8f0]" />

          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#0f172a]">
              Select Category
            </h2>
            <button onClick={onClose} className="p-1">
              <X size={20} className="text-[#64748b]" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-x-3 gap-y-4">
            {DEFAULT_CATEGORIES.map((category) => {
              const Icon = category.icon;
              return (
                <button
                  key={category.id}
                  onClick={onClose}
                  className="flex aspect-[0.9] flex-col items-center justify-center rounded-2xl border border-[#f1f5f9]"
                >
                  <span
                    className="mb-2 grid h-12 w-12 place-items-center rounded-xl bg-[#f1f5f9]"
                  >
                    <Icon size={24} color={category.color} />
                  </span>
                  <span className="text-xs font-medium text-[#64748b]">
                    {category.name}
                  </span>
                </button>
              );
            })}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
