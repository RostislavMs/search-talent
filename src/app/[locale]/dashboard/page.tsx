import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { getDashboardStats, getUserDashboardStats } from "@/lib/db/dashboard";

const DashboardAnalytics = dynamic(
  () => import("@/components/dashboard-analytics"),
);
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
    pathname: "/dashboard",
    title: dictionary.metadata.dashboard.title,
    description: dictionary.metadata.dashboard.description,
    noindex: true,
  });
}

export default async function DashboardPage({
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
  const [viewer, stats, userStats] = await Promise.all([
    getCurrentViewerRole(),
    getDashboardStats(),
    getUserDashboardStats(user.id),
  ]);

  const greeting = userStats.name
    ? `${dictionary.dashboard.welcomeBack}, ${userStats.name}`
    : dictionary.dashboard.welcomeBack;

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
          {greeting}
        </h1>
        <p className="mt-1 text-sm app-muted">
          {dictionary.dashboard.updatedDaily}
        </p>
      </div>

      <DashboardAnalytics
        dictionary={dictionary}
        locale={locale}
        stats={stats}
        userStats={userStats}
        isAdmin={viewer.isAdmin}
      />
    </main>
  );
}
