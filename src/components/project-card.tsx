import type { Dictionary } from "@/lib/i18n/dictionaries";
import LocalizedLink from "@/components/ui/localized-link";
import { buttonStyles } from "@/components/ui/button-styles";
import OptimizedImage from "@/components/ui/optimized-image";
import {
  buildProjectPath,
  getProjectKindLabel,
  normalizeProjectKind,
} from "@/lib/projects";
import { formatScore } from "@/lib/plural";
import { toPlainText } from "@/lib/plain-text";

type ProjectCardData = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  ownerName?: string | null;
  ownerUsername?: string | null;
  /** Display names of accepted co-authors (excludes the owner). */
  coAuthorNames?: string[] | null;
  score?: number | null;
  cover_url?: string | null;
  is_pinned?: boolean | null;
  kind?: string | null;
};

export default function ProjectCard({
  dictionary,
  project,
  hideOwner = false,
  variant = "grid",
  priority = false,
}: {
  dictionary: Dictionary;
  project: ProjectCardData;
  hideOwner?: boolean;
  /**
   * Eager-load this card's cover and mark it `fetchpriority="high"`. Set on the
   * first card of a listing only — it is the LCP element there, and leaving it
   * lazy delays discovery until after hydration.
   */
  priority?: boolean;
  /**
   * `grid` (default): consistent 16:10 cover, image `object-cover`. Use in
   *   uniform grids (lists, related, dashboards) where visual rhythm matters.
   * `masonry`: image keeps its natural aspect, `object-contain`, no crop.
   *   Pair with a CSS `columns` container so cards of different heights
   *   stack into the shortest column with no gaps.
   * `featured`: one wide card for the author's pinned project — the cover on
   *   the left, wider than the text, and a longer description on the right
   *   from `md` up; stacks like `grid` on phones.
   * `gallery`: the cover is the card — 4:3, with only the title and score
   *   under it. For profiles that show visual work.
   * `galleryFeatured`: the same, one wide card on top of a gallery.
   * `case`: cover beside a longer description once the card itself is wide
   *   enough (a container query, so a narrow block keeps it stacked).
   */
  variant?: "grid" | "masonry" | "featured" | "gallery" | "galleryFeatured" | "case";
}) {
  if (variant === "gallery" || variant === "galleryFeatured") {
    return (
      <ProjectGalleryCard
        dictionary={dictionary}
        project={project}
        wide={variant === "galleryFeatured"}
        priority={priority}
      />
    );
  }

  const ownerLabel = project.ownerName || project.ownerUsername;
  const showOwner = !hideOwner && Boolean(ownerLabel);
  const coAuthorNames = (project.coAuthorNames ?? []).filter(Boolean);
  const extraAuthors = coAuthorNames.length;
  const scoreLabel =
    typeof project.score === "number"
      ? formatScore(project.score, dictionary.common)
      : dictionary.common.fresh;
  const kind = normalizeProjectKind(project.kind);
  const kindLabel = kind ? getProjectKindLabel(kind, dictionary) : null;

  const isMasonry = variant === "masonry";
  const isFeatured = variant === "featured";
  const isCase = variant === "case";
  const coverWrapperClass = isMasonry
    ? "relative w-full bg-[color:var(--surface-muted)]"
    : isFeatured
      ? "relative aspect-[16/10] bg-[color:var(--surface-muted)] md:aspect-auto md:min-h-[18rem]"
      : isCase
        ? "relative aspect-[16/10] bg-[color:var(--surface-muted)] @lg:aspect-auto @lg:min-h-[13rem]"
        : "relative aspect-[16/10] bg-[color:var(--surface-muted)]";

  const content = (
    <>
      <div className={coverWrapperClass}>
        {project.is_pinned && (
          <span
            aria-label={dictionary.common.pinned}
            title={dictionary.common.pinned}
            className="absolute left-3 top-3 z-20 inline-flex items-center gap-1 rounded-full bg-[color:var(--foreground)] px-3 py-1 text-xs font-semibold text-[color:var(--background)] shadow-md"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3" aria-hidden="true">
              <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.134a2.97 2.97 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z" />
            </svg>
            {dictionary.common.pinned}
          </span>
        )}
        {project.cover_url ? (
          isMasonry ? (
            // Masonry needs the natural aspect ratio of each cover so cards
            // slot into the shortest column with no empty space. A plain
            // <img> auto-sizes from its content; R2 URLs already bypass the
            // Next.js Image optimizer (see OptimizedImage), so we lose
            // nothing by going native here.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={project.cover_url}
              alt={project.title}
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : undefined}
              className="block h-auto w-full object-contain transition duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <OptimizedImage
              src={project.cover_url}
              alt={project.title}
              fill
              sizePreset={isFeatured ? "banner" : "card"}
              priority={priority}
              className="object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          )
        ) : (
          <div
            className={`flex items-end bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.14),_transparent_45%),linear-gradient(135deg,_rgba(148,163,184,0.28),_rgba(255,255,255,0.8))] p-5 ${
              isMasonry ? "aspect-[16/10] w-full" : "h-full"
            }`}
          >
            <span className="rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
              {dictionary.common.project}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        {/* The score shares the kind's row, so the title below gets the
            card's full width instead of wrapping beside the pill. */}
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-eyebrow app-soft">
            {kindLabel || dictionary.common.project}
          </p>
          <span className="font-display shrink-0 whitespace-nowrap rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-on-soft">
            {scoreLabel}
          </span>
        </div>
        <h3 className="font-display mt-2 break-words text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
          {project.title}
        </h3>
        {showOwner && (
          <p className="mt-1.5 truncate text-xs app-soft">
            {dictionary.common.by}{" "}
            <span className="font-medium app-muted">{ownerLabel}</span>
            {extraAuthors > 0 && (
              <span className="font-medium app-muted">
                , {coAuthorNames[0]}
                {extraAuthors > 1 ? ` +${extraAuthors - 1}` : ""}
              </span>
            )}
          </p>
        )}

        {project.description && (
          <p
            className={`mt-4 text-sm leading-6 app-muted ${
              isFeatured ? "line-clamp-6" : isCase ? "line-clamp-5" : "line-clamp-3"
            }`}
          >
            {toPlainText(project.description)}
          </p>
        )}

        <div className="mt-auto flex justify-end pt-6">
          <span className={buttonStyles({ variant: "ghost", size: "sm" })}>
            {dictionary.common.viewProject}
          </span>
        </div>
      </div>
    </>
  );

  return (
    <LocalizedLink
      href={buildProjectPath(project.id, project.slug)}
      className={`group h-full overflow-hidden rounded-3xl app-card transition hover:-translate-y-0.5 hover:border-[color:var(--foreground)] hover:shadow-xl ${
        isFeatured
          ? "flex flex-col md:grid md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
          : isCase
            ? "@container block"
            : "flex flex-col"
      }`}
    >
      {isCase ? (
        // The card is the container, so a case laid out in a narrow block
        // stays stacked even on a wide screen.
        <div className="flex h-full flex-col @lg:grid @lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {content}
        </div>
      ) : (
        content
      )}
    </LocalizedLink>
  );
}

/** The `gallery` variants: the cover is the card, the title sits under it. */
function ProjectGalleryCard({
  dictionary,
  project,
  wide,
  priority,
}: {
  dictionary: Dictionary;
  project: ProjectCardData;
  wide: boolean;
  priority: boolean;
}) {
  const scoreLabel =
    typeof project.score === "number"
      ? formatScore(project.score, dictionary.common)
      : dictionary.common.fresh;

  return (
    <LocalizedLink
      href={buildProjectPath(project.id, project.slug)}
      className="group flex h-full flex-col overflow-hidden rounded-2xl app-card transition hover:-translate-y-0.5 hover:border-[color:var(--foreground)] hover:shadow-xl sm:rounded-3xl"
    >
      <div
        className={`relative bg-[color:var(--surface-muted)] ${
          wide ? "aspect-[4/3] sm:aspect-[21/9]" : "aspect-[4/3]"
        }`}
      >
        {project.is_pinned && (
          <span
            title={dictionary.common.pinned}
            className="absolute left-2.5 top-2.5 z-20 rounded-full bg-[color:var(--foreground)] px-2.5 py-0.5 text-[11px] font-semibold text-[color:var(--background)] shadow-md"
          >
            {dictionary.common.pinned}
          </span>
        )}
        {project.cover_url ? (
          <OptimizedImage
            src={project.cover_url}
            alt={project.title}
            fill
            sizePreset={wide ? "banner" : "card"}
            priority={priority}
            className="object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center">
            <span className="font-display line-clamp-3 text-lg font-semibold tracking-tight app-muted">
              {project.title}
            </span>
          </div>
        )}
      </div>
      {/* Two to a row on a phone leaves no room beside the title, so the
          score goes under it there. */}
      <div className="flex flex-col gap-0.5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:px-4 sm:py-3">
        <h3 className="font-display min-w-0 truncate text-sm font-semibold tracking-tight text-[color:var(--foreground)] sm:text-base">
          {project.title}
        </h3>
        <span className="font-display shrink-0 whitespace-nowrap text-xs font-semibold app-muted">
          {scoreLabel}
        </span>
      </div>
    </LocalizedLink>
  );
}
