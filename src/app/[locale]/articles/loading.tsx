import { ArticleCardGridSkeleton } from "@/components/skeletons/card-skeletons";
import Skeleton from "@/components/ui/skeleton";

export default function ArticlesLoading() {
  return (
    <main className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6">
      <section className="relative rounded-[2.25rem] app-card">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
          <div className="p-6 sm:p-8 space-y-4">
            <Skeleton className="h-3 w-32 rounded-full" />
            <Skeleton className="h-10 w-3/4 rounded" />
            <Skeleton className="h-10 w-1/2 rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-5/6 rounded" />
            <div className="flex flex-wrap gap-3 pt-2">
              <Skeleton className="h-10 w-36 rounded-full" />
              <Skeleton className="h-10 w-36 rounded-full" />
            </div>
          </div>

          <div className="rounded-[1.9rem] border app-border bg-[color:var(--surface-muted)] p-6 sm:p-8 space-y-4 lg:-my-px lg:-mr-px lg:rounded-l-[1.9rem] lg:rounded-r-[2.25rem]">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-12 w-full rounded-[1.25rem]" />
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-12 w-full rounded-[1.25rem]" />
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-12 w-full rounded-[1.25rem]" />
            <div className="flex flex-wrap gap-3 pt-2">
              <Skeleton className="h-10 w-24 rounded-full" />
              <Skeleton className="h-10 w-24 rounded-full" />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <ArticleCardGridSkeleton />
      </section>
    </main>
  );
}
