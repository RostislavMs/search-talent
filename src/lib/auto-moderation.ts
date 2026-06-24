import { extractPlainTextFromRichText } from "@/lib/rich-text-plain";
import type { Locale } from "@/lib/i18n/config";
import type { ProjectPayload } from "@/lib/validation/project";
import type { PollPayload } from "@/lib/validation/polls";

/**
 * Basic, rule-based content moderation that runs at publish time (and inline on
 * comments).
 *
 * It scans the user-supplied text of a project / article / poll / comment
 * against a curated blocklist (profanity, hate speech / slurs, explicit sexual
 * content) plus a couple of conservative spam heuristics. For posts a match
 * does not block the save — the calling route sends the content to
 * `under_review` instead; for comments (no review pipeline) the route rejects
 * the submission.
 *
 * To resist common evasion the matcher normalizes text before matching:
 *   - Unicode confusables (Cyrillic letters that look like Latin ones, e.g.
 *     "хуй" written with a Latin "x") are folded to a single canonical form;
 *   - leet / symbol substitutions ("sh1t", "a$$") are undone;
 *   - the text is also matched in a "de-obfuscated" form that joins letters
 *     spread out with separators ("f u c k", "f.u.c.k").
 * It still errs towards FEW false positives — matches are bounded by
 * non-letters (so "assistant" never trips "ass"), the blocklist favours stems
 * that no benign word shares, and the spam thresholds are generous. A richer
 * AI pass / DB-managed list can layer on later.
 *
 * The module is pure (no server-only imports) so it stays unit-testable.
 */

export const autoModerationCategories = [
  "profanity",
  "hate",
  "sexual",
  "spam",
] as const;

export type AutoModerationCategory = (typeof autoModerationCategories)[number];

/**
 * Evidence for a single triggered rule, used to explain the decision to the
 * author. Blocklist categories (profanity / hate / sexual) carry no example —
 * we deliberately do not quote the offending word back. For spam, `detail` says
 * which heuristic fired and `count` carries the measure (number of links).
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
  note: string | null;
};

/** The shared "nothing to screen / clean" result (e.g. drafts, missing key). */
export const CLEAN_MODERATION_RESULT: AutoModerationResult = {
  flagged: false,
  categories: [],
  matches: [],
  note: null,
};

/**
 * This many *distinct* links or more reads as link spam.
 *
 * Counting is by distinct URL, not by occurrence: the screened text concatenates
 * every language version of a post, so a bilingual article that pastes the same
 * references in both its EN and UK body would otherwise count each link twice and
 * trip the limit at half the real number. Deduping by URL keeps the budget per
 * article rather than per language, so the ceiling can be generous enough for a
 * genuinely reference-heavy write-up without flagging honest bilingual posts.
 */
export const AUTO_MODERATION_LINK_LIMIT = 12;
/** Shouting check only kicks in past this many letters (skip short titles). */
const SHOUTING_MIN_LETTERS = 80;
const SHOUTING_RATIO = 0.7;

/** Shown to users whose comment is rejected by auto-moderation. */
export const AUTO_MODERATION_BLOCKED_MESSAGE =
  "Коментар не пройшов автоматичну перевірку: приберіть нецензурну лексику, образи чи спам.";

type BlocklistEntry = {
  category: Exclude<AutoModerationCategory, "spam">;
  /** Lowercase base form. */
  term: string;
  /**
   * "word" matches the exact token (both sides bounded by a non-letter).
   * "stem" also matches inflected forms (any trailing letters), so only use it
   * for stems that are not a prefix of an innocent word.
   */
  type: "word" | "stem";
};

// Starter blocklist. Conservative but covers the common cases in EN, UK/RU
// (Cyrillic) and Latin transliteration. Stems are used only where no common
// benign word shares the prefix. Extend freely — this is the easy knob.
const BLOCKLIST: BlocklistEntry[] = [
  // --- English profanity ---
  { category: "profanity", term: "fuck", type: "stem" },
  { category: "profanity", term: "shit", type: "stem" },
  { category: "profanity", term: "bullshit", type: "stem" },
  { category: "profanity", term: "bitch", type: "stem" },
  { category: "profanity", term: "asshole", type: "stem" },
  { category: "profanity", term: "arsehole", type: "stem" },
  { category: "profanity", term: "jackass", type: "word" },
  { category: "profanity", term: "dickhead", type: "stem" },
  { category: "profanity", term: "dick", type: "word" },
  { category: "profanity", term: "prick", type: "word" },
  { category: "profanity", term: "cock", type: "word" },
  { category: "profanity", term: "cunt", type: "stem" },
  { category: "profanity", term: "twat", type: "word" },
  { category: "profanity", term: "wank", type: "stem" },
  { category: "profanity", term: "bastard", type: "stem" },
  { category: "profanity", term: "bollocks", type: "word" },
  { category: "profanity", term: "slut", type: "stem" },
  { category: "profanity", term: "whore", type: "stem" },
  // --- English hate speech / slurs ---
  { category: "hate", term: "nigger", type: "stem" },
  { category: "hate", term: "nigga", type: "word" },
  { category: "hate", term: "faggot", type: "stem" },
  { category: "hate", term: "retard", type: "stem" },
  { category: "hate", term: "kike", type: "word" },
  { category: "hate", term: "tranny", type: "stem" },
  { category: "hate", term: "spic", type: "word" },
  { category: "hate", term: "wetback", type: "word" },
  // --- English explicit sexual ---
  { category: "sexual", term: "porn", type: "stem" },
  { category: "sexual", term: "blowjob", type: "stem" },
  { category: "sexual", term: "handjob", type: "stem" },
  { category: "sexual", term: "cumshot", type: "stem" },
  { category: "sexual", term: "creampie", type: "stem" },
  { category: "sexual", term: "dildo", type: "stem" },
  { category: "sexual", term: "cum", type: "word" },
  { category: "sexual", term: "pussy", type: "word" },
  { category: "sexual", term: "boobs", type: "word" },
  { category: "sexual", term: "tits", type: "word" },
  { category: "sexual", term: "titties", type: "word" },
  // --- Ukrainian / russian profanity (Cyrillic) ---
  { category: "profanity", term: "хуй", type: "stem" },
  { category: "profanity", term: "хуя", type: "word" },
  { category: "profanity", term: "хую", type: "word" },
  { category: "profanity", term: "хуєв", type: "stem" },
  { category: "profanity", term: "нахуй", type: "stem" },
  { category: "profanity", term: "похуй", type: "stem" },
  { category: "profanity", term: "пизд", type: "stem" },
  { category: "profanity", term: "пізд", type: "stem" },
  { category: "profanity", term: "бляд", type: "stem" },
  { category: "profanity", term: "блять", type: "word" },
  { category: "profanity", term: "єбан", type: "stem" },
  { category: "profanity", term: "їбан", type: "stem" },
  { category: "profanity", term: "єбал", type: "stem" },
  { category: "profanity", term: "заєб", type: "stem" },
  { category: "profanity", term: "наєб", type: "stem" },
  { category: "profanity", term: "уєб", type: "stem" },
  { category: "profanity", term: "доєб", type: "stem" },
  { category: "profanity", term: "виєб", type: "stem" },
  { category: "profanity", term: "ебан", type: "stem" },
  { category: "profanity", term: "ебал", type: "stem" },
  { category: "profanity", term: "ебат", type: "stem" },
  { category: "profanity", term: "наеб", type: "stem" },
  { category: "profanity", term: "заеб", type: "stem" },
  { category: "profanity", term: "уеб", type: "stem" },
  { category: "profanity", term: "ёб", type: "stem" },
  { category: "profanity", term: "йоб", type: "stem" },
  { category: "profanity", term: "довбойоб", type: "stem" },
  { category: "profanity", term: "мудак", type: "stem" },
  { category: "profanity", term: "мудил", type: "stem" },
  { category: "profanity", term: "гандон", type: "stem" },
  { category: "profanity", term: "гондон", type: "stem" },
  { category: "profanity", term: "залуп", type: "stem" },
  { category: "profanity", term: "сука", type: "word" },
  { category: "profanity", term: "сучка", type: "word" },
  { category: "profanity", term: "курв", type: "stem" },
  { category: "profanity", term: "гімно", type: "word" },
  { category: "profanity", term: "гівно", type: "word" },
  { category: "profanity", term: "гімнюк", type: "stem" },
  { category: "profanity", term: "дерьмо", type: "word" },
  { category: "profanity", term: "падл", type: "stem" },
  { category: "profanity", term: "мраз", type: "stem" },
  { category: "profanity", term: "дроч", type: "stem" },
  { category: "profanity", term: "ублюд", type: "stem" },
  // --- Ukrainian / russian hate / slurs (Cyrillic) ---
  { category: "hate", term: "жид", type: "stem" },
  { category: "hate", term: "підар", type: "stem" },
  { category: "hate", term: "підор", type: "stem" },
  { category: "hate", term: "пидор", type: "stem" },
  { category: "hate", term: "педик", type: "word" },
  // --- Explicit sexual (Cyrillic) ---
  { category: "sexual", term: "порно", type: "stem" },
  // --- Latin transliteration of common mat ---
  { category: "profanity", term: "suka", type: "word" },
  { category: "profanity", term: "pizd", type: "stem" },
  { category: "profanity", term: "huy", type: "word" },
  { category: "profanity", term: "huilo", type: "word" },
  { category: "profanity", term: "huylo", type: "word" },
  { category: "profanity", term: "blyad", type: "word" },
  { category: "profanity", term: "blyat", type: "word" },
  { category: "profanity", term: "bliad", type: "word" },
  { category: "profanity", term: "nahuy", type: "word" },
  { category: "profanity", term: "yobani", type: "stem" },
  { category: "profanity", term: "zaeb", type: "stem" },
  { category: "profanity", term: "eban", type: "stem" },
  { category: "hate", term: "pidor", type: "stem" },
];

// Unicode confusables: Cyrillic letters that are visually identical (or nearly
// so) to a Latin letter, folded to the Latin form. Applied to BOTH the input
// text and the blocklist terms, so "хуй" and a Latin-"x" spoof normalize to the
// same string. Only near-identical glyphs are mapped, to keep collisions rare.
const CONFUSABLES: Record<string, string> = {
  а: "a",
  в: "b",
  е: "e",
  ё: "e",
  к: "k",
  м: "m",
  н: "h",
  о: "o",
  р: "p",
  с: "c",
  т: "t",
  у: "y",
  х: "x",
  і: "i",
  ї: "i",
  ј: "j",
  ѕ: "s",
  һ: "h",
};

const CONFUSABLES_PATTERN = new RegExp(
  `[${Object.keys(CONFUSABLES).join("")}]`,
  "gu",
);

// Common leet / symbol substitutions, applied before matching so trivially
// obfuscated tokens still resolve to their base letters.
const LEET_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "6": "b",
  "7": "t",
  "8": "b",
  "9": "g",
  "@": "a",
  "$": "s",
  "!": "i",
  "|": "i",
  "+": "t",
};

const LEET_PATTERN = new RegExp(
  `[${Object.keys(LEET_MAP)
    .map((char) => char.replace(/[-\]\\^]/g, "\\$&"))
    .join("")}]`,
  "g",
);

/**
 * Lowercase, fold compatibility forms, drop zero-width / combining marks, fold
 * Cyrillic→Latin confusables and apply leet substitutions. Separators are kept
 * so word boundaries stay meaningful (see collapseObfuscation for the spaced
 * variant).
 *
 * `\p{M}` drops combining marks; `\p{Cf}` drops format chars (zero-width
 * space/joiner, BOM) — both written as property escapes to keep the source
 * free of literal invisible characters.
 */
export function normalizeForMatch(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{M}\p{Cf}]/gu, "")
    .replace(CONFUSABLES_PATTERN, (char) => CONFUSABLES[char] ?? char)
    .replace(LEET_PATTERN, (char) => LEET_MAP[char] ?? char);
}

/**
 * Collapse obfuscation that spreads a word out with separators:
 *   - "f.u.c.k" / "f-u-c-k"  → intra-token separators stripped → "fuck";
 *   - "f u c k"              → a run of single-letter tokens is joined.
 * Multi-letter tokens are never merged across whitespace, so "this hit" never
 * becomes "thishit". Operates on already-normalized text.
 */
export function collapseObfuscation(normalized: string): string {
  const tokens = normalized.split(/\s+/);
  const out: string[] = [];
  let run = "";

  for (const token of tokens) {
    const letters = token.replace(/[^\p{L}]/gu, "");
    if (letters.length === 0) {
      continue;
    }
    if (letters.length === 1) {
      run += letters;
    } else {
      if (run) {
        out.push(run);
        run = "";
      }
      out.push(letters);
    }
  }
  if (run) {
    out.push(run);
  }

  return out.join(" ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compileCategoryMatcher(category: AutoModerationCategory): RegExp | null {
  const entries = BLOCKLIST.filter((entry) => entry.category === category);
  if (entries.length === 0) {
    return null;
  }

  const alternatives = entries.map((entry) => {
    // Compile from the normalized term so the matcher and the input agree on
    // confusable folding. Allow each letter to repeat ("fuuuck") without
    // skipping separators (those are handled by collapseObfuscation).
    const body = normalizeForMatch(entry.term)
      .split("")
      .map((char) => `${escapeRegExp(char)}+`)
      .join("");
    return entry.type === "stem" ? `${body}\\p{L}*` : body;
  });

  // Bounded by non-letters on both sides so "scunthorpe"/"assistant" are safe.
  return new RegExp(`(?<!\\p{L})(?:${alternatives.join("|")})(?!\\p{L})`, "u");
}

const CATEGORY_MATCHERS = autoModerationCategories
  .map((category) => ({ category, matcher: compileCategoryMatcher(category) }))
  .filter(
    (entry): entry is { category: AutoModerationCategory; matcher: RegExp } =>
      entry.matcher !== null,
  );

const CATEGORY_NOTE_LABEL: Record<AutoModerationCategory, string> = {
  profanity: "нецензурна лексика",
  hate: "мова ворожнечі або образливі вислови",
  sexual: "відвертий сексуальний контент",
  spam: "ознаки спаму",
};

/** Matches a whole bare URL (scheme- or www-prefixed) so we can dedupe by URL. */
const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;

/**
 * Count distinct links. URLs are lowercased and stripped of trailing punctuation
 * before comparison so the same link repeated across language versions (or once
 * with a trailing period/paren) counts a single time — see
 * AUTO_MODERATION_LINK_LIMIT for why per-URL rather than per-occurrence.
 */
function countLinks(text: string): number {
  const matches = text.match(URL_PATTERN);
  if (!matches) {
    return 0;
  }
  const distinct = new Set(
    matches.map((url) => url.toLowerCase().replace(/[.,;:!?)\]]+$/, "")),
  );
  return distinct.size;
}

function isShouting(text: string): boolean {
  const letters = text.match(/\p{L}/gu);
  if (!letters || letters.length < SHOUTING_MIN_LETTERS) {
    return false;
  }
  const upper = letters.filter((char) => char !== char.toLowerCase()).length;
  return upper / letters.length > SHOUTING_RATIO;
}

/** Build the admin-facing `moderation_note` from the matched categories. */
export function buildModerationNote(
  categories: AutoModerationCategory[],
): string | null {
  if (categories.length === 0) {
    return null;
  }
  const labels = categories.map((category) => CATEGORY_NOTE_LABEL[category]);
  return `[авто] Виявлено: ${labels.join("; ")}`;
}

/**
 * Screen the given text fragments. HTML fragments (rich-text bodies) are
 * stripped to plain text first; plain strings pass through unchanged.
 */
export function screenContentForModeration(
  parts: Array<string | null | undefined>,
): AutoModerationResult {
  const text = parts
    .map((part) => (part ? extractPlainTextFromRichText(String(part)) : ""))
    .filter((part) => part.length > 0)
    .join(" \n ");

  if (!text.trim()) {
    return CLEAN_MODERATION_RESULT;
  }

  const matches: AutoModerationMatch[] = [];

  const normalized = normalizeForMatch(text);
  const collapsed = collapseObfuscation(normalized);
  for (const { category, matcher } of CATEGORY_MATCHERS) {
    if (matcher.test(normalized) || matcher.test(collapsed)) {
      matches.push({ category });
    }
  }

  const linkCount = countLinks(text);
  if (linkCount >= AUTO_MODERATION_LINK_LIMIT) {
    matches.push({ category: "spam", detail: "links", count: linkCount });
  }
  if (isShouting(text)) {
    matches.push({ category: "spam", detail: "shouting" });
  }

  const categories = autoModerationCategories.filter((category) =>
    matches.some((match) => match.category === category),
  );

  return {
    flagged: matches.length > 0,
    categories,
    matches,
    note: buildModerationNote(categories),
  };
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
    } satisfies Record<AutoModerationCategory, string>,
    links: (count: number) =>
      `too many links: ${count} (max ${AUTO_MODERATION_LINK_LIMIT - 1} — remove some)`,
    shouting: "mostly all-caps text",
  },
} as const;

/**
 * Build a precise, localized, user-facing explanation of why content was held
 * by auto-moderation: the triggered rule(s) plus a concrete example drawn from
 * the user's own text where one exists. Pure (safe to import on the client) so
 * a single string is rendered identically in every surface.
 */
export function describeModerationResult(
  result: Pick<AutoModerationResult, "categories"> &
    Partial<Pick<AutoModerationResult, "matches">>,
  locale: Locale,
): string {
  const copy = locale === "uk" ? MODERATION_REASON_COPY.uk : MODERATION_REASON_COPY.en;
  const matches = result.matches ?? [];
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
      // Blocklist categories name the rule only — we never quote the word back.
      reasons.push(copy.categories[match.category]);
    }
  } else {
    // No per-match evidence (older payloads): fall back to bare category labels.
    for (const category of result.categories) {
      reasons.push(copy.categories[category]);
    }
  }

  if (reasons.length === 0) {
    return `${copy.intro}. ${copy.fix}`;
  }

  return `${copy.intro}: ${reasons.join("; ")}. ${copy.fix}`;
}

// --------------------------------------------------------------------------
// Per-entity text collectors — gather every user-authored string (including
// secondary-language translations) that should be screened.
// --------------------------------------------------------------------------

export function collectProjectModerationText(
  payload: ProjectPayload,
): Array<string | null | undefined> {
  return [
    payload.title,
    payload.description,
    payload.role,
    payload.problem,
    payload.solution,
    payload.results,
    payload.githubContribution,
    payload.githubMotivation,
    payload.githubTechDecisions,
    payload.githubLearnings,
    payload.githubShowcaseNotes,
    payload.githubProductionUsage,
  ];
}

type ArticleModerationInput = {
  title: string;
  excerpt: string | null;
  content: string;
  translations?: Record<
    string,
    { title: string; excerpt?: string | null; content: string }
  >;
};

export function collectArticleModerationText(
  payload: ArticleModerationInput,
): Array<string | null | undefined> {
  const parts: Array<string | null | undefined> = [
    payload.title,
    payload.excerpt,
    payload.content,
  ];

  for (const version of Object.values(payload.translations ?? {})) {
    if (!version) {
      continue;
    }
    parts.push(version.title, version.excerpt, version.content);
  }

  return parts;
}

export function collectPollModerationText(
  payload: PollPayload,
): Array<string | null | undefined> {
  const parts: Array<string | null | undefined> = [
    payload.title,
    payload.excerpt,
    payload.content,
  ];

  for (const question of payload.questions) {
    parts.push(question.prompt, question.prompt_uk);
    for (const option of question.options) {
      parts.push(option.label, option.label_uk);
    }
  }

  for (const version of Object.values(payload.translations ?? {})) {
    if (!version) {
      continue;
    }
    parts.push(version.title, version.excerpt, version.content);
  }

  return parts;
}
