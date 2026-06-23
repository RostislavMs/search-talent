import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import ArticleDetailView from "@/components/article-detail-view";
import { NEWS_CATEGORY_SLUG } from "@/lib/articles";
import { getArticleDetail } from "@/lib/db/articles";
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
    pathname: `/news/${slug}`,
    title: data?.article.title || null,
    excerpt,
    noindex: isThin,
  });
}

export default async function NewsDetailPage({
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

  // Only news items belong here; anything else is a community article — send it
  // back to /articles/[slug] so each piece keeps a single canonical URL.
  if (data.article.category?.slug !== NEWS_CATEGORY_SLUG) {
    redirect(`/${safeLocale}/articles/${slug}`);
  }

  return (
    <ArticleDetailView
      data={data}
      locale={safeLocale}
      slug={slug}
      section="news"
    />
  );
}
