import ProjectCard from "@/components/project-card";
import { loadViewerAffinity } from "@/lib/db/affinity";
import { getRelatedProjects } from "@/lib/db/public";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { hasUsableAffinity } from "@/lib/personalization";
import { RELATED_ITEMS_LIMIT } from "@/lib/related";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/current-user";

/**
 * "Related projects" section for the project detail page. Async server
 * component so it streams in behind a Suspense boundary without blocking the
 * main content.
 *
 * Recommendations are ranked on IDF-weighted stack similarity, format, quality
 * and freshness (see `src/lib/recommendations.ts`), with a bounded personal
 * term for signed-in visitors. Renders nothing only when the recommender comes
 * back empty — with the fallback tiers that now means the platform genuinely
 * has nothing else public to show.
 */
export default async function RelatedProjects({
  projectId,
  skillIds,
  kind,
  ownerUserId,
  dictionary,
  limit = RELATED_ITEMS_LIMIT,
}: {
  projectId: string;
  skillIds: number[];
  kind?: string | null;
  ownerUserId?: string | null;
  dictionary: Dictionary;
  limit?: number;
}) {
  const user = await getCurrentUser();
  const viewer = user
    ? await loadViewerAffinity(await createClient(), user.id)
    : null;

  const related = await getRelatedProjects(
    { projectId, skillIds, kind, ownerUserId },
    limit,
    hasUsableAffinity(viewer) ? viewer : null,
  );

  if (related.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="related-projects-heading"
      className="mt-5 rounded-2xl app-card p-4 sm:mt-8 sm:rounded-hero sm:p-6"
    >
      <h2
        id="related-projects-heading"
        className="font-display text-xl font-semibold tracking-tight text-[color:var(--foreground)] sm:text-2xl"
      >
        {dictionary.projectPage.relatedTitle}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-7 app-muted">
        {dictionary.projectPage.relatedSubtitle}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {related.map((project) => (
          <ProjectCard
            key={project.id}
            dictionary={dictionary}
            project={project}
          />
        ))}
      </div>
    </section>
  );
}
