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

  return buildMetadata({
    locale,
    pathname: "/about",
    title: dictionary.metadata.about.title,
    description: dictionary.metadata.about.description,
  });
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await getLocaleValue(params);
  const dictionary = getDictionary(locale);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <section className="rounded-hero app-card p-8 sm:p-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.aboutPage.eyebrow}
            </p>
            <h1 className="font-display mt-3 text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
              {dictionary.aboutPage.title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 app-muted">
              {dictionary.aboutPage.description}
            </p>
          </div>

          <ButtonLink href="/" variant="ghost">
            {dictionary.aboutPage.backToHome}
          </ButtonLink>
        </div>
      </section>

      <section className="mt-8 rounded-hero app-card p-6 sm:p-8">
        <h2 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
          {dictionary.aboutPage.missionTitle}
        </h2>
        <p className="mt-4 text-base leading-8 app-muted">
          {dictionary.aboutPage.missionText}
        </p>
      </section>

      <section className="mt-6 rounded-hero app-card p-6 sm:p-8">
        <h2 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
          {dictionary.aboutPage.featuresTitle}
        </h2>
        <ul className="mt-4 space-y-3">
          {dictionary.aboutPage.features.map((feature) => (
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

    </main>
  );
}
