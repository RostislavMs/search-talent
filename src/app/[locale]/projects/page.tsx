import type { Metadata } from "next";
import dynamic from "next/dynamic";
import SeoFaqSection from "@/components/seo-faq-section";
import DiscoveryPageSkeleton from "@/components/skeletons/discovery-page-skeleton";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getMarketingContent } from "@/lib/marketing-content";
import { buildMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";

const DiscoveryPage = dynamic(() => import("@/components/discovery-page"), {
  loading: () => <DiscoveryPageSkeleton mode="projects" />,
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
    pathname: "/projects",
    title: dictionary.metadata.projects.title,
    description: dictionary.metadata.projects.description,
  });
}

export default async function LocalizedProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = (await getLocaleValue(params)) as Locale;
  const marketing = getMarketingContent(locale);

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 sm:py-10">
      <DiscoveryPage mode="projects" />

      <div className="mt-6 sm:mt-8">
        <SeoFaqSection title={marketing.projects.faqTitle} items={marketing.projects.faq} />
      </div>
    </main>
  );
}
