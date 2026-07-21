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
    <main className="mx-auto max-w-3xl px-0 py-0 sm:px-4 sm:py-16">
      <section className="rounded-none sm:rounded-hero app-card px-4 py-6 sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-eyebrow text-orange-400">
          {dictionary.auth.verify.eyebrow}
        </p>
        <h1 className="font-display mt-3 text-2xl font-medium tracking-tight text-[color:var(--foreground)] sm:mt-4 sm:text-3xl">
          {dictionary.auth.verify.title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 app-muted sm:mt-4 sm:text-base sm:leading-8">
          {dictionary.auth.verify.description}
        </p>

        <div className="mt-6 flex flex-wrap gap-3 sm:mt-8">
          <ButtonLink href="/login">{dictionary.auth.verify.login}</ButtonLink>
          <ButtonLink href="/my-space" variant="secondary">
            {dictionary.auth.verify.openMySpace}
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
