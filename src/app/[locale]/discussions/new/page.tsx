import type { Metadata } from "next";
import { redirect } from "next/navigation";
import TopicComposer from "@/components/topic-composer";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(safeLocale);

  return buildMetadata({
    locale: safeLocale,
    pathname: "/discussions/new",
    title: dictionary.discussions.newTopicTitle,
    description: dictionary.discussions.newTopicDescription,
    noindex: true,
  });
}

export default async function NewTopicPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const viewer = await getCurrentViewerRole();

  if (!viewer.user) {
    redirect(`/${safeLocale}/login`);
  }

  const dictionary = getDictionary(safeLocale);
  const ui = dictionary.discussions;

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-4xl">
          {ui.newTopicTitle}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 app-muted sm:text-base">
          {ui.newTopicDescription}
        </p>
      </header>

      <TopicComposer locale={safeLocale} />
    </main>
  );
}
