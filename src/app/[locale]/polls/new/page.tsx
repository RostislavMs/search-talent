import type { Metadata } from "next";
import nextDynamic from "next/dynamic";
import { notFound, redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { getPollCategories } from "@/lib/db/polls";
import { createLocalePath, isLocale } from "@/lib/i18n/config";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { buildMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

const PollComposer = nextDynamic(() => import("@/components/poll-composer"), {
  loading: () => (
    <div className="animate-pulse space-y-4 py-4">
      <div className="h-12 w-2/3 rounded-xl bg-[color:var(--surface-muted)]" />
      <div className="h-64 rounded-xl bg-[color:var(--surface-muted)]" />
    </div>
  ),
});

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const isUk = locale === "uk";
  return buildMetadata({
    locale,
    pathname: "/polls/new",
    title: isUk ? "Нове опитування" : "New poll",
    description: isUk ? "Створіть нове опитування на SearchTalent." : "Create a new poll on SearchTalent.",
    noindex: true,
  });
}

export default async function NewPollPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const [viewer, categories] = await Promise.all([getCurrentViewerRole(), getPollCategories()]);

  if (!viewer.user) {
    redirect(createLocalePath(safeLocale, "/login"));
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("user_id", viewer.user.id)
    .maybeSingle();
  const username = profile?.username || null;

  const isUk = safeLocale === "uk";
  const ui = isUk
    ? {
        title: "Нове опитування",
        description:
          "Простір для створення опитування. Ліворуч редактор та питання, праворуч параметри публікації.",
        openFeed: "Відкрити опитування",
        myPolls: "Мої опитування",
      }
    : {
        title: "New poll",
        description:
          "A dedicated space to build a poll. Use the editor and questions on the left and tune publishing settings on the side.",
        openFeed: "Open polls",
        myPolls: "My polls",
      };

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6">
      <section className="rounded-hero app-card p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-4xl">
              {ui.title}
            </h1>
            <p className="mt-3 hidden max-w-3xl text-base leading-8 app-muted xl:block">
              {ui.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {username ? (
              <ButtonLink href={`/u/${username}/polls`} variant="secondary">
                {ui.myPolls}
              </ButtonLink>
            ) : null}
            <ButtonLink href="/polls" variant="ghost">
              {ui.openFeed}
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <PollComposer locale={safeLocale} categories={categories} isAdmin={viewer.isAdmin} />
      </section>
    </main>
  );
}
