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
        </aside>

        <div className="space-y-8">
          <section className="rounded-hero app-card p-6 sm:p-7">
            <Skeleton className="mb-6 ml-auto hidden h-4 w-20 rounded xl:block" />
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
