import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BookmarkButton from "@/components/bookmark-button";
import OptimizedImage from "@/components/ui/optimized-image";
import ProjectComments from "@/components/project-comments";
import ProjectGallery from "@/components/project-gallery";
import VoteButtons from "@/components/vote-buttons";
import AdminContentQuickActions from "@/components/admin-content-quick-actions";
import { ButtonLink } from "@/components/ui/Button";
import { getPublicProjectPageData } from "@/lib/db/public";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  buildProjectSchema,
  buildBreadcrumbSchema,
  buildProjectPageMetadata,
  getMetadataBase,
} from "@/lib/seo";

async function getRouteParams(
  params: Promise<{ locale: string; slug: string }>,
) {
  const { locale, slug } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return {
    locale: locale as Locale,
    slug,
  };
}

function getStatusLabel(
  status: string | null,
  dictionary: ReturnType<typeof getDictionary>,
) {
  switch (status) {
    case "planning":
      return dictionary.projectPage.planning;
    case "in_progress":
      return dictionary.projectPage.inProgress;
    case "completed":
      return dictionary.projectPage.completed;
    case "on_hold":
      return dictionary.projectPage.onHold;
    default:
      return null;
  }
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

function DetailCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.5rem] app-panel p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] app-soft">
        {label}
      </p>
      <p className="mt-2 text-sm leading-7 text-[color:var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await getRouteParams(params);
  const data = await getPublicProjectPageData(slug);

  const descriptionText = [
    data?.project.description,
    data?.project.problem,
    data?.project.solution,
    data?.project.results,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");
  const wordCount = descriptionText
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
  const isThin = !data || wordCount < 150;

  return buildProjectPageMetadata({
    locale,
    pathname: `/projects/${slug}`,
    projectTitle: data?.project.title || null,
    topTechnologies: data?.technologies.map((technology) => technology.name) || [],
    authorName: data?.owner?.name || data?.owner?.username || null,
    category: data?.project.role || null,
    descriptionText,
    noindex: isThin,
  });
}

export default async function PublicProjectPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await getRouteParams(params);
  const dictionary = getDictionary(locale);
  const [data, viewer] = await Promise.all([
    getPublicProjectPageData(slug),
    getCurrentViewerRole(),
  ]);

  if (!data) {
    notFound();
  }

  const {
    owner,
    project,
    technologies,
    media,
    voteSummary,
    isAuthenticated,
    isOwner,
    isBookmarked,
  } = data;
  const isAdmin = viewer.isAdmin;
  const statusLabel = getStatusLabel(project.project_status, dictionary);

  const siteUrl = getMetadataBase().toString().replace(/\/$/, "");
  const projectUrl = `${siteUrl}/${locale}/projects/${slug}`;

  const projectSchema = buildProjectSchema({
    title: project.title,
    description: project.description,
    url: projectUrl,
    imageUrl: project.cover_url,
    authorName: owner?.name || owner?.username || null,
    authorUrl: owner?.username ? `${siteUrl}/${locale}/u/${owner.username}` : null,
    technologies: technologies.map((technology) => technology.name),
    dateCreated: project.created_at,
    dateModified: project.completed_on || null,
    demoUrl: project.project_url || null,
    codeRepository: project.repository_url || null,
  });

  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: dictionary.nav.home, url: `${siteUrl}/${locale}` },
    { name: dictionary.nav.projects, url: `${siteUrl}/${locale}/projects` },
    { name: project.title, url: projectUrl },
  ]);

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 sm:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(projectSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <section className="overflow-hidden rounded-2xl app-card sm:rounded-[2.25rem]">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
          <div className="p-5 sm:p-8 md:p-10">
            <div className="flex flex-wrap items-center gap-3">
              <ButtonLink href="/projects" variant="ghost" size="sm">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="mr-1 h-3.5 w-3.5" aria-hidden="true"><path fillRule="evenodd" d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" /></svg>
                {dictionary.projectPage.backToProjects}
              </ButtonLink>
              {owner?.username && (
                <ButtonLink href={`/u/${owner.username}`} variant="secondary" size="sm">
                  {dictionary.projectPage.viewCreator}: {owner.name || owner.username}
                </ButtonLink>
              )}
              {isOwner && (
                <ButtonLink href={`/projects/edit/${project.id}`} size="sm">
                  {dictionary.projectPage.manageProject}
                </ButtonLink>
              )}
              {!isOwner && isAdmin && (
                <AdminContentQuickActions
                  targetType="project"
                  targetId={project.id}
                  currentStatus={project.moderation_status}
                  locale={locale}
                  redirectAfterDelete="/projects"
                />
              )}
            </div>

            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[color:var(--foreground)] sm:mt-6 sm:text-3xl md:text-4xl">
              {project.title}
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 app-muted sm:mt-4 sm:text-base sm:leading-8">
              {project.description || dictionary.projectPage.noDescription}
            </p>

            <div className="mt-4 flex flex-wrap gap-2 sm:mt-6">
              <span className="rounded-full app-panel px-3 py-1 text-sm app-muted">
                {voteSummary.score} {dictionary.common.scoreSuffix}
              </span>
              {statusLabel && (
                <span className="rounded-full app-panel px-3 py-1 text-sm app-muted">
                  {statusLabel}
                </span>
              )}
              {owner && (
                <span className="rounded-full app-panel px-3 py-1 text-sm app-muted">
                  {dictionary.projectPage.createdBy}:{" "}
                  {owner.name || owner.username || dictionary.projectPage.creatorFallback}
                </span>
              )}
            </div>
          </div>

          <div className="relative min-h-[12rem] bg-[color:var(--surface-muted)] sm:min-h-[18rem]">
            {project.cover_url ? (
              <OptimizedImage
                src={project.cover_url}
                alt={project.title}
                fill
                sizePreset="cover"
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex h-full items-end bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.14),_transparent_45%),linear-gradient(135deg,_rgba(148,163,184,0.28),_rgba(255,255,255,0.8))] p-6">
                <span className="rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
                  {dictionary.common.project}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 sm:mt-8 sm:gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5 sm:space-y-8">
          <section className="rounded-2xl app-card p-4 sm:rounded-[2rem] sm:p-6">
            <h2 className="text-2xl font-semibold text-[color:var(--foreground)]">
              {dictionary.projectPage.details}
            </h2>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {statusLabel && (
                <DetailCard label={dictionary.projectPage.status} value={statusLabel} />
              )}
              {project.role && (
                <DetailCard label={dictionary.projectPage.role} value={project.role} />
              )}
              {typeof project.team_size === "number" && (
                <DetailCard
                  label={dictionary.projectPage.teamSize}
                  value={String(project.team_size)}
                />
              )}
              {(project.started_on || project.completed_on) && (
                <DetailCard
                  label={dictionary.projectPage.timeline}
                  value={[
                    formatDate(project.started_on, locale)
                      ? `${dictionary.projectPage.startedOn}: ${formatDate(project.started_on, locale)}`
                      : null,
                    formatDate(project.completed_on, locale)
                      ? `${dictionary.projectPage.completedOn}: ${formatDate(project.completed_on, locale)}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" / ")}
                />
              )}
            </div>

            {technologies.length > 0 && (
              <div className="mt-6">
                <h3 className="text-base font-semibold text-[color:var(--foreground)]">
                  {dictionary.projectPage.technologies}
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {technologies.map((technology) => (
                    <span
                      key={technology.id}
                      className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)]"
                    >
                      {technology.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(project.project_url || project.repository_url) && (
              <div className="mt-6 flex flex-wrap gap-3">
                {project.project_url && (
                  <a
                    href={project.project_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border app-border px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
                  >
                    {dictionary.projectPage.liveProject}
                  </a>
                )}
                {project.repository_url && (
                  <a
                    href={project.repository_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border app-border px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
                  >
                    {dictionary.projectPage.repository}
                  </a>
                )}
              </div>
            )}
          </section>

          {(project.problem || project.solution || project.results) && (
            <section className="grid gap-4 lg:grid-cols-3">
              {project.problem && (
                <article className="rounded-2xl app-card p-4 sm:rounded-[2rem] sm:p-6">
                  <h2 className="text-lg font-semibold text-[color:var(--foreground)] sm:text-xl">
                    {dictionary.projectPage.problem}
                  </h2>
                  <p className="mt-3 text-sm leading-7 app-muted sm:mt-4">{project.problem}</p>
                </article>
              )}
              {project.solution && (
                <article className="rounded-2xl app-card p-4 sm:rounded-[2rem] sm:p-6">
                  <h2 className="text-lg font-semibold text-[color:var(--foreground)] sm:text-xl">
                    {dictionary.projectPage.solution}
                  </h2>
                  <p className="mt-3 text-sm leading-7 app-muted sm:mt-4">{project.solution}</p>
                </article>
              )}
              {project.results && (
                <article className="rounded-2xl app-card p-4 sm:rounded-[2rem] sm:p-6">
                  <h2 className="text-lg font-semibold text-[color:var(--foreground)] sm:text-xl">
                    {dictionary.projectPage.results}
                  </h2>
                  <p className="mt-3 text-sm leading-7 app-muted sm:mt-4">{project.results}</p>
                </article>
              )}
            </section>
          )}

          <section className="rounded-2xl app-card p-4 sm:rounded-[2rem] sm:p-6">
            <h2 className="text-xl font-semibold text-[color:var(--foreground)] sm:text-2xl">
              {dictionary.projectPage.gallery}
            </h2>
            <div className="mt-4 sm:mt-6">
              <ProjectGallery media={media} />
            </div>
          </section>

          <ProjectComments
            projectId={project.id}
            isAuthenticated={isAuthenticated}
          />
        </div>

        <aside className="space-y-4 sm:space-y-6 xl:sticky xl:top-24 xl:self-start">
          <VoteButtons
            projectId={project.id}
            initialVote={voteSummary.currentVote}
            initialLikes={voteSummary.likes}
            initialDislikes={voteSummary.dislikes}
            isAuthenticated={isAuthenticated}
          />

          <BookmarkButton
            targetType="project"
            targetId={project.id}
            initialBookmarked={isBookmarked}
            isAuthenticated={isAuthenticated}
          />

          {owner && (
            <section className="rounded-2xl app-card p-4 sm:rounded-[2rem] sm:p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] app-soft">
                {dictionary.projectPage.createdBy}
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full app-panel text-lg font-semibold text-[color:var(--foreground)]">
                  {owner.avatarUrl ? (
                    <OptimizedImage
                      src={owner.avatarUrl}
                      alt={owner.name || owner.username || dictionary.projectPage.creatorFallback}
                      fill
                      sizePreset="avatar"
                      className="object-cover"
                    />
                  ) : (
                    <span>
                      {(owner.name || owner.username || dictionary.projectPage.creatorFallback)
                        .slice(0, 1)
                        .toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="truncate font-semibold text-[color:var(--foreground)]">
                    {owner.name || owner.username || dictionary.projectPage.creatorFallback}
                  </p>
                  {owner.headline && (
                    <p className="truncate text-sm app-muted">{owner.headline}</p>
                  )}
                  {(owner.city || owner.countryName) && (
                    <p className="truncate text-sm app-muted">
                      {[owner.city, owner.countryName].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
              </div>

              {owner.username && (
                <div className="mt-5">
                  <ButtonLink href={`/u/${owner.username}`} variant="secondary" size="sm">
                    {locale === "uk"
                      ? `Портфоліо ${owner.name || owner.username}`
                      : `Portfolio of ${owner.name || owner.username}`}
                  </ButtonLink>
                </div>
              )}
            </section>
          )}
        </aside>
      </section>
    </main>
  );
}
