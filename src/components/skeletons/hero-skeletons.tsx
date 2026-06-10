/**
 * Loading skeletons for the gradient hero sections.
 *
 * The heroes render on a dark `bg-brand-hero` gradient, so the neutral
 * `Skeleton` component (which paints with `--surface-muted`) would be nearly
 * invisible. These skeletons use white-tinted placeholders instead so the
 * loading state mirrors the real hero exactly and avoids layout shift.
 */
import Skeleton from "@/components/ui/skeleton";

/** White-tinted placeholder bar for use on the dark hero gradient. */
function HeroBar({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={["animate-pulse rounded bg-white/15", className].join(" ")}
    />
  );
}

/** Mirrors the live "top talent / project / article" card in the home hero. */
function HeroLiveCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 sm:p-5">
      <HeroBar className="h-3 w-24 rounded-full" />
      <div className="mt-3 flex items-start gap-3">
        <div
          aria-hidden="true"
          className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-white/15"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <HeroBar className="h-4 w-3/4" />
          <HeroBar className="h-3 w-1/2" />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <HeroBar className="h-6 w-20 rounded-full" />
        <HeroBar className="h-3 w-16" />
      </div>
    </div>
  );
}

/** Skeleton for the home page hero (`/`). */
export function HomeHeroSkeleton() {
  return (
    <section className="bg-brand-hero overflow-hidden rounded-2xl border app-border p-5 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)] sm:rounded-hero sm:p-8 md:p-10">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(15rem,0.65fr)] lg:gap-8">
        <div>
          <HeroBar className="h-4 w-32 rounded-full" />
          <div className="mt-4 space-y-3">
            <HeroBar className="h-9 w-full max-w-3xl sm:h-12" />
            <HeroBar className="h-9 w-4/5 max-w-2xl sm:h-12" />
          </div>
          <div className="mt-4 space-y-2">
            <HeroBar className="h-4 w-full max-w-2xl" />
            <HeroBar className="h-4 w-3/4 max-w-xl" />
          </div>
          <div className="mt-6 flex flex-wrap gap-2 sm:mt-8 sm:gap-3">
            <HeroBar className="h-11 w-40 rounded-full" />
            <HeroBar className="h-11 w-40 rounded-full" />
            <HeroBar className="h-11 w-36 rounded-full" />
          </div>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <HeroBar className="h-3 w-28 rounded-full" />
          {Array.from({ length: 3 }).map((_, index) => (
            <HeroLiveCardSkeleton key={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

/** Skeleton for the discovery hero used by `/talents` and `/projects`. */
export function DiscoveryHeroSkeleton() {
  return (
    <section className="bg-brand-hero rounded-2xl border app-border p-5 text-white shadow-[0_30px_80px_rgba(15,23,42,0.18)] sm:rounded-hero sm:p-8 md:p-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="w-full">
          <HeroBar className="h-4 w-32 rounded-full" />
          <div className="mt-3 space-y-2">
            <HeroBar className="h-7 w-full max-w-3xl sm:h-9" />
            <HeroBar className="h-7 w-2/3 max-w-2xl sm:h-9" />
          </div>
          <div className="mt-4 space-y-2">
            <HeroBar className="h-4 w-full max-w-2xl" />
            <HeroBar className="h-4 w-3/4 max-w-xl" />
          </div>
        </div>
        <HeroBar className="h-10 w-32 shrink-0 rounded-full" />
      </div>

      <div className="mt-5 rounded-2xl bg-white/10 p-3 backdrop-blur sm:mt-8 sm:rounded-panel sm:p-4">
        <div className="flex flex-wrap gap-2">
          <HeroBar className="h-9 w-24 rounded-full" />
          <HeroBar className="h-9 w-24 rounded-full" />
        </div>
        <HeroBar className="mt-3 h-12 w-full rounded-xl sm:mt-4 sm:h-14 sm:rounded-2xl" />
      </div>

      <div className="mt-5 hidden gap-4 sm:mt-8 md:grid md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-3xl border border-white/12 bg-white/10 p-5"
          >
            <HeroBar className="h-4 w-2/3" />
            <div className="mt-3 space-y-2">
              <HeroBar className="h-3 w-full" />
              <HeroBar className="h-3 w-5/6" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Skeleton for the compact, SEO-focused hero used by the facet landing pages
 * (`/talents/skill`, `/talents/role`, `/projects/tag`, `/projects/type`).
 * These render on the light `app-card` surface — not the gradient — so they
 * use the neutral `Skeleton` placeholders and always show the locked-facet
 * pill, which is always present on those pages.
 */
export function DiscoveryMinimalHeroSkeleton() {
  return (
    <section className="rounded-hero app-card p-5 sm:p-7">
      <Skeleton className="h-4 w-24 rounded-full" />
      <Skeleton className="mt-2 h-9 w-2/3 max-w-md rounded sm:h-10" />
      <div className="mt-3 max-w-3xl space-y-2">
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-4/5 rounded" />
      </div>
      <Skeleton className="mt-4 h-7 w-28 rounded-full" />
      <Skeleton className="mt-5 h-12 w-full rounded-2xl" />
    </section>
  );
}
