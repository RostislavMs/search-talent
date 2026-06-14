// Shared co-authorship domain types and constants (Phase 1: attribution).
//
// The content creator stays in the existing owner column; co-authors are
// additional, invited users who explicitly accepted. Scoring is unaffected in
// this phase — see database/2026-06-13-co-authors.sql.

export const CO_AUTHOR_STATUSES = ["pending", "accepted", "declined"] as const;
export type CoAuthorStatus = (typeof CO_AUTHOR_STATUSES)[number];

/** Content types that support co-authors. */
export const CO_AUTHOR_CONTENT_TYPES = ["project", "article", "poll"] as const;
export type CoAuthorContentType = (typeof CO_AUTHOR_CONTENT_TYPES)[number];

/** Junction table name for each content type. */
export const CO_AUTHOR_TABLE: Record<CoAuthorContentType, string> = {
  project: "project_authors",
  article: "article_authors",
  poll: "poll_authors",
};

/** Foreign-key column pointing at the parent content for each junction table. */
export const CO_AUTHOR_CONTENT_COLUMN: Record<CoAuthorContentType, string> = {
  project: "project_id",
  article: "article_id",
  poll: "poll_id",
};

/** Maximum additional co-authors beyond the creator. */
export const MAX_CO_AUTHORS = 4;
/** Total authors a single work may credit, including the creator. */
export const MAX_AUTHORS_TOTAL = MAX_CO_AUTHORS + 1;

/**
 * An author shown on a piece of content — either the creator (`isOwner: true`)
 * or an accepted co-author. Used uniformly by cards, detail pages and bylines.
 */
export type ContentAuthor = {
  userId: string;
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
  /** True for the original creator (owner_id / author_user_id). */
  isOwner: boolean;
};

/** A pending/responded invitation as seen by the invited user. */
export type CoAuthorInvitation = {
  id: string;
  contentType: CoAuthorContentType;
  contentId: string;
  contentTitle: string;
  contentSlug: string;
  status: CoAuthorStatus;
  invitedAt: string;
  inviter: {
    userId: string | null;
    username: string | null;
    name: string | null;
    avatarUrl: string | null;
  };
};

/**
 * Normalizes/validates a raw co-author user-id list from a create form:
 * dedupes, drops the creator, drops falsy entries, and caps to MAX_CO_AUTHORS.
 */
export function sanitizeCoAuthorIds(
  raw: unknown,
  creatorUserId: string,
): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const id = entry.trim();
    if (!id || id === creatorUserId || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_CO_AUTHORS) break;
  }
  return out;
}

/**
 * Builds the display label for an author list, e.g. "Alice, Bob та ще 2".
 * `maxVisible` names are shown, the rest collapse into a "+N" suffix.
 */
export function formatAuthorNames(
  authors: Pick<ContentAuthor, "name" | "username">[],
  options: { maxVisible?: number; locale?: "uk" | "en"; fallback?: string } = {},
): string {
  const { maxVisible = 2, locale = "uk", fallback = "SearchTalent" } = options;
  const names = authors.map(
    (a) => a.name || a.username || fallback,
  );
  if (names.length === 0) return fallback;
  if (names.length <= maxVisible) return names.join(", ");
  const visible = names.slice(0, maxVisible).join(", ");
  const rest = names.length - maxVisible;
  return locale === "uk"
    ? `${visible} та ще ${rest}`
    : `${visible} +${rest}`;
}
