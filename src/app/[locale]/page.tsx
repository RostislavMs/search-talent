import type { Metadata } from "next";
import { Suspense } from "react";
import ArticleCard from "@/components/article-card";
import HomeTopRated from "@/components/home-top-rated";
import SeoFaqSection from "@/components/seo-faq-section";
import HomePageSkeleton from "@/components/skeletons/home-page-skeleton";
import { ButtonLink } from "@/components/ui/Button";
import LocalizedLink from "@/components/ui/localized-link";
import OptimizedImage from "@/components/ui/optimized-image";
import { formatArticleDate } from "@/lib/articles";
import { getLatestArticles } from "@/lib/db/marketing";
import { getLeaderboards } from "@/lib/db/leaderboards";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getMarketingContent } from "@/lib/marketing-content";
import { getCurrentViewerRole } from "@/lib/moderation-server";
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
      className="group block rounded-2xl border border-white/10 bg-black/25 p-4 backdrop-blur transition hover:border-white/25 hover:bg-black/40 sm:p-5"
    >
      <p className="text-xs font-semibold uppercase tracking-eyebrow text-white/55">
        {label}
      </p>
      <div className="mt-3 flex items-start gap-3">
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
          <p className="font-display truncate text-base font-semibold text-white sm:text-lg">
            {primary}
          </p>
          {secondary ? (
            <p className="mt-0.5 truncate text-xs text-white/65 sm:text-sm">
              {secondary}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
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
    <article className="rounded-2xl border border-white/10 bg-black/20 p-4 backdrop-blur sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-eyebrow text-white/55">
        {label}
      </p>
      <p className="mt-3 text-sm leading-6 text-white/70">{text}</p>
    </article>
  );
}

export default async function LocalizedHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = (await getLocaleValue(params)) as Locale;

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

      <Suspense fallback={<HomePageSkeleton />}>
        <HomeContent locale={locale} />
      </Suspense>
    </main>
  );
}

async function HomeContent({ locale }: { locale: Locale }) {
  const dictionary = getDictionary(locale);
  const marketing = getMarketingContent(locale);
  const [leaderboards, latestArticles, viewer] = await Promise.all([
    getLeaderboards(),
    getLatestArticles(6),
    getCurrentViewerRole(),
  ]);
  const isAuthenticated = Boolean(viewer.user);
  const topCreator = leaderboards.creators.all[0];
  const topProject = leaderboards.projects.all[0];
  const topArticle = latestArticles[0];

  return (
    <>
      <section className="bg-brand-hero overflow-hidden rounded-2xl border app-border p-5 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)] sm:rounded-hero sm:p-8 md:p-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)] lg:gap-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-white/70 sm:text-sm">
              {dictionary.home.eyebrow}
            </p>
            <h1 className="font-display mt-3 max-w-3xl text-3xl font-medium leading-[1.05] tracking-tight sm:mt-4 sm:text-5xl md:text-6xl lg:text-7xl">
              {dictionary.home.title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/80 sm:mt-4 sm:text-base sm:leading-8">
              {dictionary.home.description}
            </p>

            <div className="mt-6 flex flex-wrap gap-2 sm:mt-8 sm:gap-3">
              <ButtonLink href="/talents" size="lg">
                {dictionary.home.searchCreators}
              </ButtonLink>
              <ButtonLink href="/projects" variant="secondary" size="lg">
                {dictionary.home.browseProjects}
              </ButtonLink>
              {isAuthenticated ? (
                <ButtonLink
                  href="/dashboard"
                  variant="ghost"
                  size="lg"
                  className="border border-white/25 bg-white/10 text-white backdrop-blur hover:bg-white/20 hover:text-white"
                >
                  {dictionary.home.openDashboard}
                </ButtonLink>
              ) : (
                <ButtonLink
                  href="/signup"
                  variant="ghost"
                  size="lg"
                  className="border border-white/25 bg-white/10 text-white backdrop-blur hover:bg-white/20 hover:text-white"
                >
                  {dictionary.home.createAccount}
                </ButtonLink>
              )}
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-white/55">
              {dictionary.home.cards.eyebrow}
            </p>

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
                  topArticle.author?.name ||
                  topArticle.author?.username ||
                  undefined
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
          </div>
        </div>
      </section>

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
        className="mt-6 rounded-hero app-card p-5 sm:mt-8 sm:p-7"
      >
        <h2
          id="home-how-heading"
          className="font-display text-3xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-4xl"
        >
          {marketing.home.howItWorksTitle}
        </h2>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <article className="rounded-panel app-panel p-4 sm:p-5">
            <h3 className="text-lg font-semibold text-[color:var(--foreground)]">
              {marketing.home.talentTrackTitle}
            </h3>
            <div className="mt-5 space-y-4">
              {marketing.home.talentSteps.map((step, index) => (
                <div key={step.title} className="rounded-2xl bg-[color:var(--surface)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
                    {index + 1}
                  </p>
                  <h4 className="mt-2 font-semibold text-[color:var(--foreground)]">
                    {step.title}
                  </h4>
                  <p className="mt-2 text-sm leading-7 app-muted">{step.description}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-panel app-panel p-4 sm:p-5">
            <h3 className="text-lg font-semibold text-[color:var(--foreground)]">
              {marketing.home.explorerTrackTitle}
            </h3>
            <div className="mt-5 space-y-4">
              {marketing.home.explorerSteps.map((step, index) => (
                <div key={step.title} className="rounded-2xl bg-[color:var(--surface)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
                    {index + 1}
                  </p>
                  <h4 className="mt-2 font-semibold text-[color:var(--foreground)]">
                    {step.title}
                  </h4>
                  <p className="mt-2 text-sm leading-7 app-muted">{step.description}</p>
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

        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {latestArticles.map((article) => (
            <ArticleCard key={article.id} article={article} locale={locale} />
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
