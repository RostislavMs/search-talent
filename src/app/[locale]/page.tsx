import type { Metadata } from "next";
import { Suspense } from "react";
import ArticleCard from "@/components/article-card";
import HomeExampleCard from "@/components/home-example-card";
import HomeTopRated from "@/components/home-top-rated";
import SeoFaqSection from "@/components/seo-faq-section";
import { HomeBelowHeroSkeleton } from "@/components/skeletons/home-page-skeleton";
import { HeroExampleSkeleton } from "@/components/skeletons/hero-skeletons";
import { ButtonLink } from "@/components/ui/Button";
import LocalizedLink from "@/components/ui/localized-link";
import { getHeroExamplePortfolio, getLatestArticles } from "@/lib/db/marketing";
import { getLeaderboards } from "@/lib/db/leaderboards";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import { getMarketingContent } from "@/lib/marketing-content";
import { beat } from "@/lib/motion";
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
 * "See an example" for guests. It points at the same portfolio as the preview
 * card, and the label never changes, so the fallback (browse talents) swaps for
 * the real profile link without moving anything.
 */
async function HeroExampleLink({ dictionary }: { dictionary: Dictionary }) {
  const example = await getHeroExamplePortfolio();

  return (
    <HeroSecondaryLink
      href={example ? `/u/${example.username}` : "/talents"}
      label={dictionary.home.ctaSeeExample}
    />
  );
}

async function HeroExample({ dictionary }: { dictionary: Dictionary }) {
  return (
    <HomeExampleCard example={await getHeroExamplePortfolio()} dictionary={dictionary} />
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
        queries. Only the data-dependent pieces (the example portfolio and the
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
          {/*
            Centred as one block rather than pinning the buttons to the bottom:
            the copy is short now, and a pinned CTA left a hole in the middle.
          */}
          <div className="app-enter flex flex-col items-center justify-center text-center sm:items-start sm:text-left">
            <h1
              style={beat(0)}
              className="font-display max-w-3xl text-4xl font-medium leading-[1.05] tracking-tight md:text-5xl lg:text-6xl"
            >
              {dictionary.home.titleLead}{" "}
              <span className="hero-accent">{dictionary.home.titleAccent}</span>
            </h1>
            {/* Who it is for is said through the work itself (code, design,
                video, 3D) at the start of this line rather than a label of
                professions above the headline. */}
            <p
              style={beat(1)}
              className="mt-4 max-w-2xl text-base leading-7 text-white/85 sm:mt-6 sm:text-lg sm:leading-8"
            >
              {dictionary.home.description}
            </p>

            <div
              style={beat(2)}
              className="mt-8 flex w-full flex-col items-center gap-3 sm:mt-10 sm:w-auto sm:flex-row sm:flex-wrap sm:items-stretch"
            >
              {/* Both states follow the subtitle's two verbs — show your work,
                  style your page: a guest starts the portfolio, a signed-in
                  author adds work or opens the theme editor. */}
              <ButtonLink
                href={isSignedIn ? "/projects/new" : "/signup"}
                size="lg"
                className="w-full sm:w-auto"
              >
                {isSignedIn
                  ? dictionary.home.ctaAddWork
                  : dictionary.home.ctaCreateProfile}
              </ButtonLink>
              {isSignedIn ? (
                <HeroSecondaryLink
                  href="/profile/edit?section=theme"
                  label={dictionary.home.ctaStylePage}
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
            {isSignedIn ? null : (
              <p style={beat(3)} className="mt-4 text-sm text-white/65">
                {dictionary.home.heroNote}
              </p>
            )}
          </div>

          {/*
            Deliberately still. The card arrives behind Suspense, so an entrance
            here would play twice — once as the skeleton paints, once as the
            real card lands on top of it — and the copy column's sequence
            already carries the hero's arrival.
          */}
          <div className="lg:self-center">
            <Suspense fallback={<HeroExampleSkeleton />}>
              <HeroExample dictionary={dictionary} />
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

/**
 * One audience's path in "How it works": numbered steps straight on the panel.
 * The steps used to sit in boxes of their own inside the panel inside the
 * section — three nested surfaces for three lines of text.
 */
function HowItWorksTrack({
  title,
  steps,
}: {
  title: string;
  steps: ReadonlyArray<{ title: string; description: string }>;
}) {
  return (
    <article className="rounded-panel app-panel p-4 sm:p-5">
      <h3 className="text-lg font-semibold text-[color:var(--foreground)]">{title}</h3>
      <ol className="mt-4 space-y-4">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span
              aria-hidden="true"
              className="font-mono flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft px-2 text-xs font-semibold tabular-nums text-brand-on-soft"
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <h4 className="font-semibold text-[color:var(--foreground)]">{step.title}</h4>
              <p className="mt-1 text-sm leading-6 app-muted">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </article>
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
          {marketing.home.featuresTitle}
        </h2>
        <ul className="app-cascade mt-6 grid gap-4 sm:mt-7 md:grid-cols-2 xl:grid-cols-4">
          {marketing.home.features.map((item, index) => (
            <li
              key={item.title}
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
              <h3 className="mt-4 text-lg font-semibold text-[color:var(--foreground)]">
                {item.title}
              </h3>
              <p className="mt-1.5 text-sm leading-6 app-muted">{item.description}</p>
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
          <HowItWorksTrack
            title={marketing.home.talentTrackTitle}
            steps={marketing.home.talentSteps}
          />
          <HowItWorksTrack
            title={marketing.home.explorerTrackTitle}
            steps={marketing.home.explorerSteps}
          />
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
