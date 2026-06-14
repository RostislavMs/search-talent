import OptimizedImage from "@/components/ui/optimized-image";
import LocalizedLink from "@/components/ui/localized-link";
import AuthorList from "@/components/author-list";
import type { ContentAuthor } from "@/lib/co-authors";
import { formatArticleDate, getCategoryDisplayName } from "@/lib/articles";
import { isPollClosed, type PollFeedItem } from "@/lib/polls";

export default function PollCard({
  poll,
  locale,
}: {
  poll: PollFeedItem;
  locale: string;
}) {
  const isUkrainian = locale === "uk";
  const authorLabel = poll.authorDeleted
    ? isUkrainian
      ? "Видалений користувач"
      : "Deleted user"
    : poll.author?.name || poll.author?.username || (isUkrainian ? "Автор" : "Author");
  const authorInitial = authorLabel.slice(0, 1).toUpperCase();
  const publishedLabel = formatArticleDate(poll.publishedAt || poll.createdAt, locale);
  const categoryLabel =
    getCategoryDisplayName(poll.category, locale) || (isUkrainian ? "Опитування" : "Poll");
  const isPinned = poll.pinnedUntil && new Date(poll.pinnedUntil) > new Date();
  const closed = isPollClosed(poll.closesAt);
  const coAuthors = poll.coAuthors ?? [];
  const allAuthors: ContentAuthor[] = poll.author
    ? [
        {
          userId: poll.author.userId,
          username: poll.author.username,
          name: poll.author.name,
          avatarUrl: poll.author.avatarUrl,
          isOwner: true,
        },
        ...coAuthors,
      ]
    : coAuthors;

  const questionLabel = isUkrainian
    ? `${poll.questionCount} ${poll.questionCount === 1 ? "питання" : "питань"}`
    : `${poll.questionCount} ${poll.questionCount === 1 ? "question" : "questions"}`;

  return (
    <LocalizedLink
      href={`/polls/${poll.slug}`}
      className="group block overflow-hidden rounded-hero app-card transition hover:-translate-y-0.5 hover:shadow-xl"
    >
      {poll.coverImageUrl && (
        <div className="relative aspect-video bg-[color:var(--surface-muted)]">
          {isPinned && (
            <span className="absolute left-4 top-4 z-10 rounded-full bg-[color:var(--brand)]/90 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              {isUkrainian ? "Закріплено" : "Pinned"}
            </span>
          )}
          <OptimizedImage
            src={poll.coverImageUrl}
            alt={poll.title}
            fill
            sizePreset="card"
            className="object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        </div>
      )}

      <div className="p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-eyebrow app-soft">
          {isPinned && !poll.coverImageUrl && (
            <>
              <span className="rounded-full bg-[color:var(--brand)]/90 px-2 py-0.5 text-white">
                {isUkrainian ? "Закріплено" : "Pinned"}
              </span>
              <span>•</span>
            </>
          )}
          <span>{categoryLabel}</span>
          <span>•</span>
          <span>{publishedLabel}</span>
          <span
            className={`rounded-full px-2 py-0.5 ${
              closed
                ? "bg-[color:var(--surface-muted)] app-soft"
                : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {closed ? (isUkrainian ? "Завершено" : "Closed") : isUkrainian ? "Активне" : "Open"}
          </span>
        </div>

        <h3 className="font-display mt-3 text-2xl font-medium leading-snug tracking-tight text-[color:var(--foreground)]">
          {poll.title}
        </h3>

        {poll.excerpt ? (
          <p className="mt-3 line-clamp-2 text-sm leading-7 app-muted">{poll.excerpt}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-t app-border pt-4 text-xs app-muted">
          {coAuthors.length > 0 && !poll.authorDeleted ? (
            <AuthorList
              authors={allAuthors}
              locale={locale}
              maxVisible={2}
              size="sm"
              linkProfiles={false}
            />
          ) : (
            <span className="flex items-center gap-2">
              <span className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border app-border bg-[color:var(--surface-muted)] text-[10px] font-semibold text-[color:var(--foreground)]">
                {poll.author?.avatarUrl ? (
                  <OptimizedImage
                    src={poll.author.avatarUrl}
                    alt={authorLabel}
                    fill
                    sizes="28px"
                    className="object-cover"
                  />
                ) : (
                  <span>{authorInitial}</span>
                )}
              </span>
              <span className="font-medium text-[color:var(--foreground)]">{authorLabel}</span>
            </span>
          )}
          <span aria-hidden="true">·</span>
          <span>{questionLabel}</span>
        </div>

        <div className="mt-3 flex items-center gap-4 text-sm app-muted">
          <span
            className="inline-flex items-center gap-1.5"
            title={isUkrainian ? "Голоси" : "Votes"}
          >
            <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7.5 11.5l-3-3L3 10l4.5 4.5L17 5l-1.5-1.5z" />
            </svg>
            <span className="font-display font-semibold tabular-nums">{poll.responsesCount}</span>
          </span>

          <span
            className="inline-flex items-center gap-1.5"
            title={isUkrainian ? "Перегляди" : "Views"}
          >
            <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 4C5.5 4 1.7 6.9 0 10c1.7 3.1 5.5 6 10 6s8.3-2.9 10-6c-1.7-3.1-5.5-6-10-6zm0 10a4 4 0 110-8 4 4 0 010 8zm0-6a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
            <span className="font-display font-semibold tabular-nums">{poll.viewsCount}</span>
          </span>

          <span
            className="inline-flex items-center gap-1.5"
            title={isUkrainian ? "Коментарі" : "Comments"}
          >
            <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 4h14a1 1 0 011 1v8a1 1 0 01-1 1H8l-4 3v-3H3a1 1 0 01-1-1V5a1 1 0 011-1z" />
            </svg>
            <span className="font-display font-semibold tabular-nums">{poll.commentsCount}</span>
          </span>
        </div>
      </div>
    </LocalizedLink>
  );
}
