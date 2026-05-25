import type { Dictionary } from "@/lib/i18n/dictionaries";
import LocalizedLink from "@/components/ui/localized-link";
import { buttonStyles } from "@/components/ui/button-styles";
import OptimizedImage from "@/components/ui/optimized-image";
import { buildProjectPath } from "@/lib/projects";

type ProjectCardData = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  ownerName?: string | null;
  ownerUsername?: string | null;
  score?: number | null;
  cover_url?: string | null;
  is_pinned?: boolean | null;
};

export default function ProjectCard({
  dictionary,
  project,
}: {
  dictionary: Dictionary;
  project: ProjectCardData;
}) {
  const ownerLabel = project.ownerName || project.ownerUsername;
  const scoreLabel =
    typeof project.score === "number"
      ? `${project.score} ${dictionary.common.scoreSuffix}`
      : dictionary.common.fresh;

  return (
    <LocalizedLink
      href={buildProjectPath(project.id, project.slug)}
      className="group block overflow-hidden rounded-3xl app-card transition hover:-translate-y-0.5 hover:border-[color:var(--foreground)] hover:shadow-xl"
    >
      <div className="relative aspect-[16/10] bg-[color:var(--surface-muted)]">
        {project.is_pinned && (
          <span
            aria-label={dictionary.common.pinned}
            title={dictionary.common.pinned}
            className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-[color:var(--foreground)] px-3 py-1 text-xs font-semibold text-[color:var(--background)] shadow-md"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3" aria-hidden="true">
              <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.134a2.97 2.97 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z" />
            </svg>
            {dictionary.common.pinned}
          </span>
        )}
        {project.cover_url ? (
          <OptimizedImage
            src={project.cover_url}
            alt={project.title}
            fill
            sizePreset="card"
            className="object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-end bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.14),_transparent_45%),linear-gradient(135deg,_rgba(148,163,184,0.28),_rgba(255,255,255,0.8))] p-5">
            <span className="rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
              {dictionary.common.project}
            </span>
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] app-soft">
              {dictionary.common.project}
            </p>
            <h3 className="mt-2 break-words text-lg font-semibold text-[color:var(--foreground)]">
              {project.title}
            </h3>
          </div>

          <span className="shrink-0 whitespace-nowrap rounded-full app-panel px-3 py-1 text-xs font-medium app-muted">
            {scoreLabel}
          </span>
        </div>

        {project.description && (
          <p className="mt-4 line-clamp-3 text-sm leading-6 app-muted">
            {project.description}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-sm app-muted">
            {ownerLabel
              ? `${dictionary.common.by} ${ownerLabel}`
              : dictionary.common.viewProject}
          </p>

          <span className={buttonStyles({ variant: "ghost", size: "sm" })}>
            {dictionary.common.viewProject}
          </span>
        </div>
      </div>
    </LocalizedLink>
  );
}
