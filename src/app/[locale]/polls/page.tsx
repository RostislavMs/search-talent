import type { Metadata } from "next";
import FeedFilterBrowser from "@/components/feed-filter-browser";
import { ButtonLink } from "@/components/ui/Button";
import { getCategoryDisplayName, sortArticleCategories } from "@/lib/articles";
import { getPollFeed } from "@/lib/db/polls";
import { isLocale } from "@/lib/i18n/config";
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
  const isUk = safeLocale === "uk";

  return buildMetadata({
    locale: safeLocale,
    pathname: "/polls",
    title: isUk ? "Опитування спільноти" : "Community polls",
    description: isUk
      ? "Інтерактивні опитування та анкети спільноти — голосуйте та діліться думкою."
      : "Interactive community polls and surveys — vote and share your opinion.",
  });
}

export default async function PollsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const isUk = safeLocale === "uk";
  // Default (unfiltered) feed. Listing filters live in client state
  // (see FeedFilterBrowser) rather than URL params, so the SSR'd feed is always
  // the default listing and filtering fetches in place.
  const feed = await getPollFeed({ locale: safeLocale });
  const sortedCategories = sortArticleCategories(feed.categories, safeLocale);
  const categoryOptions = sortedCategories.map((item) => ({
    value: item.slug,
    label: getCategoryDisplayName(item, safeLocale),
  }));

  const ui = isUk
    ? {
        eyebrow: "Голос спільноти",
        title: "Опитування та анкети",
        description:
          "Інтерактивні опитування спільноти: голосуйте, переглядайте результати та діліться думкою. Створіть власне опитування з різними типами питань.",
        createPoll: "Створити опитування",
        filterCategory: "Категорія",
        filterAuthor: "Автор",
        filterSort: "Сортування",
        authorPlaceholder: "Пошук за автором",
        allCategories: "Усі категорії",
        recent: "Нові",
        popular: "Популярні",
        discussed: "Обговорювані",
        apply: "Застосувати",
        reset: "Скинути",
        empty: "Поки що немає опитувань за цими фільтрами.",
      }
    : {
        eyebrow: "Community voice",
        title: "Polls & surveys",
        description:
          "Interactive community polls: vote, see results, and share your opinion. Create your own poll with different question types.",
        createPoll: "Create a poll",
        filterCategory: "Category",
        filterAuthor: "Author",
        filterSort: "Sort",
        authorPlaceholder: "Search by author",
        allCategories: "All categories",
        recent: "Recent",
        popular: "Popular",
        discussed: "Discussed",
        apply: "Apply filters",
        reset: "Reset filters",
        empty: "No polls match these filters yet.",
      };

  return (
    <main className="mx-auto max-w-[90rem] px-0 py-10 sm:px-6">
      <FeedFilterBrowser
        kind="poll"
        locale={safeLocale}
        initialItems={feed.items}
        categoryOptions={categoryOptions}
        ui={{
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
        <div className="p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-[color:var(--brand-strong)]">
            {ui.eyebrow}
          </p>
          <h1 className="font-display mt-4 text-4xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-5xl">
            {ui.title}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 app-muted">{ui.description}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/polls/new" className="w-full sm:w-auto">
              {ui.createPoll}
            </ButtonLink>
          </div>
        </div>
      </FeedFilterBrowser>
    </main>
  );
}
