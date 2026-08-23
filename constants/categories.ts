import {
  Activity,
  Banknote,
  BookOpen,
  Circle,
  Clapperboard,
  Lightbulb,
  Plane,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

export interface CategoryDef {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string;
}

export const CATEGORY_CONFIG: Record<
  string,
  { icon: LucideIcon; color: string; accent: string }
> = {
  expense: { icon: Banknote, color: "#f87171", accent: "#22c55e" },
  reading: { icon: BookOpen, color: "#60a5fa", accent: "#f59e0b" },
  travel: { icon: Plane, color: "#34d399", accent: "#3b82f6" },
  idea: { icon: Lightbulb, color: "#fbbf24", accent: "#a855f7" },
  shopping: { icon: ShoppingBag, color: "#a78bfa", accent: "#ec4899" },
  health: { icon: Activity, color: "#f472b6", accent: "#ff7043" },
  media: { icon: Clapperboard, color: "#8b5cf6", accent: "#8b5cf6" },
  misc: { icon: Circle, color: "#94a3b8", accent: "#94a3b8" },
};

export const getCategoryConfig = (name: string = "") => {
  const normalized = name.toLowerCase();
  if (normalized.includes("expense")) return CATEGORY_CONFIG.expense;
  if (normalized.includes("read")) return CATEGORY_CONFIG.reading;
  if (normalized.includes("travel")) return CATEGORY_CONFIG.travel;
  if (normalized.includes("idea")) return CATEGORY_CONFIG.idea;
  if (normalized.includes("shop")) return CATEGORY_CONFIG.shopping;
  if (normalized.includes("health")) return CATEGORY_CONFIG.health;
  if (
    normalized.includes("media") ||
    normalized.includes("movie") ||
    normalized.includes("song")
  )
    return CATEGORY_CONFIG.media;
  return CATEGORY_CONFIG.misc;
};

export const DEFAULT_CATEGORIES: CategoryDef[] = [
  { id: "expense", name: "Expenses", icon: Banknote, color: "#f87171" },
  { id: "reading", name: "Reading", icon: BookOpen, color: "#60a5fa" },
  { id: "travel", name: "Travel", icon: Plane, color: "#34d399" },
  { id: "idea", name: "Ideas", icon: Lightbulb, color: "#fbbf24" },
  { id: "shopping", name: "Shopping", icon: ShoppingBag, color: "#a78bfa" },
  { id: "health", name: "Health", icon: Activity, color: "#f472b6" },
];
