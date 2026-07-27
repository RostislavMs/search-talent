import ArticleCard from "@/components/article-card";
import type { ArticleFeedItem } from "@/lib/articles";

/**
 * "Recommended articles" strip shown at the foot of an article detail page.
 * Renders nothing when there are no relevant pieces to suggest, so the caller
 * can pass an empty list without guarding. Uses the same ArticleCard + 3-up
 * grid as the community listing so the block reads as part of the same site.
 */
export default function ArticleRelated({
  articles,
  locale,
  title,
}: {
  articles: ArticleFeedItem[];
  locale: string;
  title: string;
}) {
  if (articles.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="related-articles-heading"
      className="mt-8 rounded-none app-card p-6 sm:rounded-hero sm:p-8"
    >
      <h2
        id="related-articles-heading"
        className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-3xl"
      >
        {title}
      </h2>
      <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} locale={locale} />
        ))}
      </div>
    </section>
  );
}
