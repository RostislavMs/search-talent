import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/lib/seo";

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

  const metadata = buildMetadata({
    locale,
    pathname: "/about",
    title: dictionary.metadata.about.title,
    description: dictionary.metadata.about.description,
  });

  // The About title already names SearchTalent ("Про SearchTalent …"), so the
  // root "%s | SearchTalent" template would repeat the brand. Pin it as an
  // absolute title to keep the brand appearing exactly once.
  metadata.title = { absolute: dictionary.metadata.about.title };

  return metadata;
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await getLocaleValue(params);
  const dictionary = getDictionary(locale);

  const about = dictionary.aboutPage;

  return (
    <main className="mx-auto max-w-5xl px-0 py-10 sm:px-6">
      <section className="rounded-none sm:rounded-hero app-card p-8 sm:p-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-eyebrow app-soft">
              {about.eyebrow}
            </p>
            <h1 className="font-display mt-3 text-3xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-4xl">
              {about.title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 app-muted">
              {about.description}
            </p>
          </div>

          <ButtonLink href="/" variant="ghost" className="shrink-0">
            {about.backToHome}
          </ButtonLink>
        </div>
      </section>

      <section className="mt-8 rounded-none sm:rounded-hero app-card p-6 sm:p-8">
        <h2 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
          {about.pillarsTitle}
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {about.pillars.map((pillar, index) => (
            <div
              key={pillar.title}
              className="rounded-2xl border app-border p-5 sm:p-6"
            >
              <p className="text-xs font-semibold tracking-eyebrow text-[color:var(--brand-strong)]">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="font-display mt-2 text-lg font-medium tracking-tight text-[color:var(--foreground)]">
                {pillar.title}
              </h3>
              <p className="mt-2 text-sm leading-7 app-muted">{pillar.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-none sm:rounded-hero app-card p-6 sm:p-8">
        <h2 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
          {about.missionTitle}
        </h2>
        <p className="mt-4 text-base leading-8 app-muted">{about.missionText}</p>
      </section>

      <section className="mt-6 rounded-none sm:rounded-hero app-card p-6 sm:p-8">
        <h2 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
          {about.featuresTitle}
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {about.features.map((feature) => (
            <li
              key={feature}
              className="flex items-start gap-3 text-base leading-7 app-muted"
            >
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--foreground)]" />
              {feature}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-none sm:rounded-hero app-card p-6 sm:p-8">
        <h2 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
          {about.communityTitle}
        </h2>
        <p className="mt-4 text-base leading-8 app-muted">
          {about.communityText}
        </p>
      </section>

      <section className="mt-6 rounded-none sm:rounded-hero app-card p-6 sm:p-8">
        <h2 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
          {about.openSourceTitle}
        </h2>
        <p className="mt-4 text-base leading-8 app-muted">
          {about.openSourceText}
        </p>
      </section>

      <section className="mt-6 rounded-none sm:rounded-hero app-card p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
              {about.ctaTitle}
            </h2>
            <p className="mt-2 max-w-xl text-base leading-8 app-muted">
              {about.ctaText}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:shrink-0 sm:flex-row">
            <ButtonLink href="/signup" className="w-full sm:w-auto">
              {about.ctaPrimary}
            </ButtonLink>
            <ButtonLink
              href="/talents"
              variant="secondary"
              className="w-full sm:w-auto"
            >
              {about.ctaSecondary}
            </ButtonLink>
          </div>
        </div>
      </section>
    </main>
  );
}
