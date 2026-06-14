/**
 * Mentions config & shared parsing utilities.
 *
 * A "mention" is a contiguous `@username` token inside free-form text
 * (comment body, article content). Usernames follow the same rules the
 * profile system enforces: lowercase alphanumerics, dot, underscore, dash.
 */

export const MENTION_USERNAME_MIN = 2;
export const MENTION_USERNAME_MAX = 40;
export const MENTION_MAX_PER_SOURCE = 25;

const USERNAME_PATTERN = `[A-Za-z0-9._-]{${MENTION_USERNAME_MIN},${MENTION_USERNAME_MAX}}`;

// Global, case-insensitive matcher with negative lookbehind so emails
// (foo@bar.com) and chained tokens do not match.
export const MENTION_REGEX = new RegExp(
  `(?<![A-Za-z0-9._-])@(${USERNAME_PATTERN})(?![A-Za-z0-9._-])`,
  "g",
);

// Anchored variant for the live autocomplete: matches a mention being
// typed at the end of a string ("hi @ros").
export const MENTION_TRIGGER_REGEX = new RegExp(
  `(?:^|\\s)@([A-Za-z0-9._-]{0,${MENTION_USERNAME_MAX}})$`,
);

/**
 * Sanitizes a free-form search query before it is interpolated into a
 * PostgREST `.or()` ilike prefix match against username/name.
 *
 * Keeps Unicode letters/digits/marks — so Cyrillic and other non-Latin names
 * are searchable — plus the apostrophes, spaces, dots, hyphens and underscores
 * that appear in real names and usernames. Strips characters that are
 * structural inside the or-filter or act as ilike wildcards (`, ( ) % * : \ "`),
 * which prevents a query from injecting extra filters or wildcards.
 *
 * (The previous ASCII-only whitelist dropped Cyrillic entirely, so searching a
 * Ukrainian name returned no results.)
 */
export function sanitizeMentionQuery(raw: string): string {
  return raw.replace(/[^\p{L}\p{N}\p{M}'._\- ]/gu, "").trim();
}

/**
 * Extracts unique, lowercased @usernames from a body of text.
 * Returns them in the order of first occurrence (stable for tests and UX).
 */
export function extractMentionUsernames(text: string): string[] {
  if (!text) return [];

  const seen = new Set<string>();
  const order: string[] = [];

  for (const match of text.matchAll(MENTION_REGEX)) {
    const username = match[1]?.toLowerCase();
    if (!username || seen.has(username)) continue;
    seen.add(username);
    order.push(username);

    if (order.length >= MENTION_MAX_PER_SOURCE) break;
  }

  return order;
}
