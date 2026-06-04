import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ArticleCard from "@/components/article-card";
import DeleteArticleButton from "@/components/delete-article-button";
import { ButtonLink } from "@/components/ui/Button";
import { buttonStyles } from "@/components/ui/button-styles";
import { getCategoryDisplayName, type ArticleFeedItem } from "@/lib/articles";
import { getDashboardArticles } from "@/lib/db/articles";
import { getUserArticlesPage } from "@/lib/db/public";
import { normalizeModerationStatus } from "@/lib/moderation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata, getMetadataBase } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getRouteParams(
  params: Promise<{ locale: string; username: string }>,
) {
  const { locale, username } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return { locale, username };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; username: string }>;
}): Promise<Metadata> {
  const { locale, username } = await getRouteParams(params);
  const dictionary = getDictionary(locale);

  return buildMetadata({
    locale,
    pathname: `/u/${username}/articles`,
    title: `${locale === "uk" ? "Статті" : "Articles"} — @${username}`,
    description: dictionary.metadata.creatorProfile.description,
    feeds: [
      {
        url: new URL(
          `/${locale}/u/${username}/articles/feed.xml`,
          getMetadataBase(),
        ).toString(),
        title: `@${username} — ${locale === "uk" ? "Статті" : "Articles"}`,
      },
    ],
  });
}

function getOwnerUi(locale: string) {
  if (locale === "uk") {
    return {
      eyebrow: "Ваші статті",
      title: "Мої статті",
      description:
        "Керуйте опублікованими матеріалами та чернетками. Створюйте нові статті або редагуйте існуючі.",
      backToProfile: "До профілю",
      createArticle: "Нова стаття",
      openFeed: "Стрічка статей",
      empty: "У вас ще немає статей. Почніть із чернетки.",
      draft: "Чернетка",
      published: "Опубліковано",
      openArticle: "Відкрити статтю",
      editArticle: "Редагувати",
      views: "Перегляди",
      likes: "Лайки",
      comments: "Коментарі",
      note: "Нотатка модератора",
      delete: "Видалити",
      deleting: "Видалення...",
      confirmTitle: "Видалити статтю?",
      confirmDelete: "Дію не можна скасувати. Стаття буде прибрана назавжди.",
      deleteFailed: "Не вдалося видалити статтю.",
      cancel: "Скасувати",
    };
  }

  return {
    eyebrow: "Your articles",
    title: "My articles",
    description:
      "Manage your drafts and published work. Create new articles or edit existing ones.",
    backToProfile: "Back to profile",
    createArticle: "New article",
    openFeed: "Articles feed",
    empty: "You don't have any articles yet. Start with a draft.",
    draft: "Draft",
    published: "Published",
    openArticle: "Open article",
    editArticle: "Edit",
    views: "Views",
    likes: "Likes",
    comments: "Comments",
    note: "Moderator note",
    delete: "Delete",
    deleting: "Deleting...",
    confirmTitle: "Delete article?",
    confirmDelete: "This action cannot be undone. The article will be removed permanently.",
    deleteFailed: "Could not delete the article.",
    cancel: "Cancel",
  };
}

function formatModerationBadge(status: string | null, locale: string) {
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

export default async function UserArticlesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; username: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, username } = await getRouteParams(params);
  const dictionary = getDictionary(locale);
  const { page } = await searchParams;
  const requestedPage = Number.parseInt(page || "1", 10);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isOwner = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("user_id", user.id)
      .maybeSingle();

    isOwner = profile?.username === username;
  }

  if (isOwner) {
    return renderOwnerView({ locale, username });
  }

  return renderPublicView({
    locale,
    username,
    page: requestedPage,
    dictionary,
  });
}

async function renderOwnerView({
  locale,
  username,
}: {
  locale: string;
  username: string;
}) {
  const dashboard = await getDashboardArticles();
  const ui = getOwnerUi(locale);

  if (!dashboard) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 sm:py-10">
      <section className="rounded-hero app-card p-5 sm:p-8 md:p-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-eyebrow app-soft">
              {ui.eyebrow}
            </p>
            <h1 className="font-display mt-3 text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
              {ui.title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 app-muted">
              {ui.description}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/articles/new">{ui.createArticle}</ButtonLink>
            <ButtonLink href="/articles" variant="secondary">
              {ui.openFeed}
            </ButtonLink>
            <ButtonLink href={`/u/${username}`} variant="ghost">
              {ui.backToProfile}
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="mt-6 sm:mt-8">
        {dashboard.items.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {dashboard.items.map((item) => (
              <article
                key={item.id}
                className="rounded-panel app-card p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold text-[color:var(--foreground)]">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm app-muted">
                      {getCategoryDisplayName(item.category, locale)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full app-panel px-4 py-2 text-sm app-muted">
                      {item.status === "published" ? ui.published : ui.draft}
                    </span>
                    <span className="rounded-full border app-border px-4 py-2 text-sm app-muted">
                      {formatModerationBadge(item.moderationStatus, locale)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-4 text-sm app-muted">
                  <span>
                    {ui.views}: {item.viewsCount}
                  </span>
                  <span>
                    {ui.likes}: {item.likesCount}
                  </span>
                  <span>
                    {ui.comments}: {item.commentsCount}
                  </span>
                </div>

                {item.moderationNote ? (
                  <div className="mt-4 rounded-2xl app-panel p-4">
                    <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
                      {ui.note}
                    </p>
                    <p className="mt-2 text-sm leading-7 app-muted">
                      {item.moderationNote}
                    </p>
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-3">
                  <ButtonLink
                    href={`/articles/${item.slug}`}
                    variant="ghost"
                    size="sm"
                  >
                    {ui.openArticle}
                  </ButtonLink>
                  <ButtonLink
                    href={`/articles/edit/${item.id}`}
                    variant="ghost"
                    size="sm"
                  >
                    {ui.editArticle}
                  </ButtonLink>
                  <DeleteArticleButton
                    articleId={item.id}
                    label={ui.delete}
                    pendingLabel={ui.deleting}
                    confirmTitle={ui.confirmTitle}
                    confirmMessage={ui.confirmDelete}
                    confirmButtonLabel={ui.delete}
                    cancelLabel={ui.cancel}
                    errorFallback={ui.deleteFailed}
                  />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-panel app-panel-dashed p-6">
            <p className="text-sm app-muted">{ui.empty}</p>
            <div className="mt-4">
              <ButtonLink href="/articles/new" size="sm">
                {ui.createArticle}
              </ButtonLink>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

async function renderPublicView({
  locale,
  username,
  page,
  dictionary,
}: {
  locale: string;
  username: string;
  page: number;
  dictionary: ReturnType<typeof getDictionary>;
}) {
  const result = await getUserArticlesPage(username, {
    page: Number.isFinite(page) ? page : 1,
    perPage: 12,
  });

  if (!result) {
    notFound();
  }

  const displayName =
    result.profile.name || `@${result.profile.username}` || username;
  const heading = locale === "uk" ? "Статті" : "Articles";
  const empty =
    locale === "uk"
      ? "Ще немає опублікованих статей."
      : "No published articles yet.";
  const backToProfile = dictionary.creatorProfile.backToProfile;
  const previous = dictionary.dashboardProjects.previousPage;
  const next = dictionary.dashboardProjects.nextPage;
  const pageLabel = dictionary.dashboardProjects.pageLabel;

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 sm:py-10">
      <section className="rounded-hero app-card p-5 sm:p-8 md:p-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-eyebrow app-soft">
              {heading}
            </p>
            <h1 className="font-display mt-3 text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
              {displayName}
            </h1>
            <p className="mt-2 text-sm app-muted">
              {result.totalCount}{" "}
              {locale === "uk" ? "публікацій" : "publications"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {result.totalCount > 0 ? (
              <a
                href={`/${locale}/u/${username}/articles/feed.xml`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={
                  locale === "uk"
                    ? `RSS-стрічка статей ${displayName}`
                    : `RSS feed of articles by ${displayName}`
                }
                className={buttonStyles({ variant: "ghost", className: "gap-2" })}
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <path d="M2 11a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                  <path d="M2 5.5a.5.5 0 0 1 .5-.5c5.247 0 9.5 4.253 9.5 9.5a.5.5 0 0 1-1 0A8.5 8.5 0 0 0 2.5 6a.5.5 0 0 1-.5-.5z" />
                  <path d="M2 1.5a.5.5 0 0 1 .5-.5C9.404 1 15 6.596 15 13.5a.5.5 0 0 1-1 0C14 7.149 8.851 2 2.5 2a.5.5 0 0 1-.5-.5z" />
                </svg>
                RSS
              </a>
            ) : null}
            <ButtonLink href={`/u/${username}`} variant="ghost">
              {backToProfile}
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="mt-6 sm:mt-8">
        {result.articles.length > 0 ? (
          <>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {result.articles.map((item) => {
                const feedItem: ArticleFeedItem = {
                  id: item.id,
                  slug: item.slug,
                  title: item.title,
                  excerpt: item.excerpt,
                  content: item.content,
                  coverImageUrl: item.cover_image_url,
                  heroVideoUrl: item.hero_video_url,
                  publishedAt: item.published_at,
                  createdAt: item.created_at,
                  viewsCount: item.views_count,
                  likesCount: item.likes_count,
                  commentsCount: item.comments_count,
                  category: item.category,
                  author: item.author,
                  authorDeleted: false,
                  pinnedUntil: item.pinned_until,
                };

                return (
                  <ArticleCard
                    key={item.id}
                    article={feedItem}
                    locale={locale}
                  />
                );
              })}
            </div>

            {result.totalPages > 1 ? (
              <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm app-muted">
                  {pageLabel} {result.currentPage} / {result.totalPages}
                </span>

                <div className="flex gap-3">
                  {result.currentPage > 1 ? (
                    <ButtonLink
                      href={`/u/${username}/articles?page=${result.currentPage - 1}`}
                      variant="ghost"
                      size="sm"
                    >
                      {previous}
                    </ButtonLink>
                  ) : null}

                  {result.currentPage < result.totalPages ? (
                    <ButtonLink
                      href={`/u/${username}/articles?page=${result.currentPage + 1}`}
                      variant="secondary"
                      size="sm"
                    >
                      {next}
                    </ButtonLink>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-panel app-card p-6">
            <p className="text-sm app-muted">{empty}</p>
          </div>
        )}
      </section>
    </main>
  );
}
