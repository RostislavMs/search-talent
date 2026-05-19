import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminOverviewStats } from "@/lib/db/admin";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/lib/seo";

async function resolveLocale(params: Promise<{ locale: string }>): Promise<Locale> {
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
  const locale = await resolveLocale(params);
  const dictionary = getDictionary(locale);
  return buildMetadata({
    locale,
    pathname: "/admin",
    title: `${dictionary.admin.overview.title} · ${dictionary.admin.shell.title}`,
    description: dictionary.admin.overview.description,
    noindex: true,
  });
}

export default async function AdminOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await resolveLocale(params);
  const dictionary = getDictionary(locale);
  const copy = dictionary.admin.overview;
  const stats = await getAdminOverviewStats();

  const cards = [
    { label: copy.totalUsers, value: stats.totalUsers, tone: "strong" as const },
    { label: copy.totalAdmins, value: stats.totalAdmins, tone: "strong" as const },
    { label: copy.totalProfiles, value: stats.totalProfiles, tone: "soft" as const },
    { label: copy.totalProjects, value: stats.totalProjects, tone: "soft" as const },
    { label: copy.totalArticles, value: stats.totalArticles, tone: "soft" as const },
    { label: copy.openReports, value: stats.openReports, tone: "alert" as const },
    { label: copy.urgentReports, value: stats.urgentReports, tone: "alert" as const },
    { label: copy.newFeedback, value: stats.newFeedback, tone: "soft" as const },
  ];

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] app-card p-8">
        <h2 className="text-2xl font-semibold text-[color:var(--foreground)]">
          {copy.title}
        </h2>
        <p className="mt-2 max-w-2xl app-muted">{copy.description}</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <article
              key={card.label}
              className={[
                "rounded-[1.25rem] p-5",
                card.tone === "alert"
                  ? "app-panel border border-[color:var(--border)]"
                  : "app-panel",
              ].join(" ")}
            >
              <p className="text-sm app-soft">{card.label}</p>
              <p className="mt-3 text-3xl font-semibold text-[color:var(--foreground)]">
                {card.value}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
