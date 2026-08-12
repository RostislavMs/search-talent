import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import ArticleDetailView from "@/components/article-detail-view";
import { DISCUSSIONS_CATEGORY_SLUG } from "@/lib/articles";
import { getArticleDetail } from "@/lib/db/articles";
import { isLocale } from "@/lib/i18n/config";
import { extractPlainTextFromRichText } from "@/lib/rich-text-plain";
import { buildArticlePageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * A standalone discussion topic. Stored as an article in the Discussions
 * category, rendered by the shared article view under its own section.
 *
 * Always `noindex`, unlike News: a topic is short by nature and its value is the
 * replies, not the opening post, so it is thin content in search terms. That is
 * a deliberate product decision, not a temporary state — which also keeps these
 * out of the sitemap, per the noindex/sitemap invariant in lib/seo.ts.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const data = await getArticleDetail(slug, safeLocale);
  const excerpt =
    data?.article.excerpt ||
    (data?.article.content
      ? extractPlainTextFromRichText(data.article.content)
      : null);

  return buildArticlePageMetadata({
    locale: safeLocale,
    pathname: `/discussions/${slug}`,
    title: data?.article.title || null,
    excerpt,
    noindex: true,
  });
}

export default async function DiscussionTopicPage({
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

  // Only topics belong here; anything else is a community article — send it back
  // to /articles/[slug] so each piece keeps a single canonical URL.
  if (data.article.category?.slug !== DISCUSSIONS_CATEGORY_SLUG) {
    redirect(`/${safeLocale}/articles/${slug}`);
  }

  return (
    <ArticleDetailView
      data={data}
      locale={safeLocale}
      slug={slug}
      section="discussions"
    />
  );
}
