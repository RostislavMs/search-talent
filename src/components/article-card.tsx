import OptimizedImage from "@/components/ui/optimized-image";
import LocalizedLink from "@/components/ui/localized-link";
import AuthorList from "@/components/author-list";
import type { ContentAuthor } from "@/lib/co-authors";
import {
  formatArticleDate,
  getArticleReadingTime,
  getCategoryDisplayName,
  type ArticleFeedItem,
} from "@/lib/articles";

export default function ArticleCard({
  article,
  locale,
  compact = false,
  section = "articles",
}: {
  article: ArticleFeedItem;
  locale: string;
  /**
   * Tighter padding and smaller title — used where cards sit in a dense
   * multi-column row (e.g. 4-up on the homepage) so they don't tower.
   */
  compact?: boolean;
  /**
   * Section the card links into. News items render under /news, everything
   * else (the default) under /articles.
   */
  section?: "articles" | "news";
}) {
  const isUkrainian = locale === "uk";
  const authorLabel = article.authorDeleted
    ? isUkrainian
      ? "Видалений користувач"
      : "Deleted user"
    : article.author?.name || article.author?.username || (isUkrainian ? "Автор" : "Author");
  const authorInitial = authorLabel.slice(0, 1).toUpperCase();
  const publishedLabel = formatArticleDate(article.publishedAt || article.createdAt, locale);
  const readingTime = getArticleReadingTime(article.content || article.excerpt || "", locale);
  const categoryLabel = getCategoryDisplayName(article.category, locale) || (isUkrainian ? "Стаття" : "Article");
  const isPinned = article.pinnedUntil && new Date(article.pinnedUntil) > new Date();
  // News cards speak for the platform: no per-author byline, no category chip
  // (every item is "News"). Date + reading time stay.
  const isNews = section === "news";
  const coAuthors = article.coAuthors ?? [];
  const allAuthors: ContentAuthor[] = article.author
    ? [
        {
          userId: article.author.userId,
          username: article.author.username,
          name: article.author.name,
          avatarUrl: article.author.avatarUrl,
          isOwner: true,
        },
        ...coAuthors,
      ]
    : coAuthors;

  return (
    <LocalizedLink
      href={`/${section}/${article.slug}`}
      className="group block overflow-hidden rounded-hero app-card transition hover:-translate-y-0.5 hover:shadow-xl"
    >
      {(article.coverImageUrl || article.heroVideoUrl) && (
        <div className="relative aspect-video bg-[color:var(--surface-muted)]">
          {isPinned && (
            <span className="absolute left-4 top-4 z-10 rounded-full bg-orange-500/90 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              {isUkrainian ? "Закріплено" : "Pinned"}
            </span>
          )}
          {article.coverImageUrl ? (
            <OptimizedImage
              src={article.coverImageUrl}
              alt={article.title}
              fill
              sizePreset="card"
              className="object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          ) : article.heroVideoUrl ? (
            <video
              muted
              playsInline
              preload="metadata"
              className="h-full w-full object-cover"
            >
              <source src={article.heroVideoUrl} />
            </video>
          ) : null}
        </div>
      )}

      <div className={compact ? "p-4" : "p-6"}>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-eyebrow app-soft">
          {isPinned && !article.coverImageUrl && !article.heroVideoUrl && (
            <>
              <span className="rounded-full bg-orange-500/90 px-2 py-0.5 text-white">
                {isUkrainian ? "Закріплено" : "Pinned"}
              </span>
              <span>•</span>
            </>
          )}
          {!isNews && (
            <>
              <span>{categoryLabel}</span>
              <span>•</span>
            </>
          )}
          <span>{publishedLabel}</span>
        </div>

        <h3
          className={`font-display mt-3 font-medium leading-snug tracking-tight text-[color:var(--foreground)] ${
            compact ? "text-lg" : "text-2xl"
          }`}
        >
          {article.title}
        </h3>

        <p className="mt-3 line-clamp-2 text-sm leading-7 app-muted">
          {article.excerpt || article.content || ""}
        </p>

        <div
          className={`flex flex-wrap items-center gap-x-3 gap-y-2 border-t app-border text-xs app-muted ${
            compact ? "mt-4 pt-3" : "mt-6 pt-4"
          }`}
        >
          {!isNews && (
            <>
              {coAuthors.length > 0 && !article.authorDeleted ? (
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
                    {article.author?.avatarUrl ? (
                      <OptimizedImage
                        src={article.author.avatarUrl}
                        alt={authorLabel}
                        fill
                        sizes="28px"
                        className="object-cover"
                      />
                    ) : (
                      <span>{authorInitial}</span>
                    )}
                  </span>
                  <span className="font-medium text-[color:var(--foreground)]">
                    {authorLabel}
                  </span>
                </span>
              )}
              <span aria-hidden="true">·</span>
            </>
          )}
          <span>{readingTime}</span>
        </div>

        <div className="mt-3 flex items-center gap-4 text-sm app-muted">
          <span
            className="inline-flex items-center gap-1.5"
            aria-label={`${isUkrainian ? "Перегляди" : "Views"}: ${article.viewsCount}`}
            title={isUkrainian ? "Перегляди" : "Views"}
          >
            <svg
              aria-hidden="true"
              className="h-3.5 w-3.5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M10 4C5.5 4 1.7 6.9 0 10c1.7 3.1 5.5 6 10 6s8.3-2.9 10-6c-1.7-3.1-5.5-6-10-6zm0 10a4 4 0 110-8 4 4 0 010 8zm0-6a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
            <span className="font-display font-semibold tabular-nums">
              {article.viewsCount}
            </span>
          </span>

          <span
            className="inline-flex items-center gap-1.5"
            aria-label={`${isUkrainian ? "Лайки" : "Likes"}: ${article.likesCount}`}
            title={isUkrainian ? "Лайки" : "Likes"}
          >
            <svg
              aria-hidden="true"
              className="h-3.5 w-3.5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M10 17.5s-6.5-4.1-6.5-9.2A3.8 3.8 0 0110 5a3.8 3.8 0 016.5 3.3c0 5.1-6.5 9.2-6.5 9.2z" />
            </svg>
            <span className="font-display font-semibold tabular-nums">
              {article.likesCount}
            </span>
          </span>

          <span
            className="inline-flex items-center gap-1.5"
            aria-label={`${isUkrainian ? "Коментарі" : "Comments"}: ${article.commentsCount}`}
            title={isUkrainian ? "Коментарі" : "Comments"}
          >
            <svg
              aria-hidden="true"
              className="h-3.5 w-3.5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M3 4h14a1 1 0 011 1v8a1 1 0 01-1 1H8l-4 3v-3H3a1 1 0 01-1-1V5a1 1 0 011-1z" />
            </svg>
            <span className="font-display font-semibold tabular-nums">
              {article.commentsCount}
            </span>
          </span>
        </div>
      </div>
    </LocalizedLink>
  );
}
