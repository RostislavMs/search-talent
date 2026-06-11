import { ArticleCardGridSkeleton } from "@/components/skeletons/card-skeletons";
import { HomeHeroSkeleton } from "@/components/skeletons/hero-skeletons";
import Skeleton from "@/components/ui/skeleton";

/**
 * Loading skeleton for the home page (`/`). Mirrors the live page layout —
 * gradient hero, "why" panels, top-rated, "how it works", and latest
 * articles — so the streamed Suspense fallback avoids layout shift.
 */
export default function HomePageSkeleton() {
  return (
    <div role="status" aria-busy="true">
      <HomeHeroSkeleton />
      <HomeBelowHeroSkeleton />
    </div>
  );
}

/**
 * Everything on the home page below the hero. Used as the Suspense fallback
 * for the data-dependent sections while the static hero headline (the LCP
 * element) is already painted in the initial HTML.
 */
export function HomeBelowHeroSkeleton() {
  return (
    <div role="status" aria-busy="true">
      {/* Why */}
      <section className="mt-6 rounded-hero app-card p-5 sm:mt-8 sm:p-7">
        <Skeleton className="h-9 w-2/3 max-w-md rounded" />
        <div className="mt-6 grid gap-4 sm:mt-7 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-3xl app-panel p-5">
              <Skeleton className="h-7 w-10 rounded-full" />
              <div className="mt-4 space-y-2">
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-3 w-4/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Top rated */}
      <section className="mt-6 rounded-hero app-card p-5 sm:mt-10 sm:p-7">
        <Skeleton className="h-9 w-1/2 max-w-sm rounded" />
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-3xl app-panel p-4"
            >
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3 rounded" />
                <Skeleton className="h-3 w-1/3 rounded" />
              </div>
              <Skeleton className="h-6 w-12 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mt-6 rounded-hero app-card p-5 sm:mt-8 sm:p-7">
        <Skeleton className="h-9 w-1/2 max-w-sm rounded" />
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, columnIndex) => (
            <div key={columnIndex} className="rounded-panel app-panel p-4 sm:p-5">
              <Skeleton className="h-5 w-1/2 rounded" />
              <div className="mt-5 space-y-4">
                {Array.from({ length: 3 }).map((_, stepIndex) => (
                  <div
                    key={stepIndex}
                    className="rounded-2xl bg-[color:var(--surface)] p-4"
                  >
                    <Skeleton className="h-3 w-8 rounded" />
                    <Skeleton className="mt-2 h-4 w-2/3 rounded" />
                    <Skeleton className="mt-2 h-3 w-full rounded" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Latest articles */}
      <section className="mt-6 rounded-hero app-card p-5 sm:mt-8 sm:p-7">
        <div className="max-w-3xl space-y-3">
          <Skeleton className="h-9 w-2/3 rounded" />
          <Skeleton className="h-4 w-full rounded" />
        </div>
        <div className="mt-6">
          <ArticleCardGridSkeleton
            count={4}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          />
        </div>
      </section>
    </div>
  );
}
