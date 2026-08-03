import { ArticleCardGridSkeleton } from "@/components/skeletons/card-skeletons";
import Skeleton from "@/components/ui/skeleton";

/**
 * Fallback for `/articles`. Mirrors `FeedFilterBrowser`: edge-to-edge and
 * square-cornered on mobile, where the filter panel is also collapsed behind a
 * pill rather than shown in full — a skeleton that always draws the open panel
 * makes the phone fallback about a screen taller than the page it stands in for.
 */
export default function ArticlesLoading() {
  return (
    <main className="mx-auto max-w-[90rem] px-0 py-10 sm:px-6">
      <section className="relative rounded-none app-card sm:rounded-hero">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
          <div className="space-y-4 p-4 sm:p-8">
            <Skeleton className="h-3 w-32 rounded-full" />
            <Skeleton className="h-8 w-3/4 rounded sm:h-12" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-5/6 rounded" />
            <div className="flex flex-wrap gap-3 pt-2">
              <Skeleton className="h-10 w-full rounded-full sm:w-36" />
            </div>
          </div>

          {/* Collapsed filters pill — mobile only, like the real toggle. */}
          <div className="px-4 sm:px-8 lg:hidden">
            <Skeleton className="h-11 w-full rounded-full" />
          </div>

          <div className="hidden space-y-4 rounded-panel border app-border bg-[color:var(--surface-muted)] p-6 sm:p-8 lg:-my-px lg:-mr-px lg:block lg:rounded-l-panel lg:rounded-r-hero">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-12 w-full rounded-2xl" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <Skeleton className="h-10 w-24 rounded-full" />
              <Skeleton className="h-10 w-24 rounded-full" />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <ArticleCardGridSkeleton variant="masonry" count={9} />
      </section>
    </main>
  );
}
