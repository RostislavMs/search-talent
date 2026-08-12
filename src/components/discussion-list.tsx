import LocalizedLink from "@/components/ui/localized-link";
import OptimizedImage from "@/components/ui/optimized-image";
import type {
  DiscussionListItem,
  DiscussionListKind,
} from "@/lib/db/discussions";
import { commentCountNoun } from "@/lib/discussions";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

/** One glyph per kind so a row is identifiable before reading a word of it. */
const KIND_GLYPH: Record<DiscussionListKind, string> = {
  topic: "◈",
  project: "▤",
  article: "✎",
  poll: "☑",
};

export default function DiscussionList({
  items,
  locale,
}: {
  items: DiscussionListItem[];
  locale: Locale;
}) {
  const dictionary = getDictionary(locale);

  const kindLabels: Record<DiscussionListKind, string> = {
    topic: dictionary.discussions.kindTopic,
    project: dictionary.discussions.kindProject,
    article: dictionary.discussions.kindArticle,
    poll: dictionary.discussions.kindPoll,
  };

  return (
    <ul className="divide-y divide-[color:var(--border)] border-y app-border">
      {items.map((item) => {
        const authorName =
          item.author?.name || item.author?.username || null;

        return (
          <li key={item.key}>
            <LocalizedLink
              href={item.href}
              className="flex gap-4 px-1 py-5 transition-colors hover:bg-[color:var(--surface-muted)] sm:px-3"
            >
              <span
                aria-hidden
                className="mt-0.5 hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border app-border text-base app-soft sm:flex"
              >
                {KIND_GLYPH[item.kind]}
              </span>

              <span className="min-w-0 flex-1">
                {/* Kind, author and time on one line: as separate rows they left
                    a sparse column of short fragments on a wide screen. */}
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span className="font-semibold uppercase tracking-eyebrow app-soft">
                    {kindLabels[item.kind]}
                  </span>
                  {item.isDraft ? (
                    <span className="rounded-full border app-border px-2 py-0.5 app-muted">
                      {dictionary.discussions.draftBadge}
                    </span>
                  ) : null}
                  {authorName ? (
                    <>
                      <span aria-hidden className="app-soft">
                        ·
                      </span>
                      <span className="flex items-center gap-1.5 app-muted">
                        {item.author?.avatarUrl ? (
                          <OptimizedImage
                            src={item.author.avatarUrl}
                            alt=""
                            width={18}
                            height={18}
                            className="h-[18px] w-[18px] rounded-full object-cover"
                          />
                        ) : (
                          <span
                            aria-hidden
                            className="flex h-[18px] w-[18px] items-center justify-center rounded-full app-panel text-[0.6rem] font-semibold"
                          >
                            {authorName.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        {authorName}
                      </span>
                    </>
                  ) : null}
                  {item.createdAt ? (
                    <>
                      <span aria-hidden className="app-soft">
                        ·
                      </span>
                      <span className="app-soft">
                        {formatRelativeTime(item.createdAt, locale)}
                      </span>
                    </>
                  ) : null}
                </span>

                <span className="mt-1.5 block font-display text-lg font-medium leading-snug tracking-tight text-[color:var(--foreground)]">
                  {item.title}
                </span>

                {item.excerpt ? (
                  <span className="mt-1 line-clamp-2 block text-sm leading-6 app-muted">
                    {item.excerpt}
                  </span>
                ) : null}
              </span>

              {/* The comment count is the one number that says whether a row is
                  worth opening, so it gets its own column instead of a chip. */}
              {item.isDraft ? null : (
                <span className="shrink-0 self-center text-right">
                  <span className="block font-display text-xl font-medium text-[color:var(--foreground)]">
                    {item.commentsCount}
                  </span>
                  <span className="block text-xs app-soft">
                    {commentCountNoun(item.commentsCount, locale)}
                  </span>
                </span>
              )}
            </LocalizedLink>
          </li>
        );
      })}
    </ul>
  );
}
