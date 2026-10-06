"use client";

import { useRef, useState } from "react";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  Loader2,
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import { Drawer } from "vaul";
import { Entry, EntryEditData } from "@/types";
import { getCategoryConfig, ALL_CATEGORY_NAMES } from "@/constants/categories";
import { useIsDesktop } from "@/hooks/use-media-query";

interface EntrySheetProps {
  entry: Entry | null;
  open: boolean;
  onClose: () => void;
  onDelete?: (id: string) => void | Promise<void>;
  onEdit?: (id: string, data: EntryEditData) => void | Promise<void>;
  categories?: { id: string; name: string }[];
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-ink-3">
      {children}
    </label>
  );
}

function EntryMenu({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          setConfirmDelete(false);
        }}
        className="rounded-full p-1.5 text-ink-3 transition-colors hover:bg-paper focus-visible:outline-2 focus-visible:outline-brand"
        aria-label="Entry options"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical size={22} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 top-11 z-50 w-44 overflow-hidden rounded-xl border border-line bg-white py-1.5 shadow-xl"
          >
            {confirmDelete ? (
              <>
                <button
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    setConfirmDelete(false);
                    onDelete();
                  }}
                  className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-danger transition-colors hover:bg-danger/5"
                >
                  Confirm delete
                </button>
                <button
                  role="menuitem"
                  onClick={() => setConfirmDelete(false)}
                  className="block w-full px-4 py-2.5 text-left text-sm font-medium text-ink-2 transition-colors hover:bg-paper"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    onEdit();
                  }}
                  className="block w-full px-4 py-2.5 text-left text-sm font-medium text-ink transition-colors hover:bg-paper"
                >
                  Edit
                </button>
                <button
                  role="menuitem"
                  onClick={() => setConfirmDelete(true)}
                  className="block w-full px-4 py-2.5 text-left text-sm font-medium text-danger transition-colors hover:bg-danger/5"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function CategoryDropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { id: string; name: string }[];
  onChange: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [align, setAlign] = useState<"below" | "above">("below");
  const triggerRef = useRef<HTMLDivElement>(null);
  const config = getCategoryConfig(value);
  const Icon = config.icon;

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const el = triggerRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const menuHeight = Math.min(options.length * 42 + 12, 240);
      const spaceBelow = window.innerHeight - rect.bottom;
      setAlign(spaceBelow - 8 < menuHeight ? "above" : "below");
    }
    setOpen(true);
  };

  return (
    <div ref={triggerRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-paper px-3 py-2.5 text-left outline-none focus-visible:outline-2 focus-visible:outline-brand"
      >
        <span className="flex items-center gap-2.5">
          <span
            className="grid h-6 w-6 place-items-center rounded-lg"
            style={{ backgroundColor: `${config.accent}1A` }}
          >
            <Icon size={13} color={config.accent} />
          </span>
          <span className="text-sm font-semibold text-ink">{value}</span>
        </span>
        <ChevronDown
          size={18}
          className={`text-ink-3 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="listbox"
            className={`absolute left-0 right-0 z-50 max-h-60 overflow-y-auto rounded-xl border border-line bg-white py-1.5 shadow-xl ${
              align === "above"
                ? "bottom-[calc(100%+4px)]"
                : "top-[calc(100%+4px)]"
            }`}
          >
            {options.map((opt) => {
              const c = getCategoryConfig(opt.name);
              const ItemIcon = c.icon;
              const selected = opt.name === value;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(opt.name);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-paper"
                >
                  <span
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-lg"
                    style={{ backgroundColor: `${c.accent}1A` }}
                  >
                    <ItemIcon size={13} color={c.accent} />
                  </span>
                  <span
                    className={
                      selected
                        ? "text-sm font-semibold text-ink"
                        : "text-sm font-medium text-ink-2"
                    }
                  >
                    {opt.name}
                  </span>
                  {selected && (
                    <Check size={16} className="ml-auto text-brand" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function EntryContent({
  entry,
  onDelete,
  onEdit,
  categories,
}: {
  entry: Entry;
  onDelete: (id: string) => void;
  onEdit: (id: string, data: EntryEditData) => void | Promise<void>;
  categories: { id: string; name: string }[];
}) {
  const categoryName = entry.category?.name || "Misc";
  const config = getCategoryConfig(categoryName);
  const Icon = config.icon;

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [editText, setEditText] = useState(entry.raw_text);
  const [editCategory, setEditCategory] = useState(categoryName);

  const startEdit = () => {
    setEditText(entry.raw_text);
    setEditCategory(categoryName);
    setEditing(true);
  };

  const categoryOptions = (() => {
    const seen = new Set<string>();
    const options: { id: string; name: string }[] = [];
    for (const name of [...ALL_CATEGORY_NAMES, ...categories.map((c) => c.name)]) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      options.push({ id: key, name });
    }
    return options;
  })();

  const saveEdit = async () => {
    if (!editText.trim() || saving) return;
    const data: EntryEditData = {
      raw_text: editText.trim(),
      category: editCategory.trim() || "Misc",
      summary: "",
      amount: null,
      currency: null,
      tags: [],
      entities: [],
    };
    setSaving(true);
    try {
      await onEdit(entry.id, data);
      setEditing(false);
    } catch {
      toast.error("Failed to save entry");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(entry.id);
    setDeleting(false);
  };

  return (
    <>
      {/* Header: category + menu in one row */}
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
        {deleting ? (
          <Loader2 size={22} className="animate-spin text-ink-3" />
        ) : (
          <EntryMenu onEdit={startEdit} onDelete={handleDelete} />
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-4 pb-2">
          <div>
            <FieldLabel>Text</FieldLabel>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={5}
              autoFocus
              className="w-full resize-none rounded-xl border border-line bg-paper p-3 text-base leading-relaxed text-ink outline-none placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-brand"
            />
          </div>

          <div>
            <FieldLabel>Classification</FieldLabel>
            <CategoryDropdown
              value={editCategory}
              options={categoryOptions}
              onChange={setEditCategory}
            />
            <p className="mt-1.5 text-xs text-ink-3">
              Entities, tags and the rest will be re-generated by AI on save.
            </p>
          </div>

          <div className="mt-1 flex gap-2">
            <button
              onClick={() => setEditing(false)}
              disabled={saving}
              className="flex-1 rounded-xl border border-line bg-white py-2.5 text-sm font-semibold text-ink-2 transition-colors hover:bg-paper disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              onClick={saveEdit}
              disabled={saving || !editText.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand/90 disabled:opacity-60"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Raw text */}
          <p className="mb-6 text-xl font-medium leading-relaxed text-pretty text-ink">
            {entry.raw_text}
          </p>

          {/* Entities */}
          {entry.entities && entry.entities.length > 0 && (
            <section className="mb-6">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-3">
                Entities
              </h3>
              <div className="flex flex-wrap gap-2">
                {entry.entities.map((e) => (
                  <span
                    key={e.id}
                    className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm font-semibold text-ink-2"
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
              <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-3">
                Transaction
              </h3>
              <p className="text-2xl font-bold tabular-nums text-success">
                {entry.currency === "INR" ? "₹" : entry.currency || ""}
                {entry.amount}
              </p>
            </section>
          )}

          {/* Logged at */}
          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-3">
              Logged At
            </h3>
            <p className="font-medium tabular-nums text-ink-2">
              {format(
                new Date(entry.timestamp),
                "EEEE, d MMMM yyyy 'at' h:mm a",
              )}
            </p>
          </section>
        </>
      )}
    </>
  );
}

function DesktopSlideOver({
  entry,
  open,
  onClose,
  onDelete,
  onEdit,
  categories,
}: EntrySheetProps & { entry: Entry }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink/30"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-[420px] overflow-y-auto bg-white p-6 shadow-2xl"
          >
            <EntryContent
              entry={entry}
              onDelete={(id) =>
                onDelete
                  ? onDelete(id)
                  : toast.error("Deleting isn't available here yet")
              }
              onEdit={
                onEdit ??
                (async () => {
                  toast.error("Editing isn't available here yet");
                })
              }
              categories={categories ?? []}
            />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export default function EntrySheet({
  entry,
  open,
  onClose,
  onDelete,
  onEdit,
  categories,
}: EntrySheetProps) {
  const isDesktop = useIsDesktop();

  if (!entry) return null;

  if (isDesktop) {
    return (
      <DesktopSlideOver
        key={entry.id}
        entry={entry}
        open={open}
        onClose={onClose}
        onDelete={onDelete}
        onEdit={onEdit}
        categories={categories}
      />
    );
  }

  return (
    <Drawer.Root
      key={entry.id}
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/30" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[80vh] overflow-y-auto rounded-t-3xl bg-white px-6 pb-6 pt-1 outline-none">
          <Drawer.Title className="sr-only">Entry details</Drawer.Title>

          {/* Handle bar */}
          <div className="mx-auto mb-5 mt-3 h-1 w-10 rounded-full bg-line" />

          <EntryContent
            entry={entry}
            onDelete={(id) =>
              onDelete
                ? onDelete(id)
                : toast.error("Deleting isn't available here yet")
            }
            onEdit={
              onEdit ??
              (async () => {
                toast.error("Editing isn't available here yet");
              })
            }
            categories={categories ?? []}
          />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}