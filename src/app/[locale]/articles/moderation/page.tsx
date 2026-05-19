import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import ArticleModerationActions from "@/components/article-moderation-actions";
import { ButtonLink } from "@/components/ui/Button";
import {
  formatArticleDate,
  getArticleReadingTime,
  getCategoryDisplayName,
} from "@/lib/articles";
import { getArticleModerationQueue } from "@/lib/db/articles";
import { createLocalePath, isLocale } from "@/lib/i18n/config";
import { requireAdmin } from "@/lib/moderation-server";
import { normalizeModerationStatus } from "@/lib/moderation";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const isUk = locale === "uk";
  return buildMetadata({
    locale,
    pathname: "/articles/moderation",
    title: isUk ? "Модерація статей" : "Article moderation",
    description: isUk
      ? "Панель модерації статей SearchTalent."
      : "SearchTalent article moderation panel.",
    noindex: true,
  });
}

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

export default async function ArticlesModerationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  await requireAdmin(safeLocale);
  const queue = await getArticleModerationQueue();

  if (!queue) {
    redirect(createLocalePath(safeLocale, "/dashboard"));
  }

  const isUkrainian = safeLocale === "uk";
  const ui = isUkrainian
    ? {
        title: "Модерація статей",
        description:
          "Тут адміністратор може швидко переглядати всі статті, змінювати статус модерації й залишати нотатку автору.",
        openFeed: "Відкрити статті",
        newArticle: "Нова стаття",
        empty: "У черзі статей поки нічого немає.",
        author: "Автор",
        category: "Категорія",
        noCategory: "Без категорії",
        published: "Опубліковано",
        draft: "Чернетка",
        openArticle: "Відкрити статтю",
        views: "Перегляди",
        likes: "Лайки",
        comments: "Коментарі",
        moderation: "Модерація",
      }
    : {
        title: "Article moderation",
        description:
          "Review newly created articles, change moderation status, and leave a note for the author.",
        openFeed: "Open articles",
        newArticle: "New article",
        empty: "There are no articles in the moderation queue yet.",
        author: "Author",
        category: "Category",
        noCategory: "No category",
        published: "Published",
        draft: "Draft",
        openArticle: "Open article",
        views: "Views",
        likes: "Likes",
        comments: "Comments",
        moderation: "Moderation",
      };

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6">
      <section className="rounded-[2.25rem] app-card p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[color:var(--foreground)] sm:text-4xl">
              {ui.title}
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-8 app-muted">
              {ui.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/articles" variant="secondary">
              {ui.openFeed}
            </ButtonLink>
            <ButtonLink href="/articles/new" variant="ghost">
              {ui.newArticle}
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="mt-8">
        {queue.length > 0 ? (
          <div className="space-y-5">
            {queue.map((article) => (
              <article key={article.id} className="rounded-[2rem] app-card p-6">
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] app-soft">
                      <span className="rounded-full border app-border px-3 py-1">
                        {article.status === "published" ? ui.published : ui.draft}
                      </span>
                      <span className="rounded-full border app-border px-3 py-1">
                        {getModerationLabel(article.moderationStatus, safeLocale)}
                      </span>
                      <span>{formatArticleDate(article.publishedAt || article.createdAt, safeLocale)}</span>
                    </div>

                    <h2 className="mt-4 text-2xl font-semibold text-[color:var(--foreground)]">
                      {article.title}
                    </h2>

                    {article.excerpt ? (
                      <p className="mt-3 text-sm leading-7 app-muted">{article.excerpt}</p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-4 text-sm app-muted">
                      <span>
                        {ui.author}:{" "}
                        {article.authorDeleted
                          ? isUkrainian
                            ? "Видалений користувач"
                            : "Deleted user"
                          : article.author?.name ||
                            article.author?.username ||
                            "SearchTalent"}
                      </span>
                      <span>
                        {ui.category}: {getCategoryDisplayName(article.category, safeLocale) || ui.noCategory}
                      </span>
                      <span>{getArticleReadingTime(article.content || "", safeLocale)}</span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-4 text-sm app-muted">
                      <span>
                        {ui.views}: {article.viewsCount}
                      </span>
                      <span>
                        {ui.likes}: {article.likesCount}
                      </span>
                      <span>
                        {ui.comments}: {article.commentsCount}
                      </span>
                    </div>

                    <div className="mt-5">
                      <ButtonLink href={`/articles/${article.slug}`} variant="ghost" size="sm">
                        {ui.openArticle}
                      </ButtonLink>
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] app-soft">
                      {ui.moderation}
                    </p>
                    <ArticleModerationActions
                      articleId={article.id}
                      locale={safeLocale}
                      initialNote={article.moderationNote}
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-[1.75rem] app-panel-dashed p-6 text-sm app-muted">
            {ui.empty}
          </p>
        )}
      </section>
    </main>
  );
}
