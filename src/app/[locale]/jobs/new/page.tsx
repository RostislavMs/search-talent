import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import VacancyForm from "@/components/vacancy-form";
import { ButtonLink } from "@/components/ui/Button";
import { buildLoginHref } from "@/lib/auth/redirect";
import { getCompanyById, listMyCompanies } from "@/lib/db/companies";
import { getVacancyFormOptions } from "@/lib/db/vacancies";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function resolveLocale(params: Promise<{ locale: string }>): Promise<Locale> {
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
  const copy = getDictionary(locale).vacancies.meta;

  return buildMetadata({
    locale,
    pathname: "/jobs/new",
    title: copy.newTitle,
    description: copy.newDescription,
    noindex: true,
  });
}

export default async function NewVacancyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ company?: string }>;
}) {
  const locale = await resolveLocale(params);
  const { company: requestedCompany } = await searchParams;
  const viewer = await getCurrentViewerRole();

  if (!viewer.user) {
    redirect(buildLoginHref(locale, "/jobs/new"));
  }

  const copy = getDictionary(locale).vacancies;

  // Pages the person is in and that are visible: a hidden page cannot post.
  const mine = (await listMyCompanies(viewer.supabase, viewer.user.id))
    .filter((company) => company.moderationStatus === "approved")
    .map((company) => ({ id: company.id, name: company.name, verified: company.verified }));

  // A platform admin seeds vacancies for pages they are not in (?company=id).
  if (viewer.isAdmin && requestedCompany && !mine.some((company) => company.id === requestedCompany)) {
    const other = /^[0-9a-f-]{36}$/i.test(requestedCompany)
      ? await getCompanyById(viewer.supabase, requestedCompany)
      : null;
    if (other) {
      mine.unshift({ id: other.id, name: other.name, verified: other.verified });
    }
  }

  const defaultCompanyId = mine.some((company) => company.id === requestedCompany)
    ? requestedCompany
    : (mine[0]?.id ?? null);

  const options = mine.length > 0 ? await getVacancyFormOptions(viewer.supabase) : null;

  return (
    <main className="mx-auto max-w-[90rem] px-0 py-6 sm:px-6 sm:py-10">
      <section className="mb-6 rounded-none app-card p-5 sm:mb-8 sm:rounded-hero sm:p-8">
        <h1 className="font-display text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
          {copy.form.createTitle}
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 app-muted">{copy.form.createDescription}</p>
      </section>

      {!viewer.user.email_confirmed_at ? (
        <p role="alert" className="rounded-none app-card p-5 text-sm leading-6 text-[color:var(--foreground)] sm:rounded-hero">
          {copy.form.errors.emailUnconfirmed}
        </p>
      ) : !options ? (
        <section className="rounded-none app-card p-6 sm:rounded-hero sm:p-8">
          <h2 className="font-display text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
            {copy.form.noCompanyTitle}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 app-muted">{copy.form.noCompanyText}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <ButtonLink href="/companies/new">{copy.form.noCompanyCta}</ButtonLink>
            <ButtonLink href="/for-companies" variant="secondary">
              {copy.form.noCompanyLearnMore}
            </ButtonLink>
          </div>
        </section>
      ) : (
        <VacancyForm
          companies={mine}
          defaultCompanyId={defaultCompanyId}
          countries={options.countries}
          categories={options.categories}
          skills={options.skills}
        />
      )}
    </main>
  );
}
