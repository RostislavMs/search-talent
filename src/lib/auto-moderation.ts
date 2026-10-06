import type { Locale } from "@/lib/i18n/config";

/**
 * Auto-moderation runs in the database (moderation_screen() and the
 * *_moderation triggers, database/2026-10-06-moderation-in-db.sql): a project,
 * article or poll that goes out with blocklisted words, link spam or shouting
 * is removed and its author told; a company page or a vacancy (which is also
 * checked for "pay first" scams) waits for a moderator; a comment is refused.
 * The blocklist is the moderation_terms table.
 *
 * What is left here is the explanation the forms show: the result comes back
 * from the database as {flagged, categories, matches} and is turned into one
 * sentence. Pure, so it is safe on the client too.
 */

export const autoModerationCategories = [
  "profanity",
  "hate",
  "sexual",
  "spam",
  // Vacancies only: a fee taken from candidates, or the conversation moved
  // off the platform.
  "scam",
] as const;

export type AutoModerationCategory = (typeof autoModerationCategories)[number];

/**
 * Evidence for one triggered rule. Blocklist categories carry no example — the
 * offending word is never quoted back. For spam, `detail` says which check
 * fired and `count` is the number of links.
 */
export type AutoModerationMatch = {
  category: AutoModerationCategory;
  detail?: "links" | "shouting";
  count?: number;
};

export type AutoModerationResult = {
  flagged: boolean;
  categories: AutoModerationCategory[];
  matches: AutoModerationMatch[];
};

/**
 * Whether a moderation note is auto-moderation's: the database writes
 * "[авто] Виявлено: …" when it holds or removes content.
 */
export function isAutoModerationNote(note: string | null | undefined): boolean {
  return typeof note === "string" && note.startsWith("[авто]");
}

/** This many distinct links or more is link spam (as in moderation_screen()). */
export const AUTO_MODERATION_LINK_LIMIT = 12;

function isCategory(value: unknown): value is AutoModerationCategory {
  return autoModerationCategories.includes(value as AutoModerationCategory);
}

/**
 * The database's result, checked. Null for anything that is not one (a missing
 * row, an older payload), so callers fall back to a generic message.
 */
export function parseAutoModerationResult(value: unknown): AutoModerationResult | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as { flagged?: unknown; categories?: unknown; matches?: unknown };
  const categories = Array.isArray(raw.categories) ? raw.categories.filter(isCategory) : [];
  const matches = Array.isArray(raw.matches)
    ? raw.matches.flatMap((match): AutoModerationMatch[] => {
        if (!match || typeof match !== "object") return [];
        const entry = match as { category?: unknown; detail?: unknown; count?: unknown };
        if (!isCategory(entry.category)) return [];
        return [
          {
            category: entry.category,
            ...(entry.detail === "links" || entry.detail === "shouting" ? { detail: entry.detail } : {}),
            ...(typeof entry.count === "number" ? { count: entry.count } : {}),
          },
        ];
      })
    : [];

  if (categories.length === 0 && matches.length === 0) {
    return null;
  }

  return { flagged: raw.flagged !== false, categories, matches };
}

/**
 * A comment the database refused (the comment_moderation trigger raises
 * "moderation_blocked" with the result in DETAIL). Null for any other error.
 */
export function commentModerationResult(
  error: { message?: string | null; details?: string | null } | null,
): AutoModerationResult | null {
  if (error?.message !== "moderation_blocked") {
    return null;
  }

  let details: unknown = null;
  try {
    details = JSON.parse(error.details ?? "");
  } catch {
    // An unreadable detail still means the comment was refused.
  }

  return parseAutoModerationResult(details) ?? { flagged: true, categories: [], matches: [] };
}

const MODERATION_REASON_COPY = {
  uk: {
    intro: "Контент не пройшов автоматичну перевірку",
    fix: "Відредагуйте текст і спробуйте ще раз.",
    categories: {
      profanity: "нецензурна лексика",
      hate: "образливі вислови або мова ворожнечі",
      sexual: "відвертий сексуальний контент",
      spam: "ознаки спаму",
      scam: "схоже на вимогу заплатити кандидату чи перейти в месенджер",
    } satisfies Record<AutoModerationCategory, string>,
    links: (count: number) =>
      `забагато посилань: ${count} (максимум ${AUTO_MODERATION_LINK_LIMIT - 1} — приберіть зайві)`,
    shouting: "майже суцільний текст великими літерами",
  },
  en: {
    intro: "This content didn't pass the automatic check",
    fix: "Edit the text and try again.",
    categories: {
      profanity: "profanity",
      hate: "slurs or hate speech",
      sexual: "explicit sexual content",
      spam: "spam signals",
      scam: "it reads like asking candidates to pay or to move to a messenger",
    } satisfies Record<AutoModerationCategory, string>,
    links: (count: number) =>
      `too many links: ${count} (max ${AUTO_MODERATION_LINK_LIMIT - 1} — remove some)`,
    shouting: "mostly all-caps text",
  },
} as const;

/**
 * A localized, user-facing explanation of why auto-moderation stopped the
 * content: the triggered rules, with the link count where there is one. A
 * missing result gives the generic sentence.
 */
export function describeModerationResult(
  result: Pick<AutoModerationResult, "categories"> &
    Partial<Pick<AutoModerationResult, "matches">> | null,
  locale: Locale,
): string {
  const copy = locale === "uk" ? MODERATION_REASON_COPY.uk : MODERATION_REASON_COPY.en;
  const matches = result?.matches ?? [];
  const reasons: string[] = [];

  if (matches.length > 0) {
    for (const match of matches) {
      if (match.category === "spam") {
        reasons.push(
          match.detail === "links" && typeof match.count === "number"
            ? copy.links(match.count)
            : copy.shouting,
        );
        continue;
      }
      reasons.push(copy.categories[match.category]);
    }
  } else {
    for (const category of result?.categories ?? []) {
      reasons.push(copy.categories[category]);
    }
  }

  if (reasons.length === 0) {
    return `${copy.intro}. ${copy.fix}`;
  }

  return `${copy.intro}: ${reasons.join("; ")}. ${copy.fix}`;
}
