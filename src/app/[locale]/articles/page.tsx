import type { Metadata } from "next";
import ArticleCard from "@/components/article-card";
import { ButtonLink } from "@/components/ui/Button";
import FormSelect from "@/components/ui/form-select";
import { getCategoryDisplayName, sortArticleCategories } from "@/lib/articles";
import { getArticleFeed } from "@/lib/db/articles";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata, getMetadataBase } from "@/lib/seo";

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
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    category?: string;
    author?: string;
    sort?: string;
  }>;
}) {
  const { locale } = await params;
  const { category, author, sort } = await searchParams;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(safeLocale);
  const feed = await getArticleFeed({
    categorySlug: category || null,
    authorQuery: author || null,
    sort: sort || null,
    locale: safeLocale,
  });
  const sortedCategories = sortArticleCategories(feed.categories, safeLocale);
  const ui = dictionary.articlesPage;

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6">
      <section className="relative rounded-hero app-card">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
          <div className="p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-orange-400">
              {ui.eyebrow}
            </p>
            <h1 className="font-display mt-4 text-4xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-5xl">
              {ui.title}
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 app-muted">
              {ui.description}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/articles/new" className="w-full sm:w-auto">
                {ui.createArticle}
              </ButtonLink>
            </div>
          </div>

          <div className="bg-brand-hero rounded-panel border app-border p-6 text-white shadow-[0_22px_70px_rgba(15,23,42,0.18)] sm:p-8 lg:-my-px lg:-mr-px lg:rounded-l-panel lg:rounded-r-hero">
            <form className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-white/78">
                  {ui.filterCategory}
                </label>
                <FormSelect
                  name="category"
                  value={category || ""}
                  placeholder={ui.allCategories}
                  className="w-full"
                  triggerClassName="w-full border-white/12 bg-white/96 text-slate-900 shadow-[0_12px_30px_rgba(15,23,42,0.14)]"
                  dropdownClassName="bg-white text-slate-900"
                  options={sortedCategories.map((item) => ({
                    value: item.slug,
                    label: getCategoryDisplayName(item, safeLocale),
                  }))}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/78">
                  {ui.filterAuthor}
                </label>
                <input
                  name="author"
                  defaultValue={author || ""}
                  placeholder={ui.authorPlaceholder}
                  className="w-full rounded-2xl border border-white/12 bg-white/96 p-3 text-slate-900 placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/78">
                  {ui.filterSort}
                </label>
                <FormSelect
                  name="sort"
                  value={sort || "recent"}
                  className="w-full"
                  triggerClassName="w-full border-white/12 bg-white/96 text-slate-900 shadow-[0_12px_30px_rgba(15,23,42,0.14)]"
                  dropdownClassName="bg-white text-slate-900"
                  options={[
                    { value: "recent", label: ui.recent },
                    { value: "popular", label: ui.popular },
                    { value: "discussed", label: ui.discussed },
                  ]}
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="cursor-pointer rounded-full bg-white px-5 py-2.5 text-sm font-medium text-slate-950 shadow-sm transition hover:bg-white/90"
                >
                  {ui.apply}
                </button>
                <ButtonLink
                  href="/articles"
                  variant="secondary"
                  className="border-white/16 bg-white/10 text-white hover:bg-white/16 hover:text-white"
                >
                  {ui.reset}
                </ButtonLink>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section className="mt-8">
        {feed.items.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {feed.items.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                locale={safeLocale}
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
