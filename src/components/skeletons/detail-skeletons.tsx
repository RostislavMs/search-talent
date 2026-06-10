import { ProjectCardGridSkeleton } from "@/components/skeletons/card-skeletons";
import Skeleton from "@/components/ui/skeleton";

/**
 * Loading skeletons for the content detail pages — project (`/projects/[slug]`)
 * and article (`/articles/[slug]`).
 *
 * Without these, Next.js cascades the parent list `loading.tsx` (a grid of
 * cards) onto the detail routes, which flashes a layout that looks nothing
 * like the page being navigated to. These mirror the real detail layouts so
 * the streamed fallback avoids the mismatched flash and layout shift.
 */

/** A run of text-like bars to stand in for a paragraph block. */
function ParagraphLines({ lines = 4 }: { lines?: number }) {
  const widths = ["w-full", "w-11/12", "w-full", "w-5/6", "w-full", "w-2/3"];
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={`h-3 rounded ${widths[index % widths.length]}`}
        />
      ))}
    </div>
  );
}

/** Mirrors a `DetailCard` (label + value inside an app-panel). */
function DetailCardSkeleton() {
  return (
    <div className="rounded-2xl app-panel p-4">
      <Skeleton className="h-3 w-20 rounded-full" />
      <Skeleton className="mt-3 h-4 w-2/3 rounded" />
    </div>
  );
}

/** Skeleton for the project detail page (`/projects/[slug]`). */
export function ProjectDetailSkeleton() {
  return (
    <main
      className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 sm:py-10"
      role="status"
      aria-busy="true"
    >
      {/* Hero: text column + cover */}
      <section className="overflow-hidden rounded-2xl app-card sm:rounded-hero">
        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
          <div className="p-5 sm:p-8 md:p-10">
            <div className="flex flex-wrap items-center gap-3">
              <Skeleton className="h-8 w-32 rounded-full" />
            </div>

            <div className="mt-4 space-y-2 sm:mt-6">
              <Skeleton className="h-8 w-3/4 rounded md:h-10" />
              <Skeleton className="h-8 w-1/2 rounded md:h-10" />
            </div>

            <div className="mt-3 max-w-3xl sm:mt-4">
              <ParagraphLines lines={3} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2 sm:mt-6">
              <Skeleton className="h-8 w-24 rounded-full" />
              <Skeleton className="h-8 w-28 rounded-full" />
              <Skeleton className="h-8 w-32 rounded-full" />
            </div>
          </div>

          <Skeleton className="min-h-[12rem] w-full rounded-none sm:min-h-[18rem]" />
        </div>
      </section>

      {/* Body: main content + sidebar */}
      <section className="mt-5 grid grid-cols-1 gap-5 sm:mt-8 sm:gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5 sm:space-y-8">
          <section className="rounded-2xl app-card p-4 sm:rounded-hero sm:p-6">
            <Skeleton className="h-7 w-40 rounded" />
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <DetailCardSkeleton key={index} />
              ))}
            </div>
          </section>

          <section className="rounded-2xl app-card p-4 sm:rounded-hero sm:p-6">
            <Skeleton className="h-7 w-48 rounded" />
            <div className="mt-6">
              <ParagraphLines lines={5} />
            </div>
          </section>
        </div>

        <aside className="space-y-5 sm:space-y-8">
          <div className="space-y-4 rounded-2xl app-card p-4 sm:rounded-hero sm:p-6">
            <Skeleton className="h-5 w-24 rounded" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
          <div className="space-y-4 rounded-2xl app-card p-4 sm:rounded-hero sm:p-6">
            <Skeleton className="h-5 w-32 rounded" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        </aside>
      </section>
    </main>
  );
}

/** Skeleton for the article detail page (`/articles/[slug]`). */
export function ArticleDetailSkeleton() {
  return (
    <main
      className="mx-auto max-w-6xl px-4 py-10 sm:px-6"
      role="status"
      aria-busy="true"
    >
      <div className="rounded-hero app-card">
        {/* Header */}
        <div className="border-b app-border p-6 sm:p-8">
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-10 w-28 rounded-full" />
          </div>

          <div className="mt-6 space-y-3">
            <Skeleton className="h-9 w-3/4 rounded sm:h-11" />
            <Skeleton className="h-9 w-1/2 rounded sm:h-11" />
          </div>

          <div className="mt-5 space-y-2">
            <Skeleton className="h-5 w-full rounded" />
            <Skeleton className="h-5 w-5/6 rounded" />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 rounded-full" />
              <Skeleton className="h-4 w-28 rounded" />
            </div>
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-4 w-20 rounded" />
            <Skeleton className="h-4 w-28 rounded" />
          </div>
        </div>

        {/* Cover */}
        <Skeleton className="aspect-[16/8] w-full rounded-none" />

        {/* Body */}
        <div className="grid gap-8 p-6 sm:p-8">
          <section className="space-y-6">
            <ParagraphLines lines={4} />
            <Skeleton className="h-6 w-1/2 rounded" />
            <ParagraphLines lines={5} />
            <ParagraphLines lines={3} />
          </section>
        </div>
      </div>
    </main>
  );
}

/** Mirrors a `SectionCard` (title + grid of panel items) on the profile. */
function ProfileSectionSkeleton({
  span,
  items = 4,
}: {
  span: string;
  items?: number;
}) {
  return (
    <div className={`min-w-0 ${span}`}>
      <div className="rounded-2xl app-card p-4 sm:p-6">
        <Skeleton className="h-6 w-40 rounded" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: items }).map((_, index) => (
            <div key={index} className="rounded-2xl app-panel p-3 sm:p-4">
              <Skeleton className="h-4 w-2/3 rounded" />
              <Skeleton className="mt-2 h-3 w-1/2 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Skeleton for the public profile page (`/u/[username]`). */
export function ProfileSkeleton() {
  return (
    <main
      className="mx-auto max-w-[88rem] px-3 py-4 sm:px-6 sm:py-8"
      role="status"
      aria-busy="true"
    >
      <div className="overflow-hidden rounded-hero app-card">
        <div className="p-4 sm:p-6 lg:p-8">
          {/* Hero */}
          <section className="rounded-2xl app-panel p-4 sm:p-6 lg:min-h-[22rem] lg:p-8">
            <div className="grid grid-cols-1 gap-6 sm:gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
              <div>
                <div className="flex items-center gap-3 sm:gap-4">
                  <Skeleton className="h-16 w-16 shrink-0 rounded-2xl sm:h-20 sm:w-20 sm:rounded-3xl" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-3 w-24 rounded-full" />
                    <Skeleton className="h-7 w-48 rounded sm:h-9" />
                  </div>
                </div>
                <Skeleton className="mt-4 h-4 w-28 rounded" />
                <div className="mt-3 space-y-2 sm:mt-4">
                  <Skeleton className="h-3 w-full max-w-md rounded" />
                  <Skeleton className="h-3 w-2/3 rounded" />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-4">
                  <Skeleton className="h-7 w-28 rounded-full" />
                  <Skeleton className="h-7 w-24 rounded-full" />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-4">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-8 w-8 rounded-full" />
                  ))}
                </div>
              </div>

              <div className="space-y-4 xl:self-start">
                <Skeleton className="hidden h-28 w-full rounded-2xl xl:block" />
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-9 w-28 rounded-full" />
                  <Skeleton className="h-9 w-24 rounded-full" />
                  <Skeleton className="h-9 w-16 rounded-full" />
                </div>
              </div>
            </div>
          </section>

          {/* Sections */}
          <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-12">
            <ProfileSectionSkeleton span="lg:col-span-12" items={2} />
            <ProfileSectionSkeleton span="lg:col-span-6" items={4} />
            <ProfileSectionSkeleton span="lg:col-span-6" items={4} />
            <ProfileSectionSkeleton span="lg:col-span-8" items={6} />
            <ProfileSectionSkeleton span="lg:col-span-4" items={2} />
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * Skeleton for the profile sub-tabs (`/u/[username]/articles` and
 * `/u/[username]/projects`). These are header + card-grid lists, so without
 * their own boundary they would inherit the profile-page `ProfileSkeleton`
 * (hero + sections) — a mismatch. Mirrors the shared tab header and grid.
 */
export function ProfileTabSkeleton({
  mode,
}: {
  mode: "articles" | "projects";
}) {
  return (
    <main
      className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 sm:py-10"
      role="status"
      aria-busy="true"
    >
      <section className="rounded-hero app-card p-5 sm:p-8 md:p-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <Skeleton className="h-3 w-28 rounded-full" />
            <Skeleton className="h-8 w-64 rounded" />
            <Skeleton className="h-4 w-full max-w-md rounded" />
          </div>
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-10 w-32 rounded-full" />
            <Skeleton className="h-10 w-28 rounded-full" />
            <Skeleton className="h-10 w-28 rounded-full" />
          </div>
        </div>
      </section>

      <section className="mt-6 sm:mt-8">
        {mode === "projects" ? (
          <ProjectCardGridSkeleton />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-3 rounded-panel app-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <Skeleton className="h-6 w-2/3 rounded" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-3 w-5/6 rounded" />
                <div className="flex flex-wrap gap-2 pt-1">
                  <Skeleton className="h-8 w-20 rounded-full" />
                  <Skeleton className="h-8 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
