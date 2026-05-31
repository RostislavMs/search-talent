import type { Metadata } from "next";
import nextDynamic from "next/dynamic";
import { notFound, redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { getDashboardArticles } from "@/lib/db/articles";
import { createLocalePath, isLocale } from "@/lib/i18n/config";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { buildMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

const ArticleComposer = nextDynamic(
  () => import("@/components/article-composer"),
  {
    loading: () => (
      <div className="animate-pulse space-y-4 py-4">
        <div className="h-12 w-2/3 rounded-xl bg-[color:var(--surface-muted)]" />
        <div className="h-64 rounded-xl bg-[color:var(--surface-muted)]" />
      </div>
    ),
  },
);

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const isUk = locale === "uk";
  return buildMetadata({
    locale,
    pathname: "/articles/new",
    title: isUk ? "Нова стаття" : "New article",
    description: isUk
      ? "Створіть нову статтю на SearchTalent."
      : "Create a new article on SearchTalent.",
    noindex: true,
  });
}

export default async function NewArticlePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const [viewer, dashboard] = await Promise.all([
    getCurrentViewerRole(),
    getDashboardArticles(),
  ]);

  if (!viewer.user) {
    redirect(createLocalePath(safeLocale, "/login"));
  }

  if (!dashboard) {
    redirect(createLocalePath(safeLocale, "/dashboard"));
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("user_id", viewer.user.id)
    .maybeSingle();

  const username = profile?.username || null;

  const ui =
    safeLocale === "uk"
      ? {
          title: "Нова стаття",
          description:
            "Простір для створення матеріалу. Ліворуч редактор, праворуч параметри публікації.",
          openFeed: "Відкрити статті",
          myArticles: "Мої статті",
        }
      : {
          title: "New article",
          description:
            "A dedicated writing space. Use the editor canvas below and tune publishing settings on the side.",
          openFeed: "Open articles",
          myArticles: "My articles",
        };

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6">
      <section className="rounded-hero app-card p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-3xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-4xl">
              {ui.title}
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-8 app-muted">
              {ui.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {username ? (
              <ButtonLink href={`/u/${username}/articles`} variant="secondary">
                {ui.myArticles}
              </ButtonLink>
            ) : null}
            <ButtonLink href="/articles" variant="ghost">
              {ui.openFeed}
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <ArticleComposer
          locale={safeLocale}
          categories={dashboard.categories}
          isAdmin={viewer.isAdmin}
        />
      </section>
    </main>
  );
}
