import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import ArticleDetailView from "@/components/article-detail-view";
import { NEWS_CATEGORY_SLUG } from "@/lib/articles";
import { getArticleDetail, getRelatedArticles } from "@/lib/db/articles";
import { isLocale } from "@/lib/i18n/config";
import { isPublicModerationStatus } from "@/lib/moderation";
import { extractPlainTextFromRichText } from "@/lib/rich-text-plain";
import { buildArticlePageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const data = await getArticleDetail(slug, safeLocale);

  const isDraft = data?.article.status !== "published";
  const isNotPublicModeration = !isPublicModerationStatus(
    data?.article.moderationStatus ?? null,
  );
  const isThin = !data || isDraft || isNotPublicModeration;
  const excerpt =
    data?.article.excerpt ||
    (data?.article.content
      ? extractPlainTextFromRichText(data.article.content)
      : null);

  return buildArticlePageMetadata({
    locale: safeLocale,
    pathname: `/articles/${slug}`,
    title: data?.article.title || null,
    excerpt,
    noindex: isThin,
  });
}

export default async function ArticleDetailPage({
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

  // News is its own section — keep a single canonical URL by redirecting news
  // items to /news/[slug] (old /articles links stay valid via this 308).
  if (data.article.category?.slug === NEWS_CATEGORY_SLUG) {
    redirect(`/${safeLocale}/news/${slug}`);
  }

  const relatedArticles = await getRelatedArticles({
    articleId: data.article.id,
    categoryId: data.article.category?.id ?? null,
    title: data.article.title,
    excerpt: data.article.excerpt,
    content: data.article.content,
    locale: safeLocale,
    limit: 3,
  });

  return (
    <ArticleDetailView
      data={data}
      locale={safeLocale}
      slug={slug}
      section="articles"
      relatedArticles={relatedArticles}
    />
  );
}
