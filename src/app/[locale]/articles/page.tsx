import type { Metadata } from "next";
import FeedFilterBrowser from "@/components/feed-filter-browser";
import JsonLd from "@/components/json-ld";
import ScrollToTopButton from "@/components/scroll-to-top-button";
import { ButtonLink } from "@/components/ui/Button";
import {
  getCategoryDisplayName,
  isNewsCategorySlug,
  sortArticleCategories,
} from "@/lib/articles";
import { getArticleFeed } from "@/lib/db/articles";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  buildItemListSchema,
  buildMetadata,
  getMetadataBase,
  getSiteUrl,
  toBcp47,
} from "@/lib/seo";

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
    pathname: "/articles",
    title: dict.metadata.articles.title,
    description: dict.metadata.articles.description,
    feeds: [
      {
        url: new URL(
          `/${safeLocale}/articles/feed.xml`,
          getMetadataBase(),
        ).toString(),
        title: `${dict.site.name} — ${dict.metadata.articles.title}`,
      },
    ],
  });
}

export default async function ArticlesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(safeLocale);
  // Default (unfiltered) community feed. Listing filters live in client state
  // (see FeedFilterBrowser), so the page no longer reads URL query params — the
  // SSR'd feed is always the default listing, and filtering fetches in place.
  const feed = await getArticleFeed({ locale: safeLocale });
  // News is its own /news section, so keep it out of the community filter.
  const sortedCategories = sortArticleCategories(
    feed.categories.filter((item) => !isNewsCategorySlug(item.slug)),
    safeLocale,
  );
  const ui = dictionary.articlesPage;
  const categoryOptions = sortedCategories.map((item) => ({
    value: item.slug,
    label: getCategoryDisplayName(item, safeLocale),
  }));

  const siteUrl = getSiteUrl().replace(/\/$/, "");
  const articleListItems = feed.items
    .filter((item) => item.slug)
    .map((item) => ({
      url: `${siteUrl}/${safeLocale}/articles/${item.slug}`,
      name: item.title,
    }));

  return (
    <main className="mx-auto max-w-[90rem] px-0 py-10 sm:px-6">
      {articleListItems.length > 0 && (
        <JsonLd
          data={buildItemListSchema({
            url: `${siteUrl}/${safeLocale}/articles`,
            name: safeLocale === "uk" ? "Статті спільноти" : "Community articles",
            inLanguage: toBcp47(safeLocale),
            items: articleListItems,
          })}
        />
      )}
      <FeedFilterBrowser
        kind="article"
        locale={safeLocale}
        initialItems={feed.items}
        categoryOptions={categoryOptions}
        ui={{
          filterSearch: ui.filterSearch,
          searchPlaceholder: ui.searchPlaceholder,
          filterCategory: ui.filterCategory,
          filterAuthor: ui.filterAuthor,
          filterSort: ui.filterSort,
          authorPlaceholder: ui.authorPlaceholder,
          allCategories: ui.allCategories,
          recent: ui.recent,
          popular: ui.popular,
          discussed: ui.discussed,
          apply: ui.apply,
          reset: ui.reset,
          empty: ui.empty,
        }}
      >
        <div className="p-4 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-orange-400">
            {ui.eyebrow}
          </p>
          <h1 className="font-display mt-2 text-2xl font-medium tracking-tight text-[color:var(--foreground)] sm:mt-4 sm:text-5xl">
            {ui.title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 app-muted sm:mt-5 sm:text-base sm:leading-8">
            {ui.description}
          </p>
          <div className="mt-4 flex flex-wrap gap-3 sm:mt-6">
            <ButtonLink href="/articles/new" className="w-full sm:w-auto">
              {ui.createArticle}
            </ButtonLink>
          </div>
        </div>
      </FeedFilterBrowser>
      <ScrollToTopButton label={dictionary.common.scrollToTop} />
    </main>
  );
}
