import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import CompanyDeleteSection from "@/components/company-delete-section";
import CompanyForm from "@/components/company-form";
import CompanyProjectsManager from "@/components/company-projects-manager";
import CompanyTeamManager from "@/components/company-team-manager";
import CompanyVerificationCard from "@/components/company-verification-card";
import { ButtonLink } from "@/components/ui/Button";
import { buildLoginHref } from "@/lib/auth/redirect";
import {
  buildCompanyPath,
  canDeleteCompany,
  canEditCompany,
  checkCompanyEmailDomain,
  getCompanyWebsiteHost,
} from "@/lib/companies";
import {
  getCompanyById,
  getCompanyRole,
  listAttachableProjects,
  listCompanyProjects,
  listCompanyTeam,
} from "@/lib/db/companies";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { buildMetadata, getSiteUrl } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { routeCompanyIdSchema } from "@/lib/validation/companies";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = Promise<{ locale: string; id: string }>;

async function resolveParams(params: RouteParams): Promise<{ locale: Locale; id: string }> {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const parsed = routeCompanyIdSchema.safeParse({ id });
  if (!parsed.success) notFound();
  return { locale, id: parsed.data.id };
}

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const { locale, id } = await resolveParams(params);
  const copy = getDictionary(locale).companies;
  const supabase = await createClient();
  const { data } = await supabase.from("companies").select("name").eq("id", id).maybeSingle();
  const name = (data as { name?: string } | null)?.name;

  return buildMetadata({
    locale,
    pathname: `/companies/edit/${id}`,
    title: name ? copy.meta.editTitle.replace("{name}", name) : copy.editor.eyebrow,
    description: copy.meta.newDescription,
    noindex: true,
  });
}

export default async function EditCompanyPage({ params }: { params: RouteParams }) {
  const { locale, id } = await resolveParams(params);
  const viewer = await getCurrentViewerRole();

  if (!viewer.user) {
    redirect(buildLoginHref(locale, `/companies/edit/${id}`));
  }

  const [company, role] = await Promise.all([
    getCompanyById(viewer.supabase, id),
    getCompanyRole(viewer.supabase, id, viewer.user.id),
  ]);

  // RLS shows approved pages to everyone; the editor is for the team only.
  if (!company || (!role && !viewer.isAdmin)) {
    notFound();
  }

  const copy = getDictionary(locale).companies;
  const canEdit = canEditCompany(role) || viewer.isAdmin;

  const [members, { data: countries }, projects] = await Promise.all([
    role ? listCompanyTeam(viewer.supabase, id, { includePending: true }) : Promise.resolve([]),
    viewer.supabase.from("countries").select("id, name").order("name"),
    listCompanyProjects(viewer.supabase, id),
  ]);
  const attachable = role
    ? await listAttachableProjects(
        viewer.supabase,
        viewer.user.id,
        projects.map((project) => project.id),
      )
    : [];

  const domainCheck = checkCompanyEmailDomain({
    type: company.type,
    website: company.website,
    email: viewer.user.email,
    emailConfirmed: Boolean(viewer.user.email_confirmed_at),
  });

  return (
    <main className="mx-auto max-w-[90rem] px-0 py-6 sm:px-6 sm:py-10">
      <section className="rounded-none app-card p-5 sm:rounded-hero sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-eyebrow app-soft">
              {copy.editor.eyebrow}
            </p>
            <h1 className="font-display mt-3 break-words text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
              {company.name}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={buildCompanyPath(company.slug)} variant="secondary">
              {copy.editor.openPage}
            </ButtonLink>
            <ButtonLink href="/my-space/companies" variant="ghost">
              {copy.editor.allCompanies}
            </ButtonLink>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 sm:mt-8 xl:grid-cols-[minmax(0,1fr)_26rem] xl:items-start">
        <div className="space-y-6">
          {canEdit ? (
            <section className="rounded-none app-card p-5 sm:rounded-hero sm:p-8">
              <CompanyForm
                company={company}
                countries={(countries ?? []) as Array<{ id: number; name: string }>}
                siteHost={new URL(getSiteUrl()).host}
                verified={company.verified}
              />
            </section>
          ) : (
            <p className="rounded-none app-card p-5 text-sm leading-6 app-muted sm:rounded-hero">
              {copy.editor.readOnly}
            </p>
          )}

          {role ? (
            <CompanyTeamManager
              companyId={company.id}
              companyName={company.name}
              viewerUserId={viewer.user.id}
              viewerRole={role}
              members={members}
            />
          ) : null}

          <CompanyProjectsManager
            companyId={company.id}
            viewerUserId={viewer.user.id}
            canManage={canEdit}
            isMember={Boolean(role)}
            projects={projects}
            attachable={attachable}
          />
        </div>

        <aside className="space-y-6">
          {canEditCompany(role) ? (
            <CompanyVerificationCard
              companyId={company.id}
              verified={company.verified}
              method={company.verificationMethod}
              accountCheck={domainCheck}
              websiteHost={getCompanyWebsiteHost(company.website)}
            />
          ) : null}

          {canDeleteCompany(role) ? (
            <CompanyDeleteSection companyId={company.id} companyName={company.name} />
          ) : null}
        </aside>
      </div>
    </main>
  );
}
