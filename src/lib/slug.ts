// Shared Cyrillic → Latin transliteration + slugify used by articles, polls,
// projects and marketing facet segments so every surface produces the same
// readable Latin slug from Ukrainian/Russian input. Ukrainian-first
// (BGN/PCGN-ish: я→ya, ю→yu, є→ye, ї→yi, й→y) so Ukrainian titles produce a
// readable Latin slug instead of collapsing to the fallback. A few Russian-only
// letters are included so mixed input still transliterates.
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ye",
  ж: "zh", з: "z", и: "y", і: "i", ї: "yi", й: "y", к: "k", л: "l",
  м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ь: "",
  ю: "yu", я: "ya", ё: "e", ъ: "", ы: "y", э: "e",
};

export function transliterateCyrillic(value: string): string {
  let out = "";
  for (const char of value) {
    out += CYRILLIC_TO_LATIN[char] ?? char;
  }
  return out;
}

/**
 * Turn arbitrary text (Latin or Cyrillic) into a URL-safe slug. Transliterates
 * Cyrillic first, then keeps only `[a-z0-9-]`, collapsing whitespace/dashes.
 * Returns `fallback` when nothing usable remains (e.g. emoji-only titles).
 */
export function slugify(value: string, fallback: string): string {
  return (
    transliterateCyrillic(value.trim().toLowerCase())
      .normalize("NFKD")
      .replace(/[^a-z0-9\s-]+/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || fallback
  );
}
