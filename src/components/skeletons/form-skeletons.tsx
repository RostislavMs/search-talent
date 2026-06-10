import Skeleton from "@/components/ui/skeleton";

/**
 * Loading skeletons for the create/edit form pages — project form
 * (`/projects/new`, `/projects/edit/[id]`) and the article composer
 * (`/articles/new`, `/articles/edit/[id]`).
 *
 * Without these, Next.js cascades the parent list `loading.tsx` (a grid of
 * cards) onto the form routes, flashing a layout that looks nothing like a
 * form. These mirror the real form layouts so the streamed fallback matches
 * the page being navigated to.
 */

/** A label + input pair. */
function FieldSkeleton({ input = "h-11" }: { input?: string }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3 w-24 rounded-full" />
      <Skeleton className={`w-full rounded-xl ${input}`} />
    </div>
  );
}

/** Skeleton for the single-column project create/edit form. */
export function ProjectFormSkeleton() {
  return (
    <main
      className="mx-auto max-w-6xl px-4 py-10 sm:px-6"
      role="status"
      aria-busy="true"
    >
      <section className="rounded-hero app-card p-8 sm:p-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <Skeleton className="h-3 w-28 rounded-full" />
            <Skeleton className="h-8 w-56 rounded" />
          </div>
          <Skeleton className="h-10 w-36 rounded-full" />
        </div>

        <div className="mt-8 space-y-5">
          <FieldSkeleton />
          <FieldSkeleton input="h-28" />
          <div className="grid gap-5 sm:grid-cols-2">
            <FieldSkeleton />
            <FieldSkeleton />
          </div>
          <FieldSkeleton input="h-40" />
          <div className="flex flex-wrap gap-3 pt-2">
            <Skeleton className="h-11 w-32 rounded-full" />
            <Skeleton className="h-11 w-28 rounded-full" />
          </div>
        </div>
      </section>
    </main>
  );
}

/** Skeleton for the two-column article composer (editor + publish settings). */
export function ArticleComposerSkeleton() {
  return (
    <main
      className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6"
      role="status"
      aria-busy="true"
    >
      <section className="rounded-hero app-card p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <Skeleton className="h-9 w-48 rounded sm:h-10" />
            <Skeleton className="hidden h-4 w-80 rounded xl:block" />
          </div>
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-10 w-28 rounded-full" />
            <Skeleton className="h-10 w-28 rounded-full" />
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
          {/* Editor canvas */}
          <div className="order-2 rounded-hero app-card p-5 xl:order-1">
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-8 w-8 rounded-lg" />
              ))}
            </div>
            <Skeleton className="mt-5 h-10 w-3/4 rounded" />
            <Skeleton className="mt-5 h-[28rem] w-full rounded-xl" />
          </div>

          {/* Publish settings */}
          <div className="order-1 space-y-5 rounded-hero app-card p-5 xl:order-2">
            <FieldSkeleton />
            <FieldSkeleton input="h-24" />
            <FieldSkeleton />
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-full" />
          </div>
        </div>
      </section>
    </main>
  );
}
