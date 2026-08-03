import Skeleton from "@/components/ui/skeleton";

export function ProjectCardSkeleton() {
  return (
    <div className="block overflow-hidden rounded-3xl app-card">
      <Skeleton className="aspect-[16/10] w-full rounded-none" />
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <Skeleton className="h-3 w-20 rounded-full" />
            <Skeleton className="mt-3 h-5 w-3/4 rounded" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>

        <div className="mt-4 space-y-2">
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-11/12 rounded" />
          <Skeleton className="h-3 w-2/3 rounded" />
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <Skeleton className="h-3 w-32 rounded" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function CreatorCardSkeleton() {
  return (
    <div className="block rounded-3xl app-card p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3 rounded" />
          <Skeleton className="h-3 w-1/2 rounded" />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-4/5 rounded" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>

      <div className="mt-6 flex justify-end">
        <Skeleton className="h-8 w-28 rounded-full" />
      </div>
    </div>
  );
}

/**
 * Mirrors `ArticleCard`. A cover is optional on the real card — text-only
 * articles render title + excerpt straight after the meta line — so the
 * fallback takes the same shape instead of always drawing a 16/9 block that
 * half the feed doesn't have. Title and excerpt line counts vary for the same
 * reason: the real cards are not all one height.
 */
export function ArticleCardSkeleton({
  withCover = true,
  titleLines = 2,
  excerptLines = 2,
}: {
  withCover?: boolean;
  titleLines?: number;
  excerptLines?: number;
}) {
  return (
    <div className="block overflow-hidden rounded-hero app-card">
      {withCover && <Skeleton className="aspect-video w-full rounded-none" />}
      <div className="p-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-16 rounded-full" />
          <Skeleton className="h-3 w-24 rounded-full" />
        </div>

        <div className="mt-3 space-y-2">
          {Array.from({ length: titleLines }).map((_, index) => (
            <Skeleton
              key={index}
              className={`h-7 rounded ${index === titleLines - 1 ? "w-3/5" : "w-11/12"}`}
            />
          ))}
        </div>

        <div className="mt-3 space-y-2">
          {Array.from({ length: excerptLines }).map((_, index) => (
            <Skeleton
              key={index}
              className={`h-5 rounded ${index === excerptLines - 1 ? "w-5/6" : "w-full"}`}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center gap-2 border-t app-border pt-4">
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-3 w-28 rounded" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>

        <div className="mt-3 flex items-center gap-4">
          <Skeleton className="h-4 w-10 rounded" />
          <Skeleton className="h-4 w-10 rounded" />
          <Skeleton className="h-4 w-10 rounded" />
        </div>
      </div>
    </div>
  );
}

/**
 * Cover / length mix for a listing fallback, walked in order so the server and
 * client render the same shapes (no hydration mismatch, unlike randomising).
 *
 * Seven entries on purpose: the count must not divide into the column count, or
 * the same shape lands in the same column on every row — a six-shape cycle over
 * three columns put every short card in the middle one, which read as a broken
 * grid rather than a mixed feed. Text-only cards also carry a longer title,
 * since without a cover that is what fills the card, keeping the height spread
 * closer to the real feed's.
 */
const ARTICLE_SKELETON_SHAPES = [
  { withCover: true, titleLines: 2, excerptLines: 2 },
  { withCover: false, titleLines: 3, excerptLines: 2 },
  { withCover: true, titleLines: 1, excerptLines: 2 },
  { withCover: true, titleLines: 3, excerptLines: 2 },
  { withCover: false, titleLines: 2, excerptLines: 2 },
  { withCover: true, titleLines: 2, excerptLines: 1 },
  { withCover: true, titleLines: 1, excerptLines: 2 },
];

export function ProjectCardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-busy="true"
      className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3"
    >
      {Array.from({ length: count }).map((_, index) => (
        <ProjectCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function CreatorCardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-busy="true"
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
    >
      {Array.from({ length: count }).map((_, index) => (
        <CreatorCardSkeleton key={index} />
      ))}
    </div>
  );
}

/**
 * `variant="masonry"` mirrors the article listing feed: mixed cover/no-cover
 * cards at their own heights. `variant="grid"` is the plain stretched row used
 * where the real cards are symmetric (the homepage 4-up strip), so it keeps
 * every card the same shape.
 *
 * The masonry here is CSS multi-column — the same idiom as the photo-filtered
 * project grid in `DiscoveryPage` — not the feed's `MasonryGrid`. A
 * `loading.tsx` fallback is streamed and thrown away without ever hydrating, so
 * a JS-measured layout never engages and the cards would sit in a ragged grid
 * with a void under every short one. Multi-column balances the columns with no
 * JS at all, and its column-major fill order (which is why the real feed can't
 * use it — that would scramble a recency-sorted listing) is a non-issue for
 * placeholder bars.
 */
export function ArticleCardGridSkeleton({
  count = 6,
  className = "grid gap-6 md:grid-cols-2 xl:grid-cols-3",
  variant = "grid",
}: {
  count?: number;
  className?: string;
  variant?: "grid" | "masonry";
}) {
  if (variant === "masonry") {
    return (
      <div
        role="status"
        aria-busy="true"
        className="gap-6 [column-fill:balance] columns-1 md:columns-2 xl:columns-3"
      >
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="mb-6 break-inside-avoid">
            <ArticleCardSkeleton
              {...ARTICLE_SKELETON_SHAPES[index % ARTICLE_SKELETON_SHAPES.length]}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div role="status" aria-busy="true" className={className}>
      {Array.from({ length: count }).map((_, index) => (
        <ArticleCardSkeleton key={index} />
      ))}
    </div>
  );
}
