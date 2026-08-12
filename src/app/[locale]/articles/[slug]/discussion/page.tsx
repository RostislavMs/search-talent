import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ArticleInteractions from "@/components/article-interactions";
import DiscussionPageShell from "@/components/discussion-page-shell";
import { NEWS_CATEGORY_SLUG } from "@/lib/articles";
import { getArticleDetail } from "@/lib/db/articles";
import { isGifSearchConfigured } from "@/lib/gif/provider";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * The article's comment thread at its own URL. Auto-promoted: nothing is stored
 * for it and nobody creates it — it simply exists for every article, and the
 * article page starts linking here once the thread crosses the promotion
 * threshold. Always `noindex`: the content is a duplicate of the thread already
 * rendered on the article page, so it must never compete with it in search (and
 * for the same reason it stays out of the sitemap).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(safeLocale);
  const data = await getArticleDetail(slug, safeLocale);
  const title = data?.article.title || dictionary.discussions.sectionTitle;

  return buildMetadata({
    locale: safeLocale,
    pathname: `/articles/${slug}/discussion`,
    title: dictionary.discussions.metaTitle.replace("{title}", title),
    description: dictionary.discussions.metaDescription.replace(
      "{title}",
      title,
    ),
    noindex: true,
  });
}

export default async function ArticleDiscussionPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const data = await getArticleDetail(slug, safeLocale);

  if (!data) {
    notFound();
  }

  const dictionary = getDictionary(safeLocale);
  // News lives under its own section, so send the reader back where the article
  // actually canonically lives. The discussion itself stays on one route.
  const parentHref =
    data.article.category?.slug === NEWS_CATEGORY_SLUG
      ? `/news/${slug}`
      : `/articles/${slug}`;

  return (
    <DiscussionPageShell
      locale={safeLocale}
      parentHref={parentHref}
      parentTitle={data.article.title}
      backLabel={dictionary.discussions.backToArticle}
    >
      {data.article.comments.length === 0 ? (
        <p className="rounded-3xl app-panel-dashed p-5 text-sm app-muted">
          {dictionary.discussions.empty}
        </p>
      ) : (
        <ArticleInteractions
          locale={safeLocale}
          articleId={data.article.id}
          initialLikesCount={data.article.likesCount}
          initialViewsCount={data.article.viewsCount}
          initialLiked={data.article.currentUserLiked}
          initialReactions={data.article.reactions}
          comments={data.article.comments}
          isAuthenticated={Boolean(data.viewerUserId)}
          viewerUserId={data.viewerUserId}
          ownerUserId={data.article.author?.userId ?? null}
          gifEnabled={isGifSearchConfigured()}
        />
      )}
    </DiscussionPageShell>
  );
}
