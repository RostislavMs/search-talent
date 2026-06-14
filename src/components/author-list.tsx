import OptimizedImage from "@/components/ui/optimized-image";
import LocalizedLink from "@/components/ui/localized-link";
import type { ContentAuthor } from "@/lib/co-authors";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";

type AuthorListProps = {
  /** Authors in display order — the creator (isOwner) should come first. */
  authors: ContentAuthor[];
  locale: string;
  /** Names/avatars shown before the rest collapse into a "+N" / "та ще N". */
  maxVisible?: number;
  size?: "sm" | "md";
  /**
   * Link names to their profiles. Must be false when the list is rendered
   * inside another link (e.g. a card wrapped in <LocalizedLink>) to avoid
   * nested anchors.
   */
  linkProfiles?: boolean;
  /** Show the overlapping avatar stack before the names. */
  showAvatars?: boolean;
  className?: string;
};

const SIZE = {
  sm: { avatar: "h-6 w-6 text-[10px]", text: "text-xs", overlap: "-ml-1.5" },
  md: { avatar: "h-8 w-8 text-xs", text: "text-sm", overlap: "-ml-2" },
} as const;

function authorLabel(author: ContentAuthor, fallback: string): string {
  return author.name || author.username || fallback;
}

/**
 * Renders a content's authors as an overlapping avatar stack plus a names line
 * that collapses to "+N" past `maxVisible`. Reused across cards, the project
 * sidebar and article/poll bylines so multi-author attribution looks identical
 * everywhere (EN/UK parity by design).
 */
export default function AuthorList({
  authors,
  locale,
  maxVisible = 3,
  size = "sm",
  linkProfiles = true,
  showAvatars = true,
  className = "",
}: AuthorListProps) {
  const dict = getDictionary(isLocale(locale) ? locale : "en").coAuthors;
  const fallback = dict.authorFallback;
  const visible = authors.filter(Boolean);
  if (visible.length === 0) return null;

  const sizes = SIZE[size];
  const shown = visible.slice(0, maxVisible);
  const restCount = visible.length - shown.length;

  const renderName = (author: ContentAuthor, index: number) => {
    const label = authorLabel(author, fallback);
    const node =
      linkProfiles && author.username ? (
        <LocalizedLink
          href={`/u/${author.username}`}
          className="font-medium text-[color:var(--foreground)] hover:underline"
        >
          {label}
        </LocalizedLink>
      ) : (
        <span className="font-medium text-[color:var(--foreground)]">{label}</span>
      );
    return (
      <span key={author.userId || index}>
        {index > 0 && <span className="app-muted">, </span>}
        {node}
      </span>
    );
  };

  return (
    <span className={`inline-flex items-center gap-2 ${sizes.text} ${className}`}>
      {showAvatars && (
        <span className="flex items-center">
          {shown.map((author, index) => (
            <span
              key={author.userId || index}
              className={`relative flex ${sizes.avatar} items-center justify-center overflow-hidden rounded-full border-2 border-[color:var(--surface)] bg-[color:var(--surface-muted)] font-semibold text-[color:var(--foreground)] ${
                index > 0 ? sizes.overlap : ""
              }`}
              title={authorLabel(author, fallback)}
            >
              {author.avatarUrl ? (
                <OptimizedImage
                  src={author.avatarUrl}
                  alt={authorLabel(author, fallback)}
                  fill
                  sizes="32px"
                  className="object-cover"
                />
              ) : (
                <span>
                  {authorLabel(author, fallback).slice(0, 1).toUpperCase()}
                </span>
              )}
            </span>
          ))}
          {restCount > 0 && (
            <span
              className={`relative flex ${sizes.avatar} ${sizes.overlap} items-center justify-center rounded-full border-2 border-[color:var(--surface)] bg-[color:var(--surface-muted)] font-semibold app-muted`}
              title={dict.more.replace("{n}", String(restCount))}
            >
              +{restCount}
            </span>
          )}
        </span>
      )}
      <span className="min-w-0">
        {shown.map((author, index) => renderName(author, index))}
        {restCount > 0 && (
          <span className="app-muted">
            {" "}
            {dict.more.replace("{n}", String(restCount))}
          </span>
        )}
      </span>
    </span>
  );
}
