import ProjectCard from "@/components/project-card";
import { getRelatedProjects } from "@/lib/db/public";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { RELATED_ITEMS_LIMIT } from "@/lib/related";

/**
 * "Related projects" section for the project detail page. Async server
 * component so it streams in behind a Suspense boundary without blocking the
 * main content. Renders nothing when no public project shares a technology,
 * keeping the page clean rather than showing an empty shell.
 */
export default async function RelatedProjects({
  projectId,
  skillIds,
  dictionary,
  limit = RELATED_ITEMS_LIMIT,
}: {
  projectId: string;
  skillIds: number[];
  dictionary: Dictionary;
  limit?: number;
}) {
  const related = await getRelatedProjects(projectId, skillIds, limit);

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
