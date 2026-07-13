import type { Metadata } from "next";
import nextDynamic from "next/dynamic";
import { redirect, notFound } from "next/navigation";
import { getArticleCategories } from "@/lib/db/articles";
import { loadCoAuthorsForEditor } from "@/lib/db/co-authors";
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
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const isUk = locale === "uk";
  return buildMetadata({
    locale,
    pathname: "/articles/edit",
    title: isUk ? "Редагування статті" : "Edit article",
    description: isUk
      ? "Редагування статті на SearchTalent."
      : "Edit an article on SearchTalent.",
    noindex: true,
  });
}

export default async function EditArticlePage({
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
  const { data: article } = await supabase
    .from("articles")
    .select(
      "id, author_user_id, category_id, title, slug, excerpt, content, cover_image_url, cover_image_storage_path, hero_video_url, hero_video_storage_path, status, content_locale, translations",
    )
    .eq("id", id)
    .maybeSingle();

  if (!article) {
    notFound();
  }

  if (article.author_user_id !== viewer.user.id && !viewer.isAdmin) {
    notFound();
  }

  const categories = await getArticleCategories();
  const categoryRow = article.category_id
    ? categories.find((c) => c.id === article.category_id)
    : null;
  const coAuthors = await loadCoAuthorsForEditor(supabase, "article", article.id);

  type StoredVersion = {
    title?: string | null;
    excerpt?: string | null;
    content?: string | null;
    cover_image_url?: string | null;
    cover_image_storage_path?: string | null;
    hero_video_url?: string | null;
    hero_video_storage_path?: string | null;
  };

  const rawTranslations = (article.translations || {}) as Record<
    string,
    StoredVersion
  >;
  const translations = Object.fromEntries(
    Object.entries(rawTranslations).map(([loc, version]) => [
      loc,
      {
        title: version?.title || "",
        excerpt: version?.excerpt || null,
        content: version?.content || "",
        coverImageUrl: version?.cover_image_url || null,
        coverImageStoragePath: version?.cover_image_storage_path || null,
        heroVideoUrl: version?.hero_video_url || null,
        heroVideoStoragePath: version?.hero_video_storage_path || null,
      },
    ]),
  );

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6">
      <ArticleComposer
        locale={safeLocale}
        categories={categories}
        isAdmin={viewer.isAdmin}
        editArticle={{
          id: article.id,
          title: article.title,
          excerpt: article.excerpt || null,
          content: article.content || "",
          categorySlug: categoryRow?.slug || categories[0]?.slug || "",
          status: article.status === "published" ? "published" : "draft",
          coverImageUrl: article.cover_image_url || null,
          coverImageStoragePath: article.cover_image_storage_path || null,
          heroVideoUrl: article.hero_video_url || null,
          heroVideoStoragePath: article.hero_video_storage_path || null,
          contentLocale: article.content_locale === "en" ? "en" : "uk",
          translations,
          coAuthors,
        }}
      />
    </main>
  );
}
