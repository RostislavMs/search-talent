import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { getPlatformStats } from "@/lib/db/stats";

const PlatformAnalytics = dynamic(
  () => import("@/components/platform-analytics"),
  {
    loading: () => (
      <div className="grid animate-pulse gap-8 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-64 rounded-2xl bg-[color:var(--surface-muted)]"
          />
        ))}
      </div>
    ),
  },
);
import { createLocalePath, isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
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
    pathname: "/analytics",
    title: dictionary.metadata.analytics.title,
    description: dictionary.metadata.analytics.description,
    noindex: true,
  });
}

export default async function AnalyticsPage({
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
  const stats = await getPlatformStats();

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
          {dictionary.analytics.title}
        </h1>
        <p className="mt-1 text-sm app-muted">
          {dictionary.analytics.updatedDaily}
        </p>
      </div>

      <PlatformAnalytics
        dictionary={dictionary}
        locale={locale}
        stats={stats}
      />
    </main>
  );
}
