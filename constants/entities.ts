import {
  BookOpen,
  Clapperboard,
  Hash,
  MapPin,
  Music,
  ShoppingBag,
  Tag,
  User,
  type LucideIcon,
} from "lucide-react";

/**
 * Single display rule for entity names project-wide. The AI sometimes
 * returns lowercase ("jibhi") — capitalize all-lowercase words, but leave
 * user-cased names like "iPhone" or "McDonald's" exactly as they are.
 */
export function formatEntityName(name: string = ""): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (!word || word !== word.toLowerCase()) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/** Icon per entity type, shared by the index tiles and detail header. */
export function entityIconFor(type: string): LucideIcon {
  const t = (type || "").toLowerCase();
  if (t.includes("place")) return MapPin;
  if (t.includes("person")) return User;
  if (t.includes("book") || t.includes("course")) return BookOpen;
  if (t.includes("movie") || t.includes("tv") || t.includes("show"))
    return Clapperboard;
  if (t.includes("song") || t.includes("music") || t.includes("game"))
    return Music;
  if (t.includes("brand") || t.includes("product") || t.includes("app"))
    return ShoppingBag;
  if (t.includes("project") || t.includes("event")) return Hash;
  return Tag;
}
