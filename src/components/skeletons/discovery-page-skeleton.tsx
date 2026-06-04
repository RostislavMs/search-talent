import Skeleton from "@/components/ui/skeleton";
import {
  CreatorCardGridSkeleton,
  ProjectCardGridSkeleton,
} from "@/components/skeletons/card-skeletons";
import {
  DiscoveryHeroSkeleton,
  DiscoveryMinimalHeroSkeleton,
} from "@/components/skeletons/hero-skeletons";
import type { DiscoveryMode } from "@/components/discovery-page";

export default function DiscoveryPageSkeleton({
  mode = "projects",
  heroVariant = "gradient",
}: {
  mode?: DiscoveryMode;
  /**
   * `gradient` matches the marketing hero on `/talents` & `/projects`;
   * `minimal` matches the compact app-card hero on the facet landing pages.
   */
  heroVariant?: "gradient" | "minimal";
}) {
  return (
    <section>
      {heroVariant === "minimal" ? (
        <DiscoveryMinimalHeroSkeleton />
      ) : (
        <DiscoveryHeroSkeleton />
      )}

      <section className="mt-5 grid gap-8 sm:mt-8 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="hidden space-y-4 xl:block">
          <div className="rounded-hero app-card p-5 space-y-4">
            <Skeleton className="h-5 w-24 rounded" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="rounded-hero app-card p-5 space-y-3">
            <Skeleton className="h-3 w-32 rounded" />
            <Skeleton className="h-4 w-full rounded" />
          </div>
        </aside>

        <div className="space-y-8">
          <section className="rounded-hero app-card p-6 sm:p-7">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-3">
                <Skeleton className="h-7 w-40 rounded" />
                <Skeleton className="h-4 w-64 rounded" />
              </div>
              <Skeleton className="h-4 w-20 rounded" />
            </div>
            {mode === "projects" ? (
              <ProjectCardGridSkeleton />
            ) : (
              <CreatorCardGridSkeleton />
            )}
          </section>
        </div>
      </section>
    </section>
  );
}
