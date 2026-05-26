import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  buildFaqSchema,
  buildMetadata,
  safeJsonLd,
} from "@/lib/seo";

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
    pathname: "/faq",
    title: dictionary.metadata.faq.title,
    description: dictionary.metadata.faq.description,
  });
}

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await getLocaleValue(params);
  const dictionary = getDictionary(locale);
  const faqSchema = buildFaqSchema(
    dictionary.faqPage.items.map((item) => ({
      question: item.q,
      answer: item.a,
    })),
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(faqSchema) }}
      />
      <section className="rounded-hero app-card p-8 sm:p-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.faqPage.eyebrow}
            </p>
            <h1 className="font-display mt-3 text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
              {dictionary.faqPage.title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 app-muted">
              {dictionary.faqPage.description}
            </p>
          </div>

          <ButtonLink href="/" variant="ghost">
            {dictionary.faqPage.backToHome}
          </ButtonLink>
        </div>
      </section>

      <section className="mt-8 space-y-4">
        {dictionary.faqPage.items.map((item) => (
          <details
            key={item.q}
            className="group rounded-panel app-card p-6 sm:p-8"
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-lg font-semibold text-[color:var(--foreground)] [&::-webkit-details-marker]:hidden">
              <span>{item.q}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="mt-1 h-5 w-5 shrink-0 transition-transform group-open:rotate-180"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
            </summary>
            <p className="mt-4 text-base leading-8 app-muted">{item.a}</p>
          </details>
        ))}
      </section>
    </main>
  );
}
