import { getArticlesForFeed, getFeedAuthor } from "@/lib/db/feed";
import { buildRssFeed, FEED_CONTENT_TYPE, type FeedItem } from "@/lib/feed";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getMetadataBase } from "@/lib/seo";

// Rendered per request (no ISR — facet/feed routes 500 on the on-demand ISR
// path in production). The CDN still caches via the Cache-Control header below.
export const dynamic = "force-dynamic";

const FEED_CACHE_CONTROL =
  "public, s-maxage=600, stale-while-revalidate=86400";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; username: string }> },
) {
  const { locale, username } = await params;

  if (!isLocale(locale)) {
    return new Response("Not found", { status: 404 });
  }

  const author = await getFeedAuthor(username);
  if (!author) {
    return new Response("Not found", { status: 404 });
  }

  const dictionary = getDictionary(locale);
  const base = getMetadataBase().toString().replace(/\/$/, "");
  const articles = await getArticlesForFeed({ authorUserId: author.userId });
  const authorLabel = author.name || `@${author.username}`;
  const articlesLabel = locale === "uk" ? "Статті" : "Articles";

  const items: FeedItem[] = articles.map((article) => {
    const link = `${base}/${locale}/articles/${article.slug}`;
    return {
      title: article.title,
      link,
      guid: link,
      description: article.excerpt,
      pubDate: article.publishedAt || article.createdAt,
      author: article.authorName || author.name || author.username,
    };
  });

  const xml = buildRssFeed({
    title: `${authorLabel} — ${articlesLabel}`,
    link: `${base}/${locale}/u/${author.username}/articles`,
    feedUrl: `${base}/${locale}/u/${author.username}/articles/feed.xml`,
    description:
      locale === "uk"
        ? `Статті від ${authorLabel} на ${dictionary.site.name}.`
        : `Articles by ${authorLabel} on ${dictionary.site.name}.`,
    language: locale,
    items,
  });

  return new Response(xml, {
    headers: {
      "Content-Type": FEED_CONTENT_TYPE,
      "Cache-Control": FEED_CACHE_CONTROL,
    },
  });
}
