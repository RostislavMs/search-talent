import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DeleteProjectButton from "@/components/delete-project-button";
import ProjectCard from "@/components/project-card";
import { ButtonLink } from "@/components/ui/Button";
import OptimizedImage from "@/components/ui/optimized-image";
import { getMyProjectsPage } from "@/lib/db/projects";
import { getUserProjectsPage } from "@/lib/db/public";
import { normalizeModerationStatus } from "@/lib/moderation";
import { buildProjectPath } from "@/lib/projects";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getRouteParams(
  params: Promise<{ locale: string; username: string }>,
) {
  const { locale, username } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return { locale, username };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; username: string }>;
}): Promise<Metadata> {
  const { locale, username } = await getRouteParams(params);
  const dictionary = getDictionary(locale);

  return buildMetadata({
    locale,
    pathname: `/u/${username}/projects`,
    title: `${dictionary.creatorProfile.projects} — @${username}`,
    description: dictionary.metadata.creatorProfile.description,
  });
}

function formatDate(value: string | null, locale: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", {
    dateStyle: "medium",
  }).format(date);
}

function formatModerationBadge(status: string | null, locale: string) {
  switch (normalizeModerationStatus(status)) {
    case "under_review":
      return locale === "uk" ? "На перевірці" : "Under review";
    case "restricted":
      return locale === "uk" ? "Обмежено" : "Restricted";
    case "removed":
      return locale === "uk" ? "Прибрано" : "Removed";
    default:
      return locale === "uk" ? "Публічний" : "Public";
  }
}

export default async function UserProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; username: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, username } = await getRouteParams(params);
  const dictionary = getDictionary(locale);
  const { page } = await searchParams;
  const requestedPage = Number.parseInt(page || "1", 10);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Check if the current user owns this profile
  let isOwner = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("user_id", user.id)
      .maybeSingle();

    isOwner = profile?.username === username;
  }

  if (isOwner) {
    return renderOwnerView({ locale, username, page: requestedPage, dictionary });
  }

  return renderPublicView({ locale, username, page: requestedPage, dictionary });
}

async function renderOwnerView({
  locale,
  username,
  page,
  dictionary,
}: {
  locale: string;
  username: string;
  page: number;
  dictionary: ReturnType<typeof getDictionary>;
}) {
  const result = await getMyProjectsPage({
    page: Number.isFinite(page) ? page : 1,
    perPage: 9,
  });

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6">
      <section className="rounded-[2.25rem] app-card p-8 sm:p-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] app-soft">
              {dictionary.dashboardProjects.eyebrow}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[color:var(--foreground)]">
              {dictionary.dashboardProjects.title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 app-muted">
              {dictionary.dashboardProjects.description}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/projects/new">
              {dictionary.forms.createProject}
            </ButtonLink>
            <ButtonLink href={`/u/${username}`} variant="ghost">
              {dictionary.creatorProfile.backToProfile}
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-[2rem] app-card p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-[color:var(--foreground)]">
              {dictionary.dashboardProjects.title}
            </h2>
            <p className="mt-2 text-sm app-muted">
              {dictionary.dashboardProjects.showingResults} {result.projects.length} /{" "}
              {result.totalCount}
            </p>
          </div>
        </div>

        {result.projects.length > 0 ? (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {result.projects.map((project) => {
                const publicHref = buildProjectPath(project.id, project.slug || undefined);

                return (
                  <article key={project.id} className="rounded-[1.75rem] app-panel p-5">
                    <div className="relative aspect-[16/10] overflow-hidden rounded-[1.25rem] bg-[color:var(--surface-muted)]">
                      {project.cover_url ? (
                        <OptimizedImage
                          src={project.cover_url}
                          alt={project.title}
                          fill
                          sizePreset="card"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-end bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.14),_transparent_45%),linear-gradient(135deg,_rgba(148,163,184,0.28),_rgba(255,255,255,0.8))] p-4">
                          <span className="rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
                            {dictionary.dashboardProjects.preview}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-semibold text-[color:var(--foreground)]">
                          {project.title}
                        </h3>
                        <p className="mt-2 text-sm app-muted">
                          {dictionary.dashboardProjects.createdOn}:{" "}
                          {formatDate(project.created_at, locale) || "\u2014"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {project.status === "draft" && (
                          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600">
                            {dictionary.forms.draftBadge}
                          </span>
                        )}
                        <span className="rounded-full border app-border px-3 py-1 text-xs font-medium app-soft">
                          {formatModerationBadge(project.moderation_status, locale)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <ButtonLink href={`/projects/edit/${project.id}`} size="sm">
                        {dictionary.dashboardProjects.editProject}
                      </ButtonLink>
                      <ButtonLink href={publicHref} variant="secondary" size="sm">
                        {dictionary.dashboardProjects.openPublicPage}
                      </ButtonLink>
                    </div>

                    <div className="mt-3">
                      <DeleteProjectButton
                        projectId={project.id}
                        label={dictionary.dashboardProjects.deleteProject}
                        pendingLabel={dictionary.dashboardProjects.deletingProject}
                        confirmMessage={dictionary.dashboardProjects.confirmDeleteProject}
                        errorFallback={dictionary.dashboardProjects.deleteProjectFailed}
                      />
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm app-muted">
                {dictionary.dashboardProjects.pageLabel} {result.currentPage} /{" "}
                {result.totalPages}
              </span>

              <div className="flex gap-3">
                {result.currentPage > 1 && (
                  <ButtonLink
                    href={`/u/${username}/projects?page=${result.currentPage - 1}`}
                    variant="ghost"
                    size="sm"
                  >
                    {dictionary.dashboardProjects.previousPage}
                  </ButtonLink>
                )}

                {result.currentPage < result.totalPages && (
                  <ButtonLink
                    href={`/u/${username}/projects?page=${result.currentPage + 1}`}
                    variant="secondary"
                    size="sm"
                  >
                    {dictionary.dashboardProjects.nextPage}
                  </ButtonLink>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="mt-6 rounded-[1.75rem] app-panel-dashed p-6">
            <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
              {dictionary.dashboardProjects.emptyTitle}
            </h2>
            <p className="mt-2 text-sm leading-7 app-muted">
              {dictionary.dashboardProjects.emptyDescription}
            </p>
            <div className="mt-4">
              <ButtonLink href="/projects/new" size="sm">
                {dictionary.forms.createProject}
              </ButtonLink>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

async function renderPublicView({
  locale,
  username,
  page,
  dictionary,
}: {
  locale: string;
  username: string;
  page: number;
  dictionary: ReturnType<typeof getDictionary>;
}) {
  const result = await getUserProjectsPage(username, {
    page: Number.isFinite(page) ? page : 1,
    perPage: 12,
  });

  if (!result) {
    notFound();
  }

  const displayName =
    result.profile.name || `@${result.profile.username}` || username;

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6">
      <section className="rounded-[2.25rem] app-card p-8 sm:p-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] app-soft">
              {dictionary.creatorProfile.projects}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[color:var(--foreground)]">
              {displayName}
            </h1>
            <p className="mt-2 text-sm app-muted">
              {dictionary.creatorProfile.publishedWork} — {result.totalCount}{" "}
              {dictionary.common.projects.toLowerCase()}
            </p>
          </div>

          <ButtonLink href={`/u/${username}`} variant="ghost">
            {dictionary.creatorProfile.backToProfile}
          </ButtonLink>
        </div>
      </section>

      <section className="mt-8">
        {result.projects.length > 0 ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {result.projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  dictionary={dictionary}
                  project={{
                    ...project,
                    slug: project.slug || "",
                    ownerName: result.profile.name,
                    ownerUsername: result.profile.username,
                  }}
                />
              ))}
            </div>

            {result.totalPages > 1 && (
              <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm app-muted">
                  {dictionary.dashboardProjects.pageLabel} {result.currentPage} /{" "}
                  {result.totalPages}
                </span>

                <div className="flex gap-3">
                  {result.currentPage > 1 && (
                    <ButtonLink
                      href={`/u/${username}/projects?page=${result.currentPage - 1}`}
                      variant="ghost"
                      size="sm"
                    >
                      {dictionary.dashboardProjects.previousPage}
                    </ButtonLink>
                  )}

                  {result.currentPage < result.totalPages && (
                    <ButtonLink
                      href={`/u/${username}/projects?page=${result.currentPage + 1}`}
                      variant="secondary"
                      size="sm"
                    >
                      {dictionary.dashboardProjects.nextPage}
                    </ButtonLink>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-[1.75rem] app-card p-6">
            <p className="text-sm app-muted">
              {dictionary.creatorProfile.noProjects}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
