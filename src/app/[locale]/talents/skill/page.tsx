import type { Metadata } from "next";
import BrowseFacets from "@/components/browse-facets";
import { ButtonLink } from "@/components/ui/Button";
import { getTalentSkillDirectory } from "@/lib/db/marketing";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";

// Rendered per request — consistent with the /talents/skill/[skill] facet
// pages, whose on-demand ISR path 500s in production. Keeps the whole skill
// facet family on the proven per-request SSR path.
export const dynamic = "force-dynamic";

// Only list facets that resolve to a non-empty page.
const MIN_TALENTS_PER_FACET = 1;

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
    pathname: "/talents/skill",
    title:
      locale === "uk"
        ? "Навички та технології фахівців"
        : "Talent Skills & Technologies",
    description:
      locale === "uk"
        ? "Повний каталог навичок і технологій, за якими можна знайти IT-фахівців із публічними портфоліо на SearchTalent."
        : "Full directory of skills and technologies to browse IT specialists with public portfolios on SearchTalent.",
  });
}

export default async function TalentSkillDirectoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await getLocaleValue(params);
  const skills = await getTalentSkillDirectory();

  const items = skills
    .filter((skill) => skill.count >= MIN_TALENTS_PER_FACET)
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    .map((skill) => ({
      label: skill.name,
      href: `/talents/skill/${skill.slug}`,
      count: skill.count,
    }));

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 sm:py-10">
      <header className="max-w-3xl">
        <h1 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-3xl">
          {locale === "uk" ? "Навички фахівців" : "Talent skills"}
        </h1>
        <p className="mt-3 text-sm leading-7 app-muted sm:text-base">
          {locale === "uk"
            ? "Оберіть навичку чи технологію, щоб переглянути фахівців із публічними портфоліо."
            : "Pick a skill or technology to browse specialists with public portfolios."}
        </p>
      </header>

      {items.length > 0 ? (
        <div className="mt-6 sm:mt-8">
          <BrowseFacets items={items} />
        </div>
      ) : (
        <div className="mt-6 sm:mt-8">
          <ButtonLink href="/talents" variant="secondary" size="md">
            {locale === "uk" ? "Усі фахівці" : "All talents"}
          </ButtonLink>
        </div>
      )}
    </main>
  );
}
