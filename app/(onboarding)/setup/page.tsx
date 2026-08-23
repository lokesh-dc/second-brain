"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Hash, X } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_CATEGORIES } from "@/constants/categories";
import { completeSetup } from "@/actions/profile";

const STAGGER = 0.15;

interface Chip {
  id: string;
  name: string;
}

export default function SetupPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    DEFAULT_CATEGORIES.map((c) => c.id),
  );
  const [customCategories, setCustomCategories] = useState<Chip[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [books, setBooks] = useState<string[]>([]);
  const [currentBook, setCurrentBook] = useState("");
  const [projects, setProjects] = useState<string[]>([]);
  const [currentProject, setCurrentProject] = useState("");

  const addCustomCategory = () => {
    const trimmed = newCategoryName.trim();
    if (
      trimmed &&
      !customCategories.some(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      setCustomCategories((prev) => [
        ...prev,
        { id: `custom-${Date.now()}`, name: trimmed },
      ]);
      setSelectedCategories((prev) => [...prev, `custom-${Date.now()}`]);
      setNewCategoryName("");
    }
  };

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // keep at least one
        return prev.filter((c) => c !== id);
      }
      return [...prev, id];
    });
  };

  const finish = async (skip = false) => {
    const result = await completeSetup({
      fullName,
      skip,
      selectedCategories,
      customCategories: customCategories.map((c) => c.name),
      books,
      projects,
    });

    if (!result.ok) {
      toast.error(result.error ?? "Setup failed");
      return;
    }
    router.push("/home");
  };

  const footer = (label: string, onClick: () => void) => (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: STAGGER * 2.5 }}
      className="px-6 pb-8 pt-4"
    >
      <button
        onClick={onClick}
        className="h-14 w-full rounded-full bg-ink font-medium text-white"
      >
        {label}
      </button>
      <button
        onClick={() => finish(true)}
        className="mt-3 w-full py-2 text-center text-[15px] text-[#888888]"
      >
        Skip Setup
      </button>
    </motion.div>
  );

  const stepMotion = (key: string, children: React.ReactNode) => (
    <AnimatePresence mode="wait">
      <motion.div
        key={key}
        initial={{ x: 60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -60, opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.215, 0.61, 0.355, 1] }}
        className="flex min-h-dvh flex-col justify-between"
      >
        <div className="flex-1 px-6 pt-10">{children}</div>
      </motion.div>
    </AnimatePresence>
  );

  return (
    <main className="min-h-dvh bg-paper">
      {/* STEP 1 — Name + categories */}
      {step === 1 &&
        stepMotion(
          "step1",
          <>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="font-display text-4xl leading-tight">
                What Should We
                <br />
                Call You?
              </h1>
              <p className="mb-10 mt-2 text-[13px] text-[#888888]">
                Step 1 of 3. Let&apos;s personalize your second brain.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: STAGGER }}
            >
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name..."
                className="mb-6 w-full rounded-xl border border-line bg-white px-4 py-3 text-base outline-none placeholder:text-[#94a3b8]"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: STAGGER * 1.5 }}
            >
              <p className="mb-4 text-[15px] font-medium">
                What Do You Mostly Want To Track?
              </p>
              <div className="flex flex-wrap justify-between gap-y-3">
                {[
                  ...DEFAULT_CATEGORIES,
                  ...customCategories.map((c) => ({
                    id: c.id,
                    name: c.name,
                    icon: Hash,
                    color: "#6366f1",
                  })),
                ].map((category) => {
                  const Icon = category.icon;
                  const isSelected = selectedCategories.includes(category.id);
                  return (
                    <button
                      key={category.id}
                      onClick={() => toggleCategory(category.id)}
                      className={`relative flex aspect-[0.9] w-[31%] flex-col items-center justify-center rounded-2xl border transition-colors ${
                        isSelected
                          ? "border-line bg-[#f8fafc]"
                          : "border-hairline bg-white"
                      }`}
                    >
                      {isSelected && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          className="absolute right-1.5 top-1.5 rounded-full bg-white"
                        >
                          <CheckCircle2 size={16} color={category.color} />
                        </motion.span>
                      )}
                      <span
                        className="mb-2 grid h-12 w-12 place-items-center rounded-xl"
                        style={{
                          backgroundColor: isSelected ? category.color : "#f1f5f9",
                        }}
                      >
                        <Icon size={24} color={isSelected ? "#fff" : category.color} />
                      </span>
                      <span
                        className={`text-center text-xs ${
                          isSelected ? "font-semibold text-[#0f172a]" : "text-[#64748b]"
                        }`}
                      >
                        {category.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && addCustomCategory()
                }
                placeholder="Add custom category..."
                className="mt-4 w-full rounded-xl border border-line bg-white px-4 py-3 text-base outline-none placeholder:text-[#94a3b8]"
              />
            </motion.div>

            {footer("Continue", () => setStep(2))}
          </>,
        )}

      {/* STEP 2 — Books */}
      {step === 2 &&
        stepMotion(
          "step2",
          <>
            <h1 className="font-display text-4xl leading-tight">
              What Are You Reading
              <br />
              Right Now?
            </h1>
            <p className="mb-10 mt-2 text-[13px] text-[#888888]">
              Step 2 of 3. We&apos;ll keep it handy for quick logging.
            </p>

            <input
              value={currentBook}
              onChange={(e) => setCurrentBook(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && currentBook.trim()) {
                  setBooks((prev) => [...prev, currentBook.trim()]);
                  setCurrentBook("");
                }
              }}
              placeholder="Book name..."
              className="mb-6 w-full rounded-xl border border-line bg-white px-4 py-3 text-base outline-none placeholder:text-[#94a3b8]"
            />

            <div className="flex flex-wrap gap-2">
              {books.map((book) => (
                <motion.span
                  key={book}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center rounded-full bg-[#f1f5f9] py-2 pl-3 pr-2 text-[13px] font-medium text-[#0f172a]"
                >
                  {book}
                  <button
                    onClick={() => setBooks((prev) => prev.filter((b) => b !== book))}
                    className="ml-1.5 p-0.5"
                    aria-label={`Remove ${book}`}
                  >
                    <X size={14} className="text-[#64748b]" />
                  </button>
                </motion.span>
              ))}
            </div>

            {footer("Continue", () => setStep(3))}
          </>,
        )}

      {/* STEP 3 — Projects */}
      {step === 3 &&
        stepMotion(
          "step3",
          <>
            <h1 className="font-display text-4xl leading-tight">
              Working On Any
              <br />
              Projects?
            </h1>
            <p className="mb-10 mt-2 text-[13px] text-[#888888]">
              Final step. Drop in active projects to route ideas instantly.
            </p>

            <input
              value={currentProject}
              onChange={(e) => setCurrentProject(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && currentProject.trim()) {
                  setProjects((prev) => [...prev, currentProject.trim()]);
                  setCurrentProject("");
                }
              }}
              placeholder="Project name..."
              className="mb-6 w-full rounded-xl border border-line bg-white px-4 py-3 text-base outline-none placeholder:text-[#94a3b8]"
            />

            <div className="flex flex-wrap gap-2">
              {projects.map((proj) => (
                <motion.span
                  key={proj}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center rounded-full bg-[#f1f5f9] py-2 pl-3 pr-2 text-[13px] font-medium text-[#0f172a]"
                >
                  {proj}
                  <button
                    onClick={() =>
                      setProjects((prev) => prev.filter((p) => p !== proj))
                    }
                    className="ml-1.5 p-0.5"
                    aria-label={`Remove ${proj}`}
                  >
                    <X size={14} className="text-[#64748b]" />
                  </button>
                </motion.span>
              ))}
            </div>

            {footer("Finish Setup", () => finish(false))}
          </>,
        )}
    </main>
  );
}
