import type { Metadata } from "next";
import dynamic from "next/dynamic";
import SeoFaqSection from "@/components/seo-faq-section";
import DiscoveryPageSkeleton from "@/components/skeletons/discovery-page-skeleton";
import { getPopularTechnologies } from "@/lib/db/marketing";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getMarketingContent } from "@/lib/marketing-content";
import { buildMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";

const DiscoveryPage = dynamic(() => import("@/components/discovery-page"), {
  loading: () => <DiscoveryPageSkeleton mode="creators" />,
});

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
    pathname: "/talents",
    title: dictionary.metadata.talents.title,
    description: dictionary.metadata.talents.description,
  });
}

export default async function LocalizedTalentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = (await getLocaleValue(params)) as Locale;
  const marketing = getMarketingContent(locale);
  const technologies = await getPopularTechnologies(20);

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 sm:py-10">
      <DiscoveryPage mode="creators" />

      <section className="mt-6 rounded-[2rem] app-card p-5 sm:mt-8 sm:p-7">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-semibold text-[color:var(--foreground)]">
            {marketing.talents.popularTechnologiesTitle}
          </h2>
          <p className="mt-3 text-sm leading-7 app-muted sm:text-base">
            {marketing.talents.popularTechnologiesDescription}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {technologies.map((technology) => (
            <span
              key={technology.id}
              className="rounded-full border app-border px-3 py-1.5 text-sm text-[color:var(--foreground)]"
            >
              {technology.name}
            </span>
          ))}
        </div>
      </section>

      <div className="mt-6 sm:mt-8">
        <SeoFaqSection title={marketing.talents.faqTitle} items={marketing.talents.faq} />
      </div>
    </main>
  );
}
