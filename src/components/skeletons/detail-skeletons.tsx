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

/**
 * A run of bars sized to a real `leading-7 sm:leading-8` paragraph, so the
 * block occupies the same height as the copy it stands in for. The generic
 * `ParagraphLines` above uses `h-3` bars, which collapse a 28px line to 12px
 * and make the fallback far shorter than the content that replaces it.
 */
function ProseLines({ lines = 3 }: { lines?: number }) {
  const widths = ["w-full", "w-11/12", "w-full", "w-5/6", "w-2/3"];
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={`h-5 rounded sm:h-6 ${widths[index % widths.length]}`}
        />
      ))}
    </div>
  );
}

/** Mirrors a `DetailCard` (label + value inside an app-panel). */
function DetailCardSkeleton() {
  return (
    <div className="rounded-2xl app-panel p-3 sm:rounded-3xl sm:p-4">
      <Skeleton className="h-3 w-20 rounded-full" />
      <Skeleton className="mt-1 h-5 w-2/3 rounded sm:mt-2 sm:h-6" />
    </div>
  );
}

/**
 * Skeleton for the project detail page (`/projects/[slug]`).
 *
 * Mirrors `src/app/[locale]/projects/[slug]/page.tsx` block for block —
 * including the details grid being 2-up on mobile, the always-present gallery
 * section, the comments panel and the related-projects grid. The page is
 * edge-to-edge on mobile (`px-0`) and square-cornered there (`rounded-none`),
 * so the fallback must be too: an inset, rounded fallback visibly snaps
 * sideways the moment the real page swaps in.
 */
export function ProjectDetailSkeleton() {
  return (
    <main
      className="mx-auto max-w-[90rem] px-0 py-6 sm:px-6 sm:py-10"
      role="status"
      aria-busy="true"
    >
      {/* Hero: text column + cover */}
      <section className="overflow-hidden rounded-none app-card sm:rounded-hero">
        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
          <div className="p-5 sm:p-8 md:p-10">
            {/* Back / share / manage actions */}
            <div className="flex flex-wrap items-center gap-3">
              <Skeleton className="h-8 w-28 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>

            {/* h1 — text-2xl / sm:text-3xl / md:text-4xl */}
            <Skeleton className="mt-4 h-8 w-4/5 rounded sm:mt-6 sm:h-9 md:h-10" />

            <div className="mt-3 max-w-3xl sm:mt-4">
              <ProseLines lines={3} />
            </div>

            {/* Rating pill, bookmark, author chip */}
            <div className="mt-4 flex flex-wrap items-center gap-2 sm:mt-6">
              <Skeleton className="h-8 w-20 rounded-full" />
              <Skeleton className="h-8 w-28 rounded-full" />
              <Skeleton className="h-8 w-44 rounded-full" />
            </div>
          </div>

          <Skeleton className="min-h-[12rem] w-full rounded-none sm:min-h-[18rem]" />
        </div>
      </section>

      {/* Body: main content + sidebar + comments */}
      <section className="mt-5 grid grid-cols-1 gap-5 sm:mt-8 sm:gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5 sm:space-y-8">
          {/* Details: 2-up grid on every breakpoint, then technologies + links */}
          <section className="rounded-none app-card p-4 sm:rounded-hero sm:p-6">
            <Skeleton className="h-8 w-40 rounded" />

            <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <DetailCardSkeleton key={index} />
              ))}
            </div>

            <div className="mt-6">
              <Skeleton className="h-5 w-32 rounded" />
              <div className="mt-3 flex flex-wrap gap-2">
                <Skeleton className="h-8 w-24 rounded-full" />
                <Skeleton className="h-8 w-20 rounded-full" />
                <Skeleton className="h-8 w-28 rounded-full" />
                <Skeleton className="h-8 w-16 rounded-full" />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Skeleton className="h-9 w-32 rounded-full" />
              <Skeleton className="h-9 w-28 rounded-full" />
            </div>
          </section>

          {/* Gallery — rendered for every project, empty state included */}
          <section className="rounded-none app-card p-4 sm:rounded-hero sm:p-6">
            <Skeleton className="h-7 w-32 rounded sm:h-8" />
            <div className="mt-4 grid gap-3 sm:mt-6 sm:grid-cols-2">
              <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
              <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
            </div>
          </section>
        </div>

        <aside className="app-sticky-pane space-y-4 sm:space-y-6 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:self-start xl:row-span-2">
          {/* VoteButtons panel */}
          <section className="rounded-panel app-panel p-4">
            <Skeleton className="h-5 w-28 rounded" />
            <div className="mt-3 flex items-center gap-2">
              <Skeleton className="h-9 w-16 rounded-full" />
              <Skeleton className="h-9 w-16 rounded-full" />
              <Skeleton className="h-9 w-16 rounded-full" />
            </div>
          </section>

          {/* Author card */}
          <section className="rounded-2xl app-card p-4 sm:rounded-hero sm:p-5">
            <Skeleton className="h-4 w-28 rounded" />
            <div className="mt-4 flex items-center gap-3">
              <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-5 w-2/3 rounded" />
                <Skeleton className="h-4 w-1/2 rounded" />
              </div>
            </div>
            <Skeleton className="mt-5 h-9 w-40 rounded-full" />
          </section>
        </aside>

        {/* Comments */}
        <section className="rounded-hero app-card p-5 sm:p-6">
          <Skeleton className="h-7 w-44 rounded" />
          <Skeleton className="mt-4 h-24 w-full rounded-2xl" />
          <div className="mt-6 space-y-5">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="flex gap-3">
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-32 rounded" />
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-4/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>

      {/* Related projects — matches the page's own Suspense fallback */}
      <section className="mt-5 rounded-none app-card p-4 sm:mt-8 sm:rounded-hero sm:p-6">
        <ProjectCardGridSkeleton count={3} />
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
