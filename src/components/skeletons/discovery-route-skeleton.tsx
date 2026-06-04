import DiscoveryPageSkeleton from "@/components/skeletons/discovery-page-skeleton";
import Skeleton from "@/components/ui/skeleton";
import type { DiscoveryMode } from "@/components/discovery-page";

/** Mirrors a `BrowseFacets` block (title + description + pill links). */
function BrowseFacetsSkeleton({ chips = 12 }: { chips?: number }) {
  return (
    <section className="rounded-hero app-card p-5 sm:p-7">
      <div className="max-w-3xl space-y-3">
        <Skeleton className="h-7 w-1/2 max-w-xs rounded" />
        <Skeleton className="h-4 w-2/3 rounded" />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {Array.from({ length: chips }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-24 rounded-full" />
        ))}
      </div>
    </section>
  );
}

/** Mirrors the `SeoFaqSection` (title + question/answer cards). */
function FaqSkeleton({ count = 4 }: { count?: number }) {
  return (
    <section className="rounded-hero app-card p-5 sm:p-7">
      <Skeleton className="h-7 w-1/2 max-w-xs rounded" />
      <div className="mt-6 grid gap-4">
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="rounded-3xl app-panel p-4 sm:p-5">
            <Skeleton className="h-5 w-3/4 rounded" />
            <div className="mt-3 space-y-2">
              <Skeleton className="h-3 w-full rounded" />
              <Skeleton className="h-3 w-5/6 rounded" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Full-page loading skeleton for the discovery routes.
 *
 * - `full` (default): the `/talents` & `/projects` layout — gradient hero,
 *   filters, results grid, then the two `BrowseFacets` blocks and FAQ.
 * - `facet`: the skill/role/tag/type landing layout — compact app-card hero
 *   plus filters and results grid, with no facet/FAQ blocks below.
 */
export default function DiscoveryRouteSkeleton({
  mode,
  variant = "full",
}: {
  mode: DiscoveryMode;
  variant?: "full" | "facet";
}) {
  return (
    <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 sm:py-10">
      <DiscoveryPageSkeleton
        mode={mode}
        heroVariant={variant === "facet" ? "minimal" : "gradient"}
      />

      {variant === "full" ? (
        <div className="mt-6 space-y-6 sm:mt-8 sm:space-y-8">
          <BrowseFacetsSkeleton />
          <BrowseFacetsSkeleton />
          <FaqSkeleton />
        </div>
      ) : null}
    </main>
  );
}
