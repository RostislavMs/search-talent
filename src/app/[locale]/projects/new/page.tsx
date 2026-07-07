import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { notFound, redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { createLocalePath, isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

const CreateProjectForm = dynamic(
  () => import("@/components/create-project-form"),
  {
    loading: () => (
      <div className="animate-pulse space-y-4 py-4">
        <div className="h-10 w-1/2 rounded-xl bg-[color:var(--surface-muted)]" />
        <div className="h-48 rounded-xl bg-[color:var(--surface-muted)]" />
      </div>
    ),
  },
);

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
    pathname: "/projects/new",
    title: dictionary.forms.createProject,
    description: dictionary.metadata.dashboardProjects.description,
    noindex: true,
  });
}

export default async function NewProjectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await getLocaleValue(params);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(createLocalePath(locale, "/login"));
  }

  const dictionary = getDictionary(locale);

  return (
    <main className="mx-auto max-w-7xl px-0 py-10 sm:px-6">
      <CreateProjectForm
        sidebarHeader={
          <div className="space-y-3">
            <h1 className="font-display text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
              {dictionary.forms.createProject}
            </h1>
            <ButtonLink
              href="/projects"
              variant="secondary"
              className="w-full justify-center"
            >
              {dictionary.dashboardProjects.publicCatalog}
            </ButtonLink>
          </div>
        }
      />
    </main>
  );
}
