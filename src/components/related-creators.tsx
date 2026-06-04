import CreatorCard from "@/components/creator-card";
import { getRelatedCreators } from "@/lib/db/public";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { RELATED_ITEMS_LIMIT } from "@/lib/related";

/**
 * "Related creators" section for the public profile page. Async server
 * component so it streams in behind a Suspense boundary without blocking the
 * profile itself. Renders nothing when no public creator is related, keeping
 * the page clean rather than showing an empty shell.
 */
export default async function RelatedCreators({
  profileId,
  skillIds,
  categoryId,
  dictionary,
  limit = RELATED_ITEMS_LIMIT,
}: {
  profileId: string;
  skillIds: number[];
  categoryId: number | null;
  dictionary: Dictionary;
  limit?: number;
}) {
  const related = await getRelatedCreators(
    profileId,
    skillIds,
    categoryId,
    limit,
  );

  if (related.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="related-creators-heading"
      className="mx-auto mt-5 max-w-[90rem] px-4 pb-10 sm:mt-8 sm:px-6"
    >
      <div className="rounded-2xl app-card p-4 sm:rounded-hero sm:p-6">
        <h2
          id="related-creators-heading"
          className="font-display text-xl font-semibold tracking-tight text-[color:var(--foreground)] sm:text-2xl"
        >
          {dictionary.common.relatedCreatorsTitle}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 app-muted">
          {dictionary.common.relatedCreatorsSubtitle}
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {related.map((creator) => (
            <CreatorCard
              key={creator.username}
              creator={creator}
              dictionary={dictionary}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
