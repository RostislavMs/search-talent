import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AdminArticlesSection, {
  type SearchParamValue,
} from "@/components/admin/admin-articles-section";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/lib/seo";

const PER_PAGE = 25;

async function resolveLocale(
  params: Promise<{ locale: string }>,
): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const dictionary = getDictionary(locale);
  return buildMetadata({
    locale,
    pathname: "/admin/content/discussions",
    title: `${dictionary.admin.content.discussionsTitle} · ${dictionary.admin.shell.title}`,
    description: dictionary.admin.content.discussionsDescription,
    noindex: true,
  });
}

/**
 * Moderation for standalone discussion topics. They are `articles` rows under
 * the hood, so this is the same list as the Articles section narrowed to the
 * Discussions category — the two scopes are complements and never overlap.
 */
export default async function AdminDiscussionsContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, SearchParamValue>>;
}) {
  const locale = await resolveLocale(params);
  const copy = getDictionary(locale).admin.content;

  return (
    <AdminArticlesSection
      locale={locale}
      searchParams={await searchParams}
      scope="discussions"
      basePath="/admin/content/discussions"
      itemPathPrefix="/discussions"
      title={copy.discussionsTitle}
      description={copy.discussionsDescription}
      perPage={PER_PAGE}
    />
  );
}
