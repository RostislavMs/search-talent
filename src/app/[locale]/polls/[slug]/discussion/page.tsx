import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DiscussionPageShell from "@/components/discussion-page-shell";
import PollInteractions from "@/components/poll-interactions";
import { getPollDetail } from "@/lib/db/polls";
import { isGifSearchConfigured } from "@/lib/gif/provider";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * The poll's comment thread at its own URL. See the article variant for why
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
  const data = await getPollDetail(slug, safeLocale);
  const title = data?.poll.title || dictionary.discussions.sectionTitle;

  return buildMetadata({
    locale: safeLocale,
    pathname: `/polls/${slug}/discussion`,
    title: dictionary.discussions.metaTitle.replace("{title}", title),
    description: dictionary.discussions.metaDescription.replace(
      "{title}",
      title,
    ),
    noindex: true,
  });
}

export default async function PollDiscussionPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const data = await getPollDetail(slug, safeLocale);

  if (!data) {
    notFound();
  }

  const { poll, viewerUserId } = data;
  const dictionary = getDictionary(safeLocale);

  return (
    <DiscussionPageShell
      locale={safeLocale}
      parentHref={`/polls/${slug}`}
      parentTitle={poll.title}
      backLabel={dictionary.discussions.backToPoll}
    >
      {poll.comments.length === 0 ? (
        <p className="rounded-3xl app-panel-dashed p-5 text-sm app-muted">
          {dictionary.discussions.empty}
        </p>
      ) : (
        <PollInteractions
          locale={safeLocale}
          pollId={poll.id}
          initialLikesCount={poll.likesCount}
          initialViewsCount={poll.viewsCount}
          initialLiked={poll.currentUserLiked}
          comments={poll.comments}
          isAuthenticated={Boolean(viewerUserId)}
          viewerUserId={viewerUserId ?? null}
          ownerUserId={poll.author?.userId ?? null}
          gifEnabled={isGifSearchConfigured()}
        />
      )}
    </DiscussionPageShell>
  );
}
