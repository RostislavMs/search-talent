import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import CompanyForm from "@/components/company-form";
import { buildLoginHref } from "@/lib/auth/redirect";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { buildMetadata, getSiteUrl } from "@/lib/seo";

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
  const copy = getDictionary(locale).companies.meta;

  return buildMetadata({
    locale,
    pathname: "/companies/new",
    title: copy.newTitle,
    description: copy.newDescription,
    noindex: true,
  });
}

export default async function NewCompanyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await resolveLocale(params);
  const viewer = await getCurrentViewerRole();

  if (!viewer.user) {
    redirect(buildLoginHref(locale, "/companies/new"));
  }

  const copy = getDictionary(locale).companies;
  const { data: countries } = await viewer.supabase
    .from("countries")
    .select("id, name")
    .order("name");

  return (
    <main className="mx-auto max-w-3xl px-0 py-6 sm:px-6 sm:py-10">
      <section className="rounded-none app-card p-5 sm:rounded-hero sm:p-8">
        <h1 className="font-display text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
          {copy.form.createTitle}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 app-muted">
          {copy.form.createDescription}
        </p>

        <div className="mt-8">
          {viewer.user.email_confirmed_at ? (
            <CompanyForm
              countries={(countries ?? []) as Array<{ id: number; name: string }>}
              siteHost={new URL(getSiteUrl()).host}
            />
          ) : (
            <p role="alert" className="rounded-2xl app-panel p-4 text-sm leading-6 text-[color:var(--foreground)]">
              {copy.form.errors.emailUnconfirmed}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
