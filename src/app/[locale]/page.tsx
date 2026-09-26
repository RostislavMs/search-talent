import type { Metadata } from "next";
import { Suspense } from "react";
import ArticleCard from "@/components/article-card";
import HomeTopRated from "@/components/home-top-rated";
import SeoFaqSection from "@/components/seo-faq-section";
import { HomeBelowHeroSkeleton } from "@/components/skeletons/home-page-skeleton";
import { HeroLiveCardSkeleton } from "@/components/skeletons/hero-skeletons";
import { ButtonLink } from "@/components/ui/Button";
import LocalizedLink from "@/components/ui/localized-link";
import OptimizedImage from "@/components/ui/optimized-image";
import RotatingWord from "@/components/ui/rotating-word";
import { formatArticleDate } from "@/lib/articles";
import { getLatestArticles, getLatestProject } from "@/lib/db/marketing";
import {
  getLeaderboards,
  type LeaderboardsResult,
  type RankedCreator,
} from "@/lib/db/leaderboards";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import { getMarketingContent } from "@/lib/marketing-content";
import { beat } from "@/lib/motion";
import { buildProjectPath } from "@/lib/projects";
import { getCurrentUser } from "@/lib/supabase/current-user";
import {
  buildMetadata,
  buildOrganizationSchema,
  buildWebSiteSchema,
  safeJsonLd,
} from "@/lib/seo";
import { notFound } from "next/navigation";

async function getLocaleValue(params: Promise<{ locale: string }>) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return locale;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = await getLocaleValue(params);
  const dictionary = getDictionary(locale);

  return buildMetadata({
    locale,
    pathname: "/",
    title: dictionary.metadata.home.title,
    description: dictionary.metadata.home.description,
  });
}

/**
 * Background tones for the three hero cards, ordered top → bottom so the stack
 * fades from a darker card at the top to a lighter one at the bottom. `hover`
 * is only applied to the interactive live cards, never the static fallbacks.
 */
type HeroCardTone = { base: string; hover: string };

const HERO_CARD_TONES: readonly HeroCardTone[] = [
  { base: "bg-black/45", hover: "hover:bg-black/55" },
  { base: "bg-black/30", hover: "hover:bg-black/40" },
  { base: "bg-black/20", hover: "hover:bg-black/30" },
];

type HeroLiveCardProps = {
  href: string;
  label: string;
  primary: string;
  secondary?: string;
  meta?: string;
  cta: string;
  avatarUrl?: string | null;
  avatarLabel?: string;
  tone: HeroCardTone;
};

function HeroLiveCard({
  href,
  label,
  primary,
  secondary,
  meta,
  cta,
  avatarUrl,
  avatarLabel,
  tone,
}: HeroLiveCardProps) {
  return (
    <LocalizedLink
      href={href}
      className={`group block rounded-2xl border border-white/10 ${tone.base} p-3.5 backdrop-blur transition hover:border-white/25 ${tone.hover} sm:p-4.5`}
    >
      {/*
        Two rows, not three: the rating/date badge shares the eyebrow row and the
        CTA collapses into a single arrow. That trims ~38px per card, which is
        what keeps the whole hero short enough for the next section heading to
        stay in view. The CTA copy survives as the link's accessible label.
      */}
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-semibold uppercase tracking-eyebrow text-white/55">
          {label}
        </p>
        {meta ? (
          <span className="font-display shrink-0 rounded-full bg-white/12 px-3 py-0.5 text-xs font-semibold text-white">
            {meta}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-center gap-3">
        {avatarLabel ? (
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/10 text-sm font-semibold text-white">
            {avatarUrl ? (
              <OptimizedImage
                src={avatarUrl}
                alt={avatarLabel}
                fill
                sizes="44px"
                className="object-cover"
              />
            ) : (
              <span>{avatarLabel.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="font-display truncate text-sm font-semibold text-white sm:text-base">
            {primary}
          </p>
          {secondary ? (
            <p className="mt-0.5 truncate text-xs text-white/65">{secondary}</p>
          ) : null}
        </div>
        <span
          aria-hidden="true"
          className="shrink-0 text-sm text-white/55 transition duration-200 group-hover:translate-x-0.5 group-hover:text-white"
        >
          →
        </span>
      </div>
      <span className="sr-only">{cta}</span>
    </LocalizedLink>
  );
}

/**
 * The portfolio the hero holds up as an example: the best all-time creator who
 * passed the leaderboard thresholds, or — while nobody qualifies yet — the
 * newest portfolio with published work. Chosen automatically so the example
 * keeps up with the platform instead of pointing at a hand-picked profile.
 */
function pickExamplePortfolio(
  leaderboards: LeaderboardsResult,
): RankedCreator | null {
  return leaderboards.creators.all[0] ?? leaderboards.freshCreators?.[0] ?? null;
}

const HERO_SECONDARY_LINK_CLASS =
  "group inline-flex w-full items-center justify-center gap-1.5 rounded-full px-5 py-3 text-base font-medium text-white/75 transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:w-auto";

function HeroSecondaryLink({ href, label }: { href: string; label: string }) {
  return (
    <LocalizedLink href={href} className={HERO_SECONDARY_LINK_CLASS}>
      {label}
      <span
        aria-hidden="true"
        className="inline-block transition-transform duration-200 group-hover:translate-x-1"
      >
        →
      </span>
    </LocalizedLink>
  );
}

/**
 * "See an example" for guests. The label never changes, so the fallback
 * (browse talents) swaps for the real profile link without moving anything.
 */
async function HeroExampleLink({ dictionary }: { dictionary: Dictionary }) {
  const example = pickExamplePortfolio(await getLeaderboards());

  return (
    <HeroSecondaryLink
      href={example ? `/u/${example.username}` : "/talents"}
      label={dictionary.home.ctaSeeExample}
    />
  );
}

function HeroFallbackCard({
  label,
  text,
  tone,
}: {
  label: string;
  text: string;
  tone: HeroCardTone;
}) {
  return (
    <article
      className={`rounded-2xl border border-white/10 ${tone.base} p-3.5 backdrop-blur sm:p-4.5`}
    >
      <p className="text-xs font-semibold uppercase tracking-eyebrow text-white/55">
        {label}
      </p>
      <p className="mt-2.5 text-sm leading-6 text-white/70">{text}</p>
    </article>
  );
}

export default async function LocalizedHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = (await getLocaleValue(params)) as Locale;
  const dictionary = getDictionary(locale);
  const isSignedIn = Boolean(await getCurrentUser());

  const organizationSchema = buildOrganizationSchema();
  const webSiteSchema = buildWebSiteSchema();

  return (
    <main className="mx-auto max-w-[90rem] px-0 py-6 sm:px-6 sm:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(webSiteSchema) }}
      />

      {/*
        The hero headline is static (locale dictionary only — no DB), so it
        renders in the initial HTML and paints as the LCP element immediately,
        instead of waiting behind a Suspense boundary for leaderboard/article
        queries. Only the data-dependent pieces (the live cards and the
        sections below the hero) stream in behind Suspense.
      */}
      <section className="bg-brand-hero mx-4 overflow-hidden rounded-2xl border app-border p-5 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)] sm:mx-0 sm:rounded-hero sm:p-8 md:p-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(15rem,0.65fr)] lg:gap-8">
          {/*
            The hero is above the fold, so it enters on a clock (`app-enter`),
            not on scroll: a view timeline would report it as already covered
            and skip straight to the finished state. Transform only — the
            headline is the LCP element and paints at full opacity on the first
            frame, and nothing here moves in a way CLS can see.
          */}
          <div className="app-enter flex flex-col items-center text-center sm:items-start sm:text-left">
            <p
              style={beat(0)}
              className="text-xs font-semibold uppercase tracking-eyebrow text-white/70 sm:text-sm"
            >
              {dictionary.home.eyebrow}
            </p>
            <h1
              style={beat(1)}
              className="font-display mt-4 max-w-3xl text-4xl font-medium leading-[1.05] tracking-tight sm:mt-5 md:text-5xl lg:text-6xl"
            >
              {dictionary.home.titleLead}{" "}
              <RotatingWord words={dictionary.home.titleWords} />
            </h1>
            <p
              style={beat(2)}
              className="mt-4 max-w-2xl text-sm leading-7 text-white/80 sm:mt-5 sm:text-base sm:leading-8"
            >
              {dictionary.home.description}
            </p>
            {/*
              Feature roadmap: the highlights read as a left-to-right journey
              (Portfolio → … → Rating) linked by simple brand arrows. Labels are
              plain text — deliberately not chips/buttons — and the arrows are
              decorative, so nothing here carries a hover state.
            */}
            <ol
              style={beat(3)}
              className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-sm font-medium text-white/80 sm:mt-7 sm:justify-start sm:gap-x-2.5 sm:text-base"
            >
              {dictionary.home.descriptionHighlights.map((item, index) => (
                <li key={item} className="flex items-center gap-x-2 sm:gap-x-2.5">
                  {index > 0 ? (
                    <span aria-hidden="true" className="text-brand">
                      →
                    </span>
                  ) : null}
                  <span>{item}</span>
                </li>
              ))}
            </ol>

            <div
              style={beat(4)}
              className="mt-8 flex w-full flex-col items-center gap-3 sm:mt-10 sm:w-auto sm:flex-row sm:flex-wrap sm:items-stretch lg:mt-auto lg:pt-8"
            >
              <ButtonLink
                href={isSignedIn ? "/projects/new" : "/signup"}
                size="lg"
                className="w-full sm:w-auto"
              >
                {isSignedIn
                  ? dictionary.home.ctaPublishProject
                  : dictionary.home.ctaCreateProfile}
              </ButtonLink>
              {isSignedIn ? (
                <HeroSecondaryLink
                  href="/projects"
                  label={dictionary.home.ctaViewProjects}
                />
              ) : (
                <Suspense
                  fallback={
                    <HeroSecondaryLink
                      href="/talents"
                      label={dictionary.home.ctaSeeExample}
                    />
                  }
                >
                  <HeroExampleLink dictionary={dictionary} />
                </Suspense>
              )}
            </div>
          </div>

          {/*
            Deliberately still. These cards arrive behind Suspense, so an
            entrance here plays twice — once as the skeleton paints, once as the
            real card lands on top of it — and the hero already has the copy
            column's sequence carrying its arrival.
          */}
          <div className="space-y-3 sm:space-y-3.5">
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-white/55">
              {dictionary.home.cards.eyebrow}
            </p>
            <Suspense
              fallback={
                <>
                  <HeroLiveCardSkeleton />
                  <HeroLiveCardSkeleton />
                  <HeroLiveCardSkeleton />
                </>
              }
            >
              <HeroLiveCards locale={locale} dictionary={dictionary} />
            </Suspense>
          </div>
        </div>
      </section>

      <Suspense fallback={<HomeBelowHeroSkeleton />}>
        <HomeBelowContent locale={locale} />
      </Suspense>
    </main>
  );
}

async function HeroLiveCards({
  locale,
  dictionary,
}: {
  locale: Locale;
  dictionary: Dictionary;
}) {
  const [leaderboards, latestProject, latestArticles] = await Promise.all([
    getLeaderboards(),
    getLatestProject(),
    getLatestArticles(4, locale),
  ]);
  // "Fresh on the platform", not "trending": with little traffic a trend
  // label is a claim the numbers cannot back. The first card is an example of
  // a strong portfolio (what a visitor could build), the other two are simply
  // the newest work.
  const example = pickExamplePortfolio(leaderboards);
  const topArticle = latestArticles[0];

  return (
    <>
      {example ? (
        <HeroLiveCard
          href={`/u/${example.username}`}
          label={dictionary.home.cards.examplePortfolio.label}
          primary={example.name || example.username}
          secondary={example.headline || `@${example.username}`}
          meta={`${example.rating} ${dictionary.home.leaderboardScore}`}
          cta={dictionary.home.cards.examplePortfolio.cta}
          avatarUrl={example.avatar_url}
          avatarLabel={example.name || example.username}
          tone={HERO_CARD_TONES[0]}
        />
      ) : (
        <HeroFallbackCard
          label={dictionary.home.cards.examplePortfolio.label}
          text={dictionary.home.cards.examplePortfolio.fallback}
          tone={HERO_CARD_TONES[0]}
        />
      )}

      {latestProject ? (
        <HeroLiveCard
          href={buildProjectPath(latestProject.id, latestProject.slug)}
          label={dictionary.home.cards.latestProject.label}
          primary={latestProject.title}
          secondary={
            latestProject.ownerName || latestProject.ownerUsername
              ? `${dictionary.common.by} ${latestProject.ownerName || latestProject.ownerUsername}`
              : undefined
          }
          meta={
            latestProject.createdAt
              ? formatArticleDate(latestProject.createdAt, locale)
              : undefined
          }
          cta={dictionary.home.cards.latestProject.cta}
          tone={HERO_CARD_TONES[1]}
        />
      ) : (
        <HeroFallbackCard
          label={dictionary.home.cards.latestProject.label}
          text={dictionary.home.cards.latestProject.fallback}
          tone={HERO_CARD_TONES[1]}
        />
      )}

      {topArticle ? (
        <HeroLiveCard
          href={`/articles/${topArticle.slug}`}
          label={dictionary.home.cards.freshArticle.label}
          primary={topArticle.title}
          secondary={
            topArticle.author?.name || topArticle.author?.username || undefined
          }
          meta={formatArticleDate(
            topArticle.publishedAt || topArticle.createdAt,
            locale,
          )}
          cta={dictionary.home.cards.freshArticle.cta}
          tone={HERO_CARD_TONES[2]}
        />
      ) : (
        <HeroFallbackCard
          label={dictionary.home.cards.freshArticle.label}
          text={dictionary.home.cards.freshArticle.fallback}
          tone={HERO_CARD_TONES[2]}
        />
      )}
    </>
  );
}

async function HomeBelowContent({ locale }: { locale: Locale }) {
  const dictionary = getDictionary(locale);
  const marketing = getMarketingContent(locale);
  const [leaderboards, latestArticles] = await Promise.all([
    getLeaderboards(),
    getLatestArticles(4, locale),
  ]);

  return (
    <>
      {/* Interest — навіщо це користувачу.
          Motion below the hero is deliberately rationed: only the three card
          rows marked `app-cascade` animate, and their section shells stay put.
          Revealing every section as well read as too much, and a shell the size
          of the viewport moving as one block is the least legible motion on the
          page anyway. Movement only, never text opacity — a mid-flight fade is
          measured as blended colour and turns passing contrast into failures. */}
      <section
        aria-labelledby="home-why-heading"
        className="mt-6 rounded-none app-card p-5 sm:mt-8 sm:rounded-hero sm:p-7"
      >
        <h2
          id="home-why-heading"
          className="font-display text-3xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-4xl"
        >
          {marketing.home.whyTitle}
        </h2>
        <ul className="app-cascade mt-6 grid gap-4 md:grid-cols-3 sm:mt-7">
          {marketing.home.whyBullets.map((item, index) => (
            <li
              key={item}
              style={beat(index)}
              className="relative overflow-hidden rounded-3xl app-panel p-5"
            >
              <span
                aria-hidden="true"
                className="absolute bottom-6 left-0 top-6 w-0.75 rounded-r-full bg-brand opacity-70"
              />
              <span className="font-mono inline-flex h-7 min-w-10 items-center justify-center rounded-full bg-brand-soft px-2 text-xs font-semibold tabular-nums text-brand-on-soft">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="mt-4 text-sm leading-7 app-muted">{item}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Desire — соціальний доказ через топ-рейтинги */}
      <div className="mt-6 sm:mt-10">
        <HomeTopRated
          dictionary={dictionary}
          creators={leaderboards.creators}
          projects={leaderboards.projects}
          freshCreators={leaderboards.freshCreators}
        />
      </div>

      {/* Action — як це працює */}
      <section
        aria-labelledby="home-how-heading"
        className="mt-6 rounded-none app-card p-5 sm:mt-8 sm:rounded-hero sm:p-6"
      >
        <h2
          id="home-how-heading"
          className="font-display text-3xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-4xl"
        >
          {marketing.home.howItWorksTitle}
        </h2>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <article className="rounded-panel app-panel p-4 sm:p-4">
            <h3 className="text-lg font-semibold text-[color:var(--foreground)]">
              {marketing.home.talentTrackTitle}
            </h3>
            <div className="mt-4 space-y-3">
              {marketing.home.talentSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="rounded-2xl bg-[color:var(--surface)] p-3.5"
                >
                  <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
                    {index + 1}
                  </p>
                  <h4 className="mt-1.5 font-semibold text-[color:var(--foreground)]">
                    {step.title}
                  </h4>
                  <p className="mt-1.5 text-sm leading-6 app-muted">{step.description}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-panel app-panel p-4 sm:p-4">
            <h3 className="text-lg font-semibold text-[color:var(--foreground)]">
              {marketing.home.explorerTrackTitle}
            </h3>
            <div className="mt-4 space-y-3">
              {marketing.home.explorerSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="rounded-2xl bg-[color:var(--surface)] p-3.5"
                >
                  <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
                    {index + 1}
                  </p>
                  <h4 className="mt-1.5 font-semibold text-[color:var(--foreground)]">
                    {step.title}
                  </h4>
                  <p className="mt-1.5 text-sm leading-6 app-muted">{step.description}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      {/* Вторинний контент — статті */}
      <section
        aria-labelledby="home-articles-heading"
        className="mt-6 rounded-none app-card p-5 sm:mt-8 sm:rounded-hero sm:p-7"
      >
        <div className="max-w-3xl">
          <h2
            id="home-articles-heading"
            className="font-display text-3xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-4xl"
          >
            {marketing.home.latestArticlesTitle}
          </h2>
          <p className="mt-3 text-sm leading-7 app-muted sm:text-base">
            {marketing.home.latestArticlesDescription}
          </p>
        </div>

        {/* `--auto` rather than `beat()`: ArticleCard is shared with the feeds
            and takes no style prop, so the stagger index is read off the card's
            position in the row instead. */}
        <div className="app-cascade app-cascade--auto mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {latestArticles.map((article) => (
            <ArticleCard key={article.id} article={article} locale={locale} compact />
          ))}
        </div>
      </section>

      {/* Закриття об'єкцій — FAQ. Deliberately unanimated. */}
      <div className="mt-6 sm:mt-8">
        <SeoFaqSection
          title={marketing.home.faqTitle}
          items={marketing.home.faq}
        />
      </div>
    </>
  );
}
