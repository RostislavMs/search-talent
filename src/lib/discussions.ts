/**
 * Auto-promoted discussion threads.
 *
 * A discussion page is never authored — it is the comment thread of an existing
 * project/article/poll, given its own URL once the conversation is big enough to
 * deserve one. Nothing is stored: the page reads the same `*_comments` rows the
 * parent page already reads, and the threshold below is purely a display rule
 * over the comment count. That is why adding this needed no migration.
 *
 * Deleting comments can push a thread back under the threshold. The page keeps
 * working in that case — only the call-to-action on the parent page and the
 * listing disappear — so links shared while the thread was hot never 404.
 */

export const DISCUSSION_CONTENT_KINDS = ["project", "article", "poll"] as const;

export type DiscussionContentKind = (typeof DISCUSSION_CONTENT_KINDS)[number];

/**
 * Total comments (top-level + replies) a thread needs before it gets promoted.
 * Deliberately low: the page exists to give a live conversation a permalink, and
 * five comments already read as a conversation. A higher bar on a low-traffic
 * site means the feature never fires at all.
 */
export const DISCUSSION_COMMENT_THRESHOLD = 5;

/**
 * How many top-level comments the parent page keeps inline once promoted. The
 * rest live on the discussion page. Counted in top-level comments, not total,
 * so a preview never cuts a reply away from the comment it answers.
 */
export const DISCUSSION_PREVIEW_LIMIT = 5;

const DISCUSSION_BASE_PATH: Record<DiscussionContentKind, string> = {
  project: "/projects",
  article: "/articles",
  poll: "/polls",
};

/**
 * Whether a thread has earned its own page. Takes the total comment count
 * (replies included) — a thread of one comment and twelve replies is every bit
 * a discussion.
 */
export function isDiscussionOpen(totalCommentCount: number): boolean {
  return totalCommentCount >= DISCUSSION_COMMENT_THRESHOLD;
}

/** Locale-less path; `LocalizedLink`/`createLocalePath` add the locale prefix. */
export function buildDiscussionPath(
  kind: DiscussionContentKind,
  slug: string,
): string {
  return `${DISCUSSION_BASE_PATH[kind]}/${encodeURIComponent(slug)}/discussion`;
}

/**
 * "12 коментарів" / "12 comments". Ukrainian needs the three-way plural, so this
 * mirrors the `pluralizeReplies` helpers already used in the comment threads
 * rather than pushing a template string through the dictionary.
 */
export function formatCommentCount(count: number, locale: string): string {
  return `${count} ${commentCountNoun(count, locale)}`;
}

/**
 * Just the noun, for layouts that show the number separately (the listing puts
 * the count in its own column). Split out so the two never disagree on plurals.
 */
export function commentCountNoun(count: number, locale: string): string {
  if (locale === "uk") {
    const mod10 = count % 10;
    const mod100 = count % 100;

    if (mod10 === 1 && mod100 !== 11) return "коментар";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
      return "коментарі";
    return "коментарів";
  }

  return count === 1 ? "comment" : "comments";
}

/** Path back to the content the discussion belongs to. */
export function buildDiscussionParentPath(
  kind: DiscussionContentKind,
  slug: string,
): string {
  return `${DISCUSSION_BASE_PATH[kind]}/${encodeURIComponent(slug)}`;
}
