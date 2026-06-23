import type { Metadata } from "next";
import ArticleCard from "@/components/article-card";
import { ButtonLink } from "@/components/ui/Button";
import { NEWS_CATEGORY_SLUG } from "@/lib/articles";
import { getArticleFeed } from "@/lib/db/articles";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dict = getDictionary(safeLocale);

  return buildMetadata({
    locale: safeLocale,
    pathname: "/news",
    title: dict.metadata.news.title,
    description: dict.metadata.news.description,
  });
}

export default async function NewsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(safeLocale);
  const ui = dictionary.newsPage;
  const [feed, viewer] = await Promise.all([
    getArticleFeed({
      categorySlug: NEWS_CATEGORY_SLUG,
      sort: "recent",
      locale: safeLocale,
    }),
    getCurrentViewerRole(),
  ]);

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6">
      <section className="rounded-hero app-card p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-eyebrow text-orange-400">
          {ui.eyebrow}
        </p>
        <h1 className="font-display mt-4 text-4xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-5xl">
          {ui.title}
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-8 app-muted">
          {ui.description}
        </p>
        {viewer.isAdmin ? (
          <div className="mt-6">
            <ButtonLink href={`/articles/new?category=${NEWS_CATEGORY_SLUG}`}>
              {ui.createNews}
            </ButtonLink>
          </div>
        ) : null}
      </section>

      <section className="mt-8">
        {feed.items.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {feed.items.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                locale={safeLocale}
                section="news"
              />
            ))}
          </div>
        ) : (
          <p className="rounded-panel app-panel-dashed p-6 text-sm app-muted">
            {ui.empty}
          </p>
        )}
      </section>
    </main>
  );
}
