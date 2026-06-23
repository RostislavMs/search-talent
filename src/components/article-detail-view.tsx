import Link from "next/link";
import AdminContentQuickActions from "@/components/admin-content-quick-actions";
import ArticleInteractions from "@/components/article-interactions";
import AuthorList from "@/components/author-list";
import ArticlePinButton from "@/components/article-pin-button";
import ArticleTableOfContents from "@/components/article-table-of-contents";
import ReportArticleButton from "@/components/report-article-button";
import RichTextRenderer from "@/components/rich-text-renderer";
import { ButtonLink } from "@/components/ui/Button";
import OptimizedImage from "@/components/ui/optimized-image";
import ShareButton from "@/components/ui/share-button";
import {
  formatArticleDate,
  getArticleReadingTime,
  getCategoryDisplayName,
  type ArticleDetail,
  type ArticleAuthor,
} from "@/lib/articles";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { normalizeModerationStatus } from "@/lib/moderation";
import { extractPlainTextFromRichText } from "@/lib/rich-text-plain";
import {
  buildArticleSchema,
  buildBreadcrumbSchema,
  countWords,
  getMetadataBase,
  safeJsonLd,
} from "@/lib/seo";

/** Which top-level section this detail page renders under. Controls the back
 * link, breadcrumb, canonical URL and post-delete redirect — everything else is
 * identical, so News and Articles share one renderer. */
export type ArticleSection = "articles" | "news";

export type ArticleDetailData = {
  article: ArticleDetail;
  viewerUserId: string | null;
  isOwner: boolean;
  isAdmin: boolean;
};

function getModerationLabel(status: string | null, locale: string) {
  switch (normalizeModerationStatus(status)) {
    case "under_review":
      return locale === "uk" ? "На перевірці" : "Under review";
    case "restricted":
      return locale === "uk" ? "Обмежено" : "Restricted";
    case "removed":
      return locale === "uk" ? "Прибрано" : "Removed";
    default:
      return locale === "uk" ? "Схвалено" : "Approved";
  }
}

export default function ArticleDetailView({
  data,
  locale,
  slug,
  section,
}: {
  data: ArticleDetailData;
  locale: string;
  slug: string;
  section: ArticleSection;
}) {
  const { article, viewerUserId, isOwner, isAdmin } = data;
  const isUkrainian = locale === "uk";
  const isNews = section === "news";
  const sectionHref = isNews ? "/news" : "/articles";

  const author: ArticleAuthor | null = article.author;
  const deletedUserLabel = isUkrainian ? "Видалений користувач" : "Deleted user";
  const authorLabel = article.authorDeleted
    ? deletedUserLabel
    : author?.name || author?.username || "SearchTalent";
  const authorInitial = authorLabel.slice(0, 1).toUpperCase();
  const ui = isUkrainian
    ? {
        back: isNews ? "Усі новини" : "Усі статті",
        delete: "Видалити",
        deleting: "Видалення...",
        confirmDelete: "Видалити цю статтю?",
        deleteFailed: "Не вдалося видалити статтю.",
        by: "Автор",
        published: "Опубліковано",
        draft: "Чернетка",
        category: "Категорія",
        noCategory: "Без категорії",
        tableOfContents: isNews ? "Зміст" : "Зміст статті",
        moderatorNote: "Нотатка модератора",
        adminDelete: "Видалити як адмін",
        adminConfirmTitle: "Видалити статтю як адміністратор?",
        adminConfirmMessage:
          "Дію не можна скасувати. Стаття буде прибрана назавжди.",
        adminConfirmButton: "Видалити",
        cancel: "Скасувати",
      }
    : {
        back: isNews ? "All news" : "All articles",
        delete: "Delete",
        deleting: "Deleting...",
        confirmDelete: "Delete this article?",
        deleteFailed: "Could not delete the article.",
        by: "Author",
        published: "Published",
        draft: "Draft",
        category: "Category",
        noCategory: "No category",
        tableOfContents: isNews ? "Contents" : "In this article",
        moderatorNote: "Moderator note",
        adminDelete: "Delete as admin",
        adminConfirmTitle: "Delete article as administrator?",
        adminConfirmMessage:
          "This action cannot be undone. The article will be removed permanently.",
        adminConfirmButton: "Delete",
        cancel: "Cancel",
      };

  const siteUrl = getMetadataBase().toString().replace(/\/$/, "");
  const articleUrl = `${siteUrl}/${locale}${sectionHref}/${slug}`;

  // Only surface the table of contents when the article actually has a few
  // headings to jump between — otherwise it would reserve sidebar space for
  // nothing and narrow the reading column.
  const headingCount = article.content
    ? (article.content.match(/<h3[\s>]/gi)?.length ?? 0)
    : 0;
  const showTableOfContents = headingCount >= 2;

  const articlePlainText = article.content
    ? extractPlainTextFromRichText(article.content)
    : "";
  const articleSection = article.category
    ? isUkrainian
      ? article.category.nameUk || article.category.name
      : article.category.name
    : null;
  const articleKeywords = article.category
    ? [article.category.name, article.category.nameUk].filter(
        (value): value is string => Boolean(value),
      )
    : [];

  const articleSchema = buildArticleSchema({
    title: article.title,
    excerpt: article.excerpt || null,
    url: articleUrl,
    imageUrl: article.coverImageUrl || null,
    // News speaks in the platform's voice — credit SearchTalent, not the admin
    // who happened to post it.
    authorName: isNews ? "SearchTalent" : author?.name || author?.username || null,
    authorUrl:
      isNews || !author?.username
        ? null
        : `${siteUrl}/${locale}/u/${author.username}`,
    datePublished: article.publishedAt || article.createdAt || null,
    dateModified: null,
    articleSection,
    keywords: articleKeywords,
    wordCount: countWords(articlePlainText),
  });

  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: isUkrainian ? "Головна" : "Home", url: `${siteUrl}/${locale}` },
    {
      name: isNews
        ? isUkrainian
          ? "Новини"
          : "News"
        : isUkrainian
          ? "Статті"
          : "Articles",
      url: `${siteUrl}/${locale}${sectionHref}`,
    },
    { name: article.title, url: articleUrl },
  ]);

  return (
    <main
      className={`mx-auto px-4 py-10 sm:px-6 ${
        showTableOfContents ? "max-w-7xl" : "max-w-6xl"
      }`}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbSchema) }}
      />
      <div
        className={
          showTableOfContents
            ? "lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-8"
            : ""
        }
      >
        <div className="rounded-hero app-card min-w-0">
          <div className="border-b app-border p-6 sm:p-8">
            <div className="flex flex-wrap gap-3">
              <ButtonLink href={sectionHref} variant="secondary">
                {ui.back}
              </ButtonLink>
              <ShareButton url={articleUrl} title={article.title} />
              {!isOwner && viewerUserId && (
                <ReportArticleButton articleId={article.id} locale={locale} />
              )}
              {isAdmin && (
                <ArticlePinButton
                  articleId={article.id}
                  currentPinnedUntil={article.pinnedUntil}
                  locale={locale}
                />
              )}
              {!isOwner && isAdmin ? (
                <AdminContentQuickActions
                  targetType="article"
                  targetId={article.id}
                  currentStatus={article.moderationStatus}
                  locale={locale}
                  redirectAfterDelete={sectionHref}
                />
              ) : null}
              {article.status === "draft" ? (
                <span className="rounded-full bg-white/8 px-4 py-2 text-sm font-medium text-[color:var(--foreground)]">
                  {ui.draft}
                </span>
              ) : null}
              {(isOwner || isAdmin) && (
                <span className="rounded-full border app-border px-4 py-2 text-sm app-muted">
                  {getModerationLabel(article.moderationStatus, locale)}
                </span>
              )}
            </div>

            <h1 className="font-display mt-6 text-4xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-5xl">
              {article.title}
            </h1>

            {article.excerpt ? (
              <p className="mt-5 text-lg leading-8 app-muted">
                {article.excerpt}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm app-muted">
              {/* News carries the platform's voice, so it shows neither an
                  individual author nor a category (it is always "News"). */}
              {!isNews && (
                <>
                  {author?.username ? (
                <Link
                  href={`/${locale}/u/${author.username}`}
                  className="flex items-center gap-3 transition hover:opacity-80"
                >
                  <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border app-border bg-[color:var(--surface-muted)] text-sm font-semibold text-[color:var(--foreground)]">
                    {author.avatarUrl ? (
                      <OptimizedImage
                        src={author.avatarUrl}
                        alt={authorLabel}
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    ) : (
                      <span>{authorInitial}</span>
                    )}
                  </span>
                  <span className="underline underline-offset-4 decoration-[color:var(--border)]">
                    {authorLabel}
                  </span>
                </Link>
              ) : (
                <span className="flex items-center gap-3">
                  <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border app-border bg-[color:var(--surface-muted)] text-sm font-semibold text-[color:var(--foreground)]">
                    <span>{authorInitial}</span>
                  </span>
                  <span>{authorLabel}</span>
                </span>
              )}
              {article.coAuthors && article.coAuthors.length > 0 && (
                <span className="flex items-center gap-2">
                  <span className="app-soft">
                    {getDictionary(isUkrainian ? "uk" : "en").coAuthors
                      .bylineLabel}
                  </span>
                  <AuthorList
                    authors={article.coAuthors}
                    locale={locale}
                    maxVisible={3}
                    size="sm"
                  />
                </span>
              )}
                </>
              )}
              <span>
                {ui.published}:{" "}
                {formatArticleDate(
                  article.publishedAt || article.createdAt,
                  locale,
                )}
              </span>
              <span>{getArticleReadingTime(article.content, locale)}</span>
              {!isNews && (
                <span>
                  {ui.category}:{" "}
                  {getCategoryDisplayName(article.category, locale)}
                </span>
              )}
            </div>

            {(isOwner || isAdmin) && article.moderationNote ? (
              <div className="mt-5 rounded-[1.4rem] app-panel p-4">
                <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
                  {ui.moderatorNote}
                </p>
                <p className="mt-2 text-sm leading-7 app-muted">
                  {article.moderationNote}
                </p>
              </div>
            ) : null}
          </div>

          {article.coverImageUrl ? (
            <div className="relative aspect-[16/8]">
              <OptimizedImage
                src={article.coverImageUrl}
                alt={article.title}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1280px) 80vw, 1200px"
                className="object-cover"
              />
            </div>
          ) : article.heroVideoUrl ? (
            <video controls className="aspect-[16/8] w-full bg-black object-cover">
              <source src={article.heroVideoUrl} />
            </video>
          ) : null}

          <div className="grid gap-8 p-6 sm:p-8">
            <section id="article-body" className="space-y-6">
              <RichTextRenderer content={article.content} accentColor="#f97316" />
            </section>

            <ArticleInteractions
              locale={locale}
              articleId={article.id}
              initialLikesCount={article.likesCount}
              initialViewsCount={article.viewsCount}
              initialLiked={article.currentUserLiked}
              initialReactions={article.reactions}
              comments={article.comments}
              isAuthenticated={Boolean(viewerUserId)}
              viewerUserId={viewerUserId ?? null}
              ownerUserId={author?.userId ?? null}
            />
          </div>
        </div>
        {showTableOfContents ? (
          <aside className="mt-8 hidden lg:mt-0 lg:block">
            <ArticleTableOfContents
              targetId="article-body"
              title={ui.tableOfContents}
            />
          </aside>
        ) : null}
      </div>
    </main>
  );
}
