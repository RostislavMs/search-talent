import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { notFound, redirect } from "next/navigation";
import DeleteProjectButton from "@/components/delete-project-button";

const CreateProjectForm = dynamic(
  () => import("@/components/create-project-form"),
  {
    loading: () => (
      <div className="animate-pulse space-y-4 py-4">
        <div className="h-10 w-1/2 rounded-xl bg-[color:var(--surface-muted)]" />
        <div className="h-48 rounded-xl bg-[color:var(--surface-muted)]" />
      </div>
    ),
  },
);
import { ButtonLink } from "@/components/ui/Button";
import { getMyProjectById } from "@/lib/db/projects";
import { loadCoAuthorsForEditor } from "@/lib/db/co-authors";
import { buildProjectPath } from "@/lib/projects";
import { createLocalePath, isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

async function getRouteParams(
  params: Promise<{ locale: string; id: string }>,
) {
  const { locale, id } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return { locale, id };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale } = await getRouteParams(params);
  const dictionary = getDictionary(locale);

  return buildMetadata({
    locale,
    pathname: "/projects/edit",
    title: dictionary.metadata.dashboardProjectEdit.title,
    description: dictionary.metadata.dashboardProjectEdit.description,
    noindex: true,
  });
}

export default async function ProjectEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await getRouteParams(params);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(createLocalePath(locale, "/login"));
  }

  const dictionary = getDictionary(locale);
  const project = await getMyProjectById(id);

  if (!project) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <section className="rounded-hero app-card p-8">
          <h1 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
            {dictionary.dashboardProjects.projectNotFound}
          </h1>
          <div className="mt-6">
            <ButtonLink href="/projects" variant="ghost">
              {dictionary.dashboardProjects.publicCatalog}
            </ButtonLink>
          </div>
        </section>
      </main>
    );
  }

  const coAuthors = await loadCoAuthorsForEditor(supabase, "project", project.id);
  const publicHref = buildProjectPath(project.id, project.slug || undefined);

  // Get the owner's username to link back to their projects
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("username")
    .eq("user_id", user.id)
    .maybeSingle();

  const backToProjectsHref = ownerProfile?.username
    ? `/u/${ownerProfile.username}/projects`
    : "/projects";

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <section className="rounded-hero app-card p-8 sm:p-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.dashboardProjects.eyebrow}
            </p>
            <h1 className="font-display mt-3 text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
              {dictionary.dashboardProjects.editProject}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 app-muted">
              {dictionary.dashboardProjects.editProjectDescription}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <ButtonLink href={backToProjectsHref} variant="ghost">
              {dictionary.dashboardProjects.backToProjects}
            </ButtonLink>
            <ButtonLink href={publicHref} variant="secondary">
              {dictionary.dashboardProjects.openPublicPage}
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-hero app-card p-6 sm:p-8">
        <CreateProjectForm project={{ ...project, coAuthors }} />
      </section>

      <section className="mt-8 rounded-hero app-card p-6">
        <DeleteProjectButton
          projectId={project.id}
          label={dictionary.dashboardProjects.deleteProject}
          pendingLabel={dictionary.dashboardProjects.deletingProject}
          confirmMessage={dictionary.dashboardProjects.confirmDeleteProject}
          errorFallback={dictionary.dashboardProjects.deleteProjectFailed}
          redirectHref={backToProjectsHref}
          variant="ghost"
        />
      </section>
    </main>
  );
}
