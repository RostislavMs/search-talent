/**
 * Shared layout for the threaded comment lists (articles/discussions, projects,
 * polls). The three surfaces render their own nodes but must look identical, so
 * the nesting geometry lives here instead of being copy-pasted three times.
 *
 * Mobile budget: every level used to cost ~47px of horizontal space (28px
 * avatar + 8px gap + 10px indent + 1px rule), so on a 390px screen a depth-4
 * reply was left with a 128px text column and a three-line header. Nested
 * levels now drop the avatar below `sm` and indent by 12px, which costs 13px
 * per level and keeps replies readable all the way down.
 *
 * Class strings are spelled out in full on purpose — Tailwind only generates
 * classes it can find literally in the source.
 */

/**
 * Levels deeper than these stop indenting so text keeps a usable width. Mobile
 * goes deeper than desktop because a level costs it 13px (rule + padding) while
 * desktop still pays 53px for the avatar column it keeps.
 */
const DESKTOP_INDENT_DEPTH = 3;
const MOBILE_INDENT_DEPTH = 5;

/** Wrapper for a single comment: avatar column + content column. */
export const COMMENT_ROW_CLASS = "flex gap-2 sm:gap-3";

const AVATAR_BASE =
  "relative h-7 w-7 shrink-0 overflow-hidden rounded-full sm:h-8 sm:w-8";

/**
 * Avatar wrapper. Replies hide it below `sm`: at that width the indent rule
 * already shows the nesting, and the name in the header still says who wrote it.
 */
export function commentAvatarClass(depth: number, extra?: string) {
  return [depth > 0 ? "hidden sm:block" : "", AVATAR_BASE, extra]
    .filter(Boolean)
    .join(" ");
}

/** Same, for surfaces that center a fallback initial inside the avatar. */
export function commentAvatarFlexClass(depth: number, extra?: string) {
  return [depth > 0 ? "hidden sm:flex" : "flex", AVATAR_BASE, extra]
    .filter(Boolean)
    .join(" ");
}

/**
 * Container holding a comment's replies. `depth` is the depth of the comment
 * that owns them, so its children sit one level deeper.
 */
export function commentRepliesClass(depth: number) {
  const base = "mt-3 space-y-4 sm:mt-4 sm:space-y-5";

  if (depth < DESKTOP_INDENT_DEPTH) {
    return `${base} border-l app-border pl-3 sm:pl-4`;
  }

  // Past the desktop cap the rule would crowd the text column, but mobile has
  // dropped the avatars by now and still needs it to show the nesting.
  if (depth < MOBILE_INDENT_DEPTH) {
    return `${base} border-l app-border pl-3 sm:border-l-0 sm:pl-0`;
  }

  return base;
}
