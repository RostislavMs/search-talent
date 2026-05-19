import type { Metadata } from "next";
import CreatorCard from "@/components/creator-card";
import SeoFaqSection from "@/components/seo-faq-section";
import { ButtonLink } from "@/components/ui/Button";
import {
  getCreatorsByCategoryId,
  getRoleBySlug,
  getRoleDirectory,
} from "@/lib/db/marketing";
import { locales, isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getHireRoleFaq, getHireRoleIntro } from "@/lib/marketing-content";
import { buildHireRoleMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";

export const revalidate = 21600;

const MIN_PROFILES_FOR_HIRE_PAGE = 5;

export async function generateStaticParams() {
  const roles = await getRoleDirectory();
  const eligible = roles.filter(
    (role) => role.count >= MIN_PROFILES_FOR_HIRE_PAGE,
  );

  return locales.flatMap((locale) =>
    eligible.map((role) => ({ locale, role: role.slug })),
  );
}

async function getRouteParams(
  params: Promise<{ locale: string; role: string }>,
) {
  const { locale, role } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return {
    locale: locale as Locale,
    role,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; role: string }>;
}): Promise<Metadata> {
  const { locale, role } = await getRouteParams(params);
  const category = await getRoleBySlug(role);

  if (!category) {
    notFound();
  }

  return buildHireRoleMetadata({
    locale,
    pathname: `/hire/${role}`,
    role: category.name,
    noindex: category.count < MIN_PROFILES_FOR_HIRE_PAGE,
  });
}

export default async function HireRolePage({
  params,
}: {
  params: Promise<{ locale: string; role: string }>;
}) {
  const { locale, role } = await getRouteParams(params);
  const category = await getRoleBySlug(role);

  if (!category) {
    notFound();
  }

  const dictionary = getDictionary(locale);
  const intro = getHireRoleIntro(locale, category.name);
  const faq = getHireRoleFaq(locale, category.name);

  const [creators, allRoles] = await Promise.all([
    getCreatorsByCategoryId(category.id, 12),
    getRoleDirectory(),
  ]);

  const relatedRoles = allRoles
    .filter(
      (item) =>
        item.slug !== category.slug &&
        item.count >= MIN_PROFILES_FOR_HIRE_PAGE,
    )
    .slice(0, 6);

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 sm:py-10">
      <section className="rounded-[2rem] app-card p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] app-soft">
          {locale === "uk" ? "Найняти фахівця" : "Hire a specialist"}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[color:var(--foreground)] sm:text-4xl">
          {locale === "uk"
            ? `Найняти ${category.name}`
            : `Hire ${category.name}`}
        </h1>
        <p className="mt-3 text-sm app-muted">
          {category.count}
          {locale === "uk"
            ? " публічних профілів із реальним портфоліо"
            : " public profiles with real portfolios"}
        </p>
        <div className="mt-5 space-y-4 text-sm leading-7 app-muted sm:text-base sm:leading-8">
          {intro.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <ButtonLink href="/talents" size="md">
            {locale === "uk" ? "Переглянути портфоліо" : "Browse portfolios"}
          </ButtonLink>
        </div>
      </section>

      {creators.length > 0 && (
        <section className="mt-6 rounded-[2rem] app-card p-5 sm:mt-8 sm:p-7">
          <h2 className="text-2xl font-semibold text-[color:var(--foreground)]">
            {locale === "uk"
              ? `Приклади профілів ${category.name}`
              : `Featured ${category.name} profiles`}
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {creators.map((creator) => (
              <CreatorCard
                key={creator.username}
                creator={{
                  username: creator.username,
                  name: creator.name,
                  headline: creator.headline,
                  avatar_url: creator.avatarUrl,
                  city: creator.city,
                  countryName: creator.countryName,
                  categoryName: creator.categoryName,
                }}
                dictionary={dictionary}
              />
            ))}
          </div>
        </section>
      )}

      {relatedRoles.length > 0 && (
        <section className="mt-6 rounded-[2rem] app-card p-5 sm:mt-8 sm:p-7">
          <h2 className="text-2xl font-semibold text-[color:var(--foreground)]">
            {locale === "uk" ? "Інші ролі для найму" : "Other roles to hire"}
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {relatedRoles.map((item) => (
              <ButtonLink
                key={item.id}
                href={`/hire/${item.slug}`}
                variant="secondary"
                className="justify-between rounded-[1.5rem]"
              >
                <span>{item.name}</span>
                <span className="rounded-full bg-black/8 px-2 py-0.5 text-xs">
                  {item.count}
                </span>
              </ButtonLink>
            ))}
          </div>
        </section>
      )}

      <div className="mt-6 sm:mt-8">
        <SeoFaqSection
          title={locale === "uk" ? "Поширені запитання про найм" : "Frequently asked hiring questions"}
          items={faq}
        />
      </div>
    </main>
  );
}
