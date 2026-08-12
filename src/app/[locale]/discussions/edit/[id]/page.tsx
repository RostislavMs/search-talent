import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import TopicComposer from "@/components/topic-composer";
import { DISCUSSIONS_CATEGORY_SLUG } from "@/lib/articles";
import { getArticleCategories } from "@/lib/db/articles";
import { createLocalePath, isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { buildMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

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
    pathname: "/discussions/edit",
    title: dictionary.discussions.editTopicTitle,
    description: dictionary.discussions.newTopicDescription,
    noindex: true,
  });
}

export default async function EditTopicPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const viewer = await getCurrentViewerRole();

  if (!viewer.user) {
    redirect(createLocalePath(safeLocale, "/login"));
  }

  const supabase = await createClient();
  const { data: topic } = await supabase
    .from("articles")
    .select("id, author_user_id, category_id, title, content, status")
    .eq("id", id)
    .maybeSingle();

  if (!topic) {
    notFound();
  }

  if (topic.author_user_id !== viewer.user.id && !viewer.isAdmin) {
    notFound();
  }

  // Only topics may be edited through the simplified form — a real article sent
  // here would silently lose its cover, translations and co-authors on save.
  const categories = await getArticleCategories();
  const category = categories.find((item) => item.id === topic.category_id);

  if (category?.slug !== DISCUSSIONS_CATEGORY_SLUG) {
    redirect(createLocalePath(safeLocale, `/articles/edit/${id}`));
  }

  const dictionary = getDictionary(safeLocale);

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-4xl">
          {dictionary.discussions.editTopicTitle}
        </h1>
      </header>

      <TopicComposer
        locale={safeLocale}
        editTopic={{
          id: topic.id,
          title: topic.title || "",
          content: topic.content || "",
          status: topic.status === "published" ? "published" : "draft",
        }}
      />
    </main>
  );
}
