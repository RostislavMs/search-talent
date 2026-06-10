import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/lib/seo";
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
    pathname: "/verify",
    title: dictionary.metadata.verify.title,
    description: dictionary.metadata.verify.description,
    noindex: true,
  });
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await getLocaleValue(params);
  const dictionary = getDictionary(locale);

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <section className="rounded-hero app-card p-8 sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-eyebrow app-soft">
          {dictionary.auth.verify.eyebrow}
        </p>
        <h1 className="font-display mt-4 text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
          {dictionary.auth.verify.title}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-8 app-muted">
          {dictionary.auth.verify.description}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/login">{dictionary.auth.verify.login}</ButtonLink>
          <ButtonLink href="/dashboard" variant="secondary">
            {dictionary.auth.verify.openDashboard}
          </ButtonLink>
          <ButtonLink href="/" variant="ghost">
            {dictionary.auth.verify.backHome}
          </ButtonLink>
        </div>

        <div className="mt-8 rounded-3xl app-panel p-5 text-sm leading-7 app-muted">
          {dictionary.auth.verify.hint}
        </div>
      </section>
    </main>
  );
}
