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
