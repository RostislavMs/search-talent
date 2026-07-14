import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import MySpaceStats from "@/components/my-space-stats";
import { getUserStats } from "@/lib/db/stats";
import { createLocalePath, isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { buildMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

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
    pathname: "/my-space",
    title: dictionary.metadata.mySpace.title,
    description: dictionary.metadata.mySpace.description,
    noindex: true,
  });
}

export default async function MySpacePage({
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
  const [viewer, userStats] = await Promise.all([
    getCurrentViewerRole(),
    getUserStats(user.id),
  ]);

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
          {dictionary.mySpace.title}
        </h1>
        <p className="mt-1 text-sm app-muted">
          {dictionary.mySpace.description}
        </p>
      </div>

      <MySpaceStats
        dictionary={dictionary}
        locale={locale}
        userStats={userStats}
        isAdmin={viewer.isAdmin}
      />
    </main>
  );
}
