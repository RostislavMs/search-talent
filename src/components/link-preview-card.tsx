import Skeleton from "@/components/ui/skeleton";
import type { LinkPreview } from "@/lib/link-preview";

/**
 * The hover card itself — one uniform layout for profiles, projects, articles
 * and polls. The route ships display-ready, already-localized strings (see
 * `db/link-preview`), so this component only lays them out; adding a new
 * preview kind needs no change here.
 *
 * Purely informational: the provider renders it with `pointer-events: none`,
 * so nothing in here is clickable and the underlying link keeps the click.
 */

/** Matches CARD_WIDTH in the provider — the positioner needs it up front. */
const CARD_CLASS = "w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-3xl app-card shadow-xl";

export function LinkPreviewSkeleton({ label }: { label: string }) {
  return (
    <div className={CARD_CLASS} aria-hidden="true" title={label}>
      <div className="flex items-start gap-3 p-3.5">
        <Skeleton className="h-10 w-10 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1 space-y-2 pt-0.5">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-2.5 w-24" />
        </div>
      </div>
    </div>
  );
}

export default function LinkPreviewCard({ preview }: { preview: LinkPreview }) {
  const showCover = preview.imageShape === "cover" && Boolean(preview.imageUrl);
  const showAvatar = preview.imageShape === "avatar" && Boolean(preview.imageUrl);
  const initial = preview.title.trim().slice(0, 1).toUpperCase();

  return (
    <div className={CARD_CLASS}>
      {showCover ? (
        // 16:9 — the ratio most uploaded covers already are, so the crop takes
        // nothing off the top or bottom, and it keeps the card shorter than the
        // 16:10 the grid cards use.
        <div className="relative aspect-video w-full bg-[color:var(--surface-muted)]">
          {/* A native <img> on purpose: the card lives for a second or two, the
              stored cover host varies (R2 / Supabase / YouTube thumbs), and no
              layout here depends on the intrinsic size. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.imageUrl!}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}

      <div className="flex items-start gap-3 p-3.5">
        {showAvatar ? (
          <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-2xl border app-border app-surface-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.imageUrl!}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </span>
        ) : preview.imageShape === "avatar" ? (
          <span className="font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border app-border app-surface-muted text-base font-medium text-[color:var(--foreground)]">
            {initial}
          </span>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-eyebrow app-soft">
                {preview.eyebrow}
              </p>
              <p className="font-display mt-1 line-clamp-2 text-sm font-semibold leading-snug text-[color:var(--foreground)]">
                {preview.title}
              </p>
              {preview.subtitle ? (
                <p className="mt-0.5 truncate text-xs app-muted">
                  {preview.subtitle}
                </p>
              ) : null}
            </div>

            {preview.badge ? (
              <span className="font-display shrink-0 whitespace-nowrap rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand-on-soft">
                {preview.badge}
              </span>
            ) : null}
          </div>

          {preview.description ? (
            // Two lines, not three: a hover card is a glance, and the shorter
            // block is what keeps it from covering the text being read.
            <p className="mt-1.5 line-clamp-2 text-xs leading-5 app-muted">
              {preview.description}
            </p>
          ) : null}

          {preview.chips.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {preview.chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full app-panel px-2 py-0.5 text-[11px] app-muted"
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
