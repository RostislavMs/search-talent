import type { Metadata } from "next";
import BrowseFacets from "@/components/browse-facets";
import { ButtonLink } from "@/components/ui/Button";
import { getTechnologyDirectory } from "@/lib/db/marketing";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";

// Rendered per request — consistent with the /projects/tag/[tag] facet pages,
// whose on-demand ISR path 500s in production. Keeps the whole tag facet family
// on the proven per-request SSR path.
export const dynamic = "force-dynamic";

// Only list facets that resolve to a non-empty page.
const MIN_PROJECTS_PER_TAG = 1;

async function getLocaleValue(params: Promise<{ locale: string }>) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return locale as Locale;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = await getLocaleValue(params);

  return buildMetadata({
    locale,
    pathname: "/projects/tag",
    title:
      locale === "uk"
        ? "Технології та стек IT-проєктів"
        : "IT Project Technologies & Stacks",
    description:
      locale === "uk"
        ? "Повний каталог технологій і стеку публічних IT-проєктів із портфоліо на SearchTalent."
        : "Full directory of technologies and stacks behind public IT projects on SearchTalent.",
  });
}

export default async function ProjectTagDirectoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await getLocaleValue(params);
  const technologies = await getTechnologyDirectory();

  const items = technologies
    .filter((technology) => technology.count >= MIN_PROJECTS_PER_TAG)
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    .map((technology) => ({
      label: technology.name,
      href: `/projects/tag/${technology.slug}`,
      count: technology.count,
    }));

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 sm:py-10">
      <header className="max-w-3xl">
        <h1 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-3xl">
          {locale === "uk" ? "Технології проєктів" : "Project technologies"}
        </h1>
        <p className="mt-3 text-sm leading-7 app-muted sm:text-base">
          {locale === "uk"
            ? "Оберіть технологію, щоб переглянути публічні IT-проєкти зі стеком."
            : "Pick a technology to browse public IT projects by stack."}
        </p>
      </header>

      {items.length > 0 ? (
        <div className="mt-6 sm:mt-8">
          <BrowseFacets items={items} />
        </div>
      ) : (
        <div className="mt-6 sm:mt-8">
          <ButtonLink href="/projects" variant="secondary" size="md">
            {locale === "uk" ? "Усі проєкти" : "All projects"}
          </ButtonLink>
        </div>
      )}
    </main>
  );
}
