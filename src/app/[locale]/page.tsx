import type { Metadata } from "next";
import ArticleCard from "@/components/article-card";
import HomeTopRated from "@/components/home-top-rated";
import SeoFaqSection from "@/components/seo-faq-section";
import { ButtonLink } from "@/components/ui/Button";
import { getLatestArticles } from "@/lib/db/marketing";
import { getLeaderboards } from "@/lib/db/leaderboards";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getMarketingContent } from "@/lib/marketing-content";
import { getCurrentViewerRole } from "@/lib/moderation-server";
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

function HomeCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-white/12 bg-white/10 p-4 backdrop-blur sm:p-5">
      <h3 className="text-base font-semibold text-white sm:text-lg">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/75 sm:mt-3 sm:leading-7">{description}</p>
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
  const marketing = getMarketingContent(locale);
  const [leaderboards, latestArticles, viewer] = await Promise.all([
    getLeaderboards(),
    getLatestArticles(6),
    getCurrentViewerRole(),
  ]);
  const isAuthenticated = Boolean(viewer.user);

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

      <section className="overflow-hidden rounded-2xl border app-border bg-[linear-gradient(145deg,_rgba(15,23,42,0.98),_rgba(3,105,161,0.92)_50%,_rgba(245,158,11,0.84))] p-5 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)] sm:rounded-[2.25rem] sm:p-8 md:p-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)] lg:gap-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70 sm:text-sm">
              {dictionary.home.eyebrow}
            </p>
            <h1 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight sm:mt-4 sm:text-4xl md:text-5xl">
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

          <div className="grid gap-3 sm:gap-4">
            <HomeCard
              title={dictionary.home.cards.discovery.title}
              description={dictionary.home.cards.discovery.description}
            />
            <HomeCard
              title={dictionary.home.cards.creators.title}
              description={dictionary.home.cards.creators.description}
            />
            <HomeCard
              title={dictionary.home.cards.teams.title}
              description={dictionary.home.cards.teams.description}
            />
          </div>
        </div>
      </section>

      {/* Interest — навіщо це користувачу */}
      <section
        aria-labelledby="home-why-heading"
        className="mt-6 rounded-[2rem] app-card p-5 sm:mt-8 sm:p-7"
      >
        <h2
          id="home-why-heading"
          className="text-2xl font-semibold text-[color:var(--foreground)]"
        >
          {marketing.home.whyTitle}
        </h2>
        <ul className="mt-5 grid gap-4 md:grid-cols-3">
          {marketing.home.whyBullets.map((item) => (
            <li
              key={item}
              className="rounded-[1.5rem] app-panel p-4 text-sm leading-7 app-muted"
            >
              {item}
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
        className="mt-6 rounded-[2rem] app-card p-5 sm:mt-8 sm:p-7"
      >
        <h2
          id="home-how-heading"
          className="text-2xl font-semibold text-[color:var(--foreground)]"
        >
          {marketing.home.howItWorksTitle}
        </h2>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <article className="rounded-[1.75rem] app-panel p-5">
            <h3 className="text-lg font-semibold text-[color:var(--foreground)]">
              {marketing.home.talentTrackTitle}
            </h3>
            <div className="mt-5 space-y-4">
              {marketing.home.talentSteps.map((step, index) => (
                <div key={step.title} className="rounded-[1.25rem] bg-[color:var(--surface)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] app-soft">
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

          <article className="rounded-[1.75rem] app-panel p-5">
            <h3 className="text-lg font-semibold text-[color:var(--foreground)]">
              {marketing.home.explorerTrackTitle}
            </h3>
            <div className="mt-5 space-y-4">
              {marketing.home.explorerSteps.map((step, index) => (
                <div key={step.title} className="rounded-[1.25rem] bg-[color:var(--surface)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] app-soft">
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
        className="mt-6 rounded-[2rem] app-card p-5 sm:mt-8 sm:p-7"
      >
        <div className="max-w-3xl">
          <h2
            id="home-articles-heading"
            className="text-2xl font-semibold text-[color:var(--foreground)]"
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
    </main>
  );
}
