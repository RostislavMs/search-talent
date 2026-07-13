import type { Metadata } from "next";
import { notFound } from "next/navigation";
import FaqAccordion from "@/components/faq-accordion";
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
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(faqSchema) }}
      />
      <section className="-mx-4 rounded-none app-card p-8 sm:mx-0 sm:rounded-hero sm:p-10">
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

          <ButtonLink href="/" variant="secondary" className="shrink-0">
            {dictionary.faqPage.backToHome}
          </ButtonLink>
        </div>
      </section>

      <section className="mt-2">
        <FaqAccordion
          items={dictionary.faqPage.items.map((item) => ({
            question: item.q,
            answer: item.a,
          }))}
        />
      </section>
    </main>
  );
}
