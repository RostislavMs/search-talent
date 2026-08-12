import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DiscussionPageShell from "@/components/discussion-page-shell";
import ProjectComments from "@/components/project-comments";
import { getPublicProjectPageData } from "@/lib/db/public";
import { isGifSearchConfigured } from "@/lib/gif/provider";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * The project's comment thread at its own URL. See the article variant for why
 * this page is auto-promoted, stores nothing, and is always `noindex`.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(safeLocale);
  const data = await getPublicProjectPageData(slug);
  const title = data?.project.title || dictionary.discussions.sectionTitle;

  return buildMetadata({
    locale: safeLocale,
    pathname: `/projects/${slug}/discussion`,
    title: dictionary.discussions.metaTitle.replace("{title}", title),
    description: dictionary.discussions.metaDescription.replace(
      "{title}",
      title,
    ),
    noindex: true,
  });
}

export default async function ProjectDiscussionPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const safeLocale = locale as Locale;
  const [data, viewer] = await Promise.all([
    getPublicProjectPageData(slug),
    getCurrentViewerRole(),
  ]);

  if (!data) {
    notFound();
  }

  const dictionary = getDictionary(safeLocale);

  return (
    <DiscussionPageShell
      locale={safeLocale}
      parentHref={`/projects/${slug}`}
      parentTitle={data.project.title}
      backLabel={dictionary.discussions.backToProject}
    >
      <ProjectComments
        projectId={data.project.id}
        isAuthenticated={data.isAuthenticated}
        viewerUserId={viewer.user?.id ?? null}
        ownerUserId={data.project.owner_id}
        gifEnabled={isGifSearchConfigured()}
      />
    </DiscussionPageShell>
  );
}
