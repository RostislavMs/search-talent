import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import ArticleDetailView from "@/components/article-detail-view";
import {
  DISCUSSIONS_CATEGORY_SLUG,
  NEWS_CATEGORY_SLUG,
  getCategoryDisplayName,
} from "@/lib/articles";
import { getArticleDetail, getRelatedArticles } from "@/lib/db/articles";
import { isLocale } from "@/lib/i18n/config";
import { isPublicModerationStatus } from "@/lib/moderation";
import { extractPlainTextFromRichText } from "@/lib/rich-text-plain";
import { buildArticlePageMetadata, getMetadataBase } from "@/lib/seo";

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

  // News and Discussions live under their own sections. The page below redirects
  // there, but that `redirect()` runs after the response has begun streaming, so
  // it never reaches the wire as a 308 and this URL answers 200 as well. Point
  // the canonical (and the hreflang cluster) at the section URL so the entity is
  // not indexed twice under conflicting self-canonicals.
  const categorySlug = data?.article.category?.slug ?? null;
  const canonicalOverride =
    categorySlug === NEWS_CATEGORY_SLUG
      ? `/news/${slug}`
      : categorySlug === DISCUSSIONS_CATEGORY_SLUG
        ? `/discussions/${slug}`
        : undefined;

  return buildArticlePageMetadata({
    locale: safeLocale,
    pathname: `/articles/${slug}`,
    canonicalOverride,
    title: data?.article.title || null,
    excerpt,
    // A locale that has no version of its own falls back to the primary
    // language, which must not be indexed under this locale's hreflang.
    // Discussions are noindex by product decision.
    noindex:
      isThin ||
      Boolean(data?.article.isLocaleFallback) ||
      categorySlug === DISCUSSIONS_CATEGORY_SLUG,
    publishedTime: data?.article.publishedAt || data?.article.createdAt || null,
    modifiedTime:
      data?.article.editedAt ||
      data?.article.publishedAt ||
      data?.article.createdAt ||
      null,
    authors: data?.article.author?.username
      ? [
          new URL(
            `/${safeLocale}/u/${data.article.author.username}`,
            getMetadataBase(),
          ).toString(),
        ]
      : undefined,
    section: data?.article.category
      ? getCategoryDisplayName(data.article.category, safeLocale)
      : null,
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

  // News and Discussions are their own sections — keep a single canonical URL by
  // redirecting to them (old /articles links stay valid via this 308).
  if (data.article.category?.slug === NEWS_CATEGORY_SLUG) {
    redirect(`/${safeLocale}/news/${slug}`);
  }

  if (data.article.category?.slug === DISCUSSIONS_CATEGORY_SLUG) {
    redirect(`/${safeLocale}/discussions/${slug}`);
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
