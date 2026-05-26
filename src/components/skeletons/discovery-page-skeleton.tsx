import Skeleton from "@/components/ui/skeleton";
import {
  CreatorCardGridSkeleton,
  ProjectCardGridSkeleton,
} from "@/components/skeletons/card-skeletons";
import type { DiscoveryMode } from "@/components/discovery-page";

export default function DiscoveryPageSkeleton({
  mode = "projects",
}: {
  mode?: DiscoveryMode;
}) {
  return (
    <section>
      <section className="rounded-2xl border app-border bg-[color:var(--surface-muted)] p-5 sm:rounded-hero sm:p-8 md:p-10">
        <div className="space-y-3">
          <Skeleton className="h-3 w-32 rounded-full" />
          <Skeleton className="h-8 w-3/4 rounded" />
          <Skeleton className="h-4 w-2/3 rounded" />
        </div>
        <div className="mt-6 rounded-2xl bg-[color:var(--surface)]/40 p-3 sm:rounded-panel sm:p-4">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-12 w-full rounded-xl sm:h-14 sm:rounded-2xl" />
        </div>
      </section>

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
