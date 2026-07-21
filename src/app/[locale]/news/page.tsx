import type { Metadata } from "next";
import InfiniteCardFeed from "@/components/infinite-card-feed";
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
    <main className="mx-auto max-w-[90rem] px-0 py-10 sm:px-6">
      <section className="rounded-none sm:rounded-hero app-card p-4 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-eyebrow text-orange-400">
          {ui.eyebrow}
        </p>
        <h1 className="font-display mt-2 text-2xl font-medium tracking-tight text-[color:var(--foreground)] sm:mt-4 sm:text-5xl">
          {ui.title}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 app-muted sm:mt-5 sm:text-base sm:leading-8">
          {ui.description}
        </p>
        {viewer.isAdmin ? (
          <div className="mt-4 flex flex-wrap gap-3 sm:mt-6">
            <ButtonLink
              href={`/articles/new?category=${NEWS_CATEGORY_SLUG}`}
              className="w-full sm:w-auto"
            >
              {ui.createNews}
            </ButtonLink>
          </div>
        ) : null}
      </section>

      <section className="mt-8">
        {feed.items.length > 0 ? (
          <InfiniteCardFeed
            kind="article"
            items={feed.items}
            locale={safeLocale}
            section="news"
          />
        ) : (
          <p className="rounded-none sm:rounded-panel app-panel-dashed p-6 text-sm app-muted">
            {ui.empty}
          </p>
        )}
      </section>
    </main>
  );
}
