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

export function ArticleCardSkeleton() {
  return (
    <div className="block overflow-hidden rounded-3xl app-card">
      <Skeleton className="aspect-[16/9] w-full rounded-none" />
      <div className="p-5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>

        <Skeleton className="mt-4 h-6 w-11/12 rounded" />
        <Skeleton className="mt-2 h-6 w-3/4 rounded" />

        <div className="mt-4 space-y-2">
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-5/6 rounded" />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3 rounded" />
            <Skeleton className="h-3 w-1/4 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

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

export function ArticleCardGridSkeleton({
  count = 6,
  className = "grid gap-6 md:grid-cols-2 xl:grid-cols-3",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div role="status" aria-busy="true" className={className}>
      {Array.from({ length: count }).map((_, index) => (
        <ArticleCardSkeleton key={index} />
      ))}
    </div>
  );
}
