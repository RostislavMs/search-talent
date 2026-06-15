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
import { getLatestArticles } from "@/lib/db/marketing";
import { getLeaderboards } from "@/lib/db/leaderboards";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import { getMarketingContent } from "@/lib/marketing-content";
import { buildProjectPath } from "@/lib/projects";
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

type HeroLiveCardProps = {
  href: string;
  label: string;
  primary: string;
  secondary?: string;
  meta?: string;
  cta: string;
  avatarUrl?: string | null;
  avatarLabel?: string;
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
}: HeroLiveCardProps) {
  return (
    <LocalizedLink
      href={href}
      className="group block rounded-2xl border border-white/10 bg-black/25 p-3 backdrop-blur transition hover:border-white/25 hover:bg-black/40 sm:p-4"
    >
      <p className="text-xs font-semibold uppercase tracking-eyebrow text-white/55">
        {label}
      </p>
      <div className="mt-2.5 flex items-start gap-3">
        {avatarLabel ? (
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/10 text-sm font-semibold text-white">
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
            <p className="mt-0.5 truncate text-xs text-white/65 sm:text-sm">
              {secondary}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        {meta ? (
          <span className="font-display rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white">
            {meta}
          </span>
        ) : (
          <span aria-hidden="true" />
        )}
        <span className="text-xs font-medium text-white/70 transition group-hover:text-white">
          {cta} →
        </span>
      </div>
    </LocalizedLink>
  );
}

function HeroFallbackCard({ label, text }: { label: string; text: string }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/20 p-3 backdrop-blur sm:p-4">
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

  const organizationSchema = buildOrganizationSchema();
  const webSiteSchema = buildWebSiteSchema();

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 sm:py-10">
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
      <section className="bg-brand-hero overflow-hidden rounded-2xl border app-border p-5 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)] sm:rounded-hero sm:p-8 md:p-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(15rem,0.65fr)] lg:gap-8">
          <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-white/70 sm:text-sm">
              {dictionary.home.eyebrow}
            </p>
            <h1 className="font-display mt-3 max-w-3xl text-4xl font-medium leading-[1.05] tracking-tight sm:mt-4 md:text-5xl lg:text-6xl">
              {dictionary.home.titleLead}{" "}
              <RotatingWord words={dictionary.home.titleWords} />
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/80 sm:mt-4 sm:text-base sm:leading-8">
              {dictionary.home.description}
            </p>
            <ul className="mt-3 grid w-full grid-cols-2 justify-items-center gap-x-3 gap-y-2 text-xs font-medium text-white/70 sm:mt-4 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-items-stretch sm:gap-x-2.5 sm:gap-y-1.5 sm:text-sm">
              {dictionary.home.descriptionHighlights.map((item, index) => (
                <li key={item} className="flex items-center gap-2.5">
                  {index > 0 ? (
                    <span aria-hidden="true" className="hidden text-white/30 sm:inline">
                      ·
                    </span>
                  ) : null}
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-6 flex w-full flex-col gap-2 sm:mt-8 sm:w-auto sm:flex-row sm:flex-wrap sm:gap-3 lg:mt-auto lg:pt-8">
              <ButtonLink href="/talents" size="lg" className="w-full sm:w-auto">
                {dictionary.home.searchCreators}
              </ButtonLink>
              <ButtonLink
                href="/projects"
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto"
              >
                {dictionary.home.browseProjects}
              </ButtonLink>
            </div>
          </div>

          <div className="space-y-2.5 sm:space-y-3">
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
  const [leaderboards, latestArticles] = await Promise.all([
    getLeaderboards(),
    getLatestArticles(4, locale),
  ]);
  const topCreator = leaderboards.creators.all[0];
  const topProject = leaderboards.projects.all[0];
  const topArticle = latestArticles[0];

  return (
    <>
      {topCreator ? (
        <HeroLiveCard
          href={`/u/${topCreator.username}`}
          label={dictionary.home.cards.topTalent.label}
          primary={topCreator.name || topCreator.username}
          secondary={`@${topCreator.username}`}
          meta={`${topCreator.rating} ${dictionary.home.leaderboardScore}`}
          cta={dictionary.home.cards.topTalent.cta}
          avatarUrl={topCreator.avatar_url}
          avatarLabel={topCreator.name || topCreator.username}
        />
      ) : (
        <HeroFallbackCard
          label={dictionary.home.cards.topTalent.label}
          text={dictionary.home.cards.topTalent.fallback}
        />
      )}

      {topProject ? (
        <HeroLiveCard
          href={buildProjectPath(topProject.id, topProject.slug)}
          label={dictionary.home.cards.topProject.label}
          primary={topProject.title}
          secondary={
            topProject.ownerName || topProject.ownerUsername
              ? `${dictionary.common.by} ${topProject.ownerName || topProject.ownerUsername}`
              : undefined
          }
          meta={`${topProject.rating} ${dictionary.home.leaderboardScore}`}
          cta={dictionary.home.cards.topProject.cta}
        />
      ) : (
        <HeroFallbackCard
          label={dictionary.home.cards.topProject.label}
          text={dictionary.home.cards.topProject.fallback}
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
        />
      ) : (
        <HeroFallbackCard
          label={dictionary.home.cards.freshArticle.label}
          text={dictionary.home.cards.freshArticle.fallback}
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
      {/* Interest — навіщо це користувачу */}
      <section
        aria-labelledby="home-why-heading"
        className="mt-6 rounded-hero app-card p-5 sm:mt-8 sm:p-7"
      >
        <h2
          id="home-why-heading"
          className="font-display text-3xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-4xl"
        >
          {marketing.home.whyTitle}
        </h2>
        <ul className="mt-6 grid gap-4 md:grid-cols-3 sm:mt-7">
          {marketing.home.whyBullets.map((item, index) => (
            <li
              key={item}
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
        />
      </div>

      {/* Action — як це працює */}
      <section
        aria-labelledby="home-how-heading"
        className="mt-6 rounded-hero app-card p-5 sm:mt-8 sm:p-6"
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
                <div key={step.title} className="rounded-2xl bg-[color:var(--surface)] p-3.5">
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
                <div key={step.title} className="rounded-2xl bg-[color:var(--surface)] p-3.5">
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
        className="mt-6 rounded-hero app-card p-5 sm:mt-8 sm:p-7"
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

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {latestArticles.map((article) => (
            <ArticleCard key={article.id} article={article} locale={locale} compact />
          ))}
        </div>
      </section>

      {/* Закриття об'єкцій — FAQ */}
      <div className="mt-6 sm:mt-8">
        <SeoFaqSection
          title={marketing.home.faqTitle}
          items={marketing.home.faq}
        />
      </div>
    </>
  );
}
