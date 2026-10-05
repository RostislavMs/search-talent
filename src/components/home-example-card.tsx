import type { CSSProperties } from "react";
import "@/app/profile-fonts.css";
import LocalizedLink from "@/components/ui/localized-link";
import OptimizedImage from "@/components/ui/optimized-image";
import type { HeroExamplePortfolio } from "@/lib/home-example";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { withAlpha } from "@/lib/profile-presentation";
import { getProjectKindLabel } from "@/lib/projects";
import { getSiteUrl } from "@/lib/seo";
import { hostFromUrl } from "@/lib/view-tracking";

const LABEL = "text-xs font-semibold uppercase tracking-eyebrow text-white/55";

/**
 * The home hero's right column: a miniature of a real profile page, framed as a
 * browser window with its address, in the author's own colours, font and
 * background. It mirrors the page's structure — hero with the author, then the
 * projects section — so a visitor sees what they would build, not a summary of
 * it. The whole window is one link to the profile; nothing inside it is a
 * separate control.
 */
export default function HomeExampleCard({
  example,
  dictionary,
}: {
  example: HeroExamplePortfolio | null;
  dictionary: Dictionary;
}) {
  const copy = dictionary.home.example;

  if (!example) {
    return (
      <article className="rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur sm:p-5">
        <p className={LABEL}>{copy.label}</p>
        <p className="mt-2.5 text-sm leading-6 text-white/70">{copy.fallback}</p>
      </article>
    );
  }

  const { theme } = example;
  const displayName = example.name || example.username;
  const host = hostFromUrl(getSiteUrl()) ?? "searchtalent.dev";

  return (
    <div>
      <p className={LABEL}>{copy.label}</p>

      <LocalizedLink
        href={`/u/${example.username}`}
        className="group mt-3 block overflow-hidden rounded-2xl border border-white/15 shadow-[0_24px_60px_rgba(2,6,23,0.45)] transition hover:-translate-y-0.5 hover:border-white/35"
      >
        {/* Browser chrome: the address is the link the author shares. */}
        <div className="flex items-center gap-3 border-b border-white/10 bg-black/55 px-3 py-2">
          <span className="flex shrink-0 gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
          </span>
          <span className="min-w-0 flex-1 truncate rounded-full bg-white/10 px-3 py-1 text-center text-[11px] text-white/75">
            {host}/u/{example.username}
          </span>
        </div>

        <div
          className="p-2.5 sm:p-3"
          style={
            {
              backgroundColor: theme.surface,
              color: theme.text,
              fontFamily: theme.fontFamily,
              "--font-body": theme.fontFamily,
              ...(theme.headingFontFamily
                ? { "--font-display": theme.headingFontFamily }
                : {}),
            } as CSSProperties
          }
        >
          {/* Profile hero */}
          <div
            className="relative overflow-hidden rounded-xl p-3 sm:p-3.5"
            style={{
              background: theme.heroBackground,
              border: `1px solid ${withAlpha(theme.accent, 0.5)}`,
            }}
          >
            {theme.heroImageUrl ? (
              <OptimizedImage
                src={theme.heroImageUrl}
                alt=""
                fill
                sizes="26rem"
                className="object-cover"
              />
            ) : null}
            {theme.heroOverlay ? (
              <div className="absolute inset-0" style={{ background: theme.heroOverlay }} />
            ) : null}

            <div className="relative flex items-center gap-3">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 text-sm font-semibold">
                {example.avatarUrl ? (
                  <OptimizedImage
                    src={example.avatarUrl}
                    alt=""
                    fill
                    sizes="44px"
                    className="object-cover"
                  />
                ) : (
                  <span aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                {example.categoryName ? (
                  <p
                    className="truncate text-[9px] font-semibold uppercase tracking-eyebrow"
                    style={{ color: theme.muted }}
                  >
                    {example.categoryName}
                  </p>
                ) : null}
                <p className="font-display truncate text-lg font-semibold leading-tight">
                  {displayName}
                </p>
                <p className="truncate text-[11px]" style={{ color: theme.muted }}>
                  @{example.username}
                </p>
              </div>
              <span
                className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                style={{ backgroundColor: withAlpha(theme.accent, 0.35), color: theme.text }}
              >
                {example.rating} {dictionary.home.leaderboardScore}
              </span>
            </div>
            {example.headline ? (
              <p className="relative mt-2 truncate text-[11px]" style={{ color: theme.muted }}>
                {example.headline}
              </p>
            ) : null}
          </div>

          {/* Projects section */}
          {example.covers.length > 0 ? (
            <div className="mt-2.5 rounded-xl p-2.5 sm:p-3" style={theme.sectionCard}>
              <span
                className="block h-0.5 w-6 rounded-full"
                style={{ backgroundColor: theme.accent }}
                aria-hidden="true"
              />
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <p className="font-display text-sm font-semibold">
                  {dictionary.creatorProfile.projects}
                </p>
                <span className="text-[10px]" style={{ color: theme.muted }}>
                  {example.projectCount}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5 sm:gap-2">
                {example.covers.map((cover) => (
                  <div
                    key={cover.id}
                    className="overflow-hidden rounded-lg"
                    style={{ border: `1px solid ${withAlpha(theme.accent, 0.35)}` }}
                  >
                    <div className="relative aspect-4/3 bg-white/5">
                      <OptimizedImage
                        src={cover.coverUrl}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 8rem, 30vw"
                        className="object-cover"
                      />
                    </div>
                    <div className="px-1.5 py-1">
                      {cover.kind ? (
                        <p
                          className="truncate text-[8px] font-semibold uppercase tracking-eyebrow"
                          style={{ color: theme.muted }}
                        >
                          {/* "Відео / монтаж" → "Відео": the full label does
                              not fit a thumbnail-sized card. */}
                          {getProjectKindLabel(cover.kind, dictionary).split("/")[0].trim()}
                        </p>
                      ) : null}
                      <p className="font-display truncate text-[10px] font-semibold">
                        {cover.title}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <span className="sr-only">
          {copy.cta}: {displayName}
        </span>
      </LocalizedLink>

      <p className="mt-2.5 text-xs text-white/60">{copy.customNote}</p>
    </div>
  );
}
