import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import VacancyForm from "@/components/vacancy-form";
import VacancyStatusActions from "@/components/vacancy-status-actions";
import { ButtonLink } from "@/components/ui/Button";
import { buildLoginHref } from "@/lib/auth/redirect";
import { canEditCompany } from "@/lib/companies";
import { getCompanyRole } from "@/lib/db/companies";
import { getVacancyById, getVacancyFormOptions } from "@/lib/db/vacancies";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { buildMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { buildVacancyPath } from "@/lib/vacancies";
import { routeVacancyIdSchema } from "@/lib/validation/vacancies";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = Promise<{ locale: string; id: string }>;

async function resolveParams(params: RouteParams): Promise<{ locale: Locale; id: string }> {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const parsed = routeVacancyIdSchema.safeParse({ id });
  if (!parsed.success) notFound();
  return { locale, id: parsed.data.id };
}

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const { locale, id } = await resolveParams(params);
  const copy = getDictionary(locale).vacancies;
  const supabase = await createClient();
  const { data } = await supabase.from("vacancies").select("title").eq("id", id).maybeSingle();
  const title = (data as { title?: string } | null)?.title;

  return buildMetadata({
    locale,
    pathname: `/jobs/edit/${id}`,
    title: title ? copy.meta.editTitle.replace("{title}", title) : copy.form.editTitle,
    description: copy.meta.newDescription,
    noindex: true,
  });
}

export default async function EditVacancyPage({ params }: { params: RouteParams }) {
  const { locale, id } = await resolveParams(params);
  const viewer = await getCurrentViewerRole();

  if (!viewer.user) {
    redirect(buildLoginHref(locale, `/jobs/edit/${id}`));
  }

  const vacancy = await getVacancyById(viewer.supabase, id);
  const role = vacancy
    ? await getCompanyRole(viewer.supabase, vacancy.company.id, viewer.user.id)
    : null;

  // RLS shows approved vacancies to everyone; the editor is for the team only.
  if (!vacancy || (!role && !viewer.isAdmin)) {
    notFound();
  }

  const copy = getDictionary(locale).vacancies;
  const options = await getVacancyFormOptions(viewer.supabase);
  const canDelete =
    viewer.isAdmin || canEditCompany(role) || vacancy.authorUserId === viewer.user.id;

  return (
    <main className="mx-auto max-w-[90rem] px-0 py-6 sm:px-6 sm:py-10">
      <section className="mb-6 rounded-none app-card p-5 sm:mb-8 sm:rounded-hero sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-eyebrow app-soft">
              {copy.form.editTitle}
            </p>
            <h1 className="font-display mt-3 break-words text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
              {vacancy.title}
            </h1>
            <p className="mt-2 text-sm app-muted">
              {vacancy.company.name} · {copy.states[vacancy.state]}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={buildVacancyPath(vacancy.slug)} variant="secondary" size="sm">
              {copy.form.openPage}
            </ButtonLink>
            <VacancyStatusActions
              vacancyId={vacancy.id}
              title={vacancy.title}
              status={vacancy.status}
              expiresAt={vacancy.expiresAt}
              canDelete={canDelete}
              showEdit={false}
              showPublish={false}
            />
          </div>
        </div>
      </section>

      <VacancyForm
        vacancy={vacancy}
        companies={[
          { id: vacancy.company.id, name: vacancy.company.name, verified: vacancy.company.verified },
        ]}
        countries={options.countries}
        categories={options.categories}
        skills={options.skills}
      />
    </main>
  );
}
