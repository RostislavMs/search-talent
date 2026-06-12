import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import DeletePollButton from "@/components/delete-poll-button";
import PollInteractions from "@/components/poll-interactions";
import PollPinButton from "@/components/poll-pin-button";
import PollVoting from "@/components/poll-voting";
import RichTextRenderer from "@/components/rich-text-renderer";
import { ButtonLink } from "@/components/ui/Button";
import OptimizedImage from "@/components/ui/optimized-image";
import { formatArticleDate, getCategoryDisplayName } from "@/lib/articles";
import { getPollClosesLabel } from "@/lib/polls";
import { getPollDetail } from "@/lib/db/polls";
import { isLocale } from "@/lib/i18n/config";
import { isPublicModerationStatus, normalizeModerationStatus } from "@/lib/moderation";
import { extractPlainTextFromRichText } from "@/lib/rich-text-plain";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getModerationLabel(status: string | null, locale: string) {
  switch (normalizeModerationStatus(status)) {
    case "under_review":
      return locale === "uk" ? "На перевірці" : "Under review";
    case "restricted":
      return locale === "uk" ? "Обмежено" : "Restricted";
    case "removed":
      return locale === "uk" ? "Прибрано" : "Removed";
    default:
      return locale === "uk" ? "Схвалено" : "Approved";
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const data = await getPollDetail(slug, safeLocale);

  const isThin =
    !data ||
    data.poll.status !== "published" ||
    !isPublicModerationStatus(data.poll.moderationStatus ?? null);
  const excerpt =
    data?.poll.excerpt ||
    (data?.poll.content ? extractPlainTextFromRichText(data.poll.content) : null);

  return buildMetadata({
    locale: safeLocale,
    pathname: `/polls/${slug}`,
    title: data?.poll.title || (safeLocale === "uk" ? "Опитування" : "Poll"),
    description:
      excerpt || (safeLocale === "uk" ? "Опитування спільноти" : "Community poll"),
    noindex: isThin,
  });
}

export default async function PollDetailPage({
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

  const { poll, viewerUserId, isOwner, isAdmin } = data;
  const isUk = safeLocale === "uk";
  const authorLabel = poll.authorDeleted
    ? isUk
      ? "Видалений користувач"
      : "Deleted user"
    : poll.author?.name || poll.author?.username || "SearchTalent";
  const authorInitial = authorLabel.slice(0, 1).toUpperCase();

  const ui = isUk
    ? {
        back: "Усі опитування",
        edit: "Редагувати",
        published: "Опубліковано",
        category: "Категорія",
        draft: "Чернетка",
        moderatorNote: "Нотатка модератора",
      }
    : {
        back: "All polls",
        edit: "Edit",
        published: "Published",
        category: "Category",
        draft: "Draft",
        moderatorNote: "Moderator note",
      };

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="rounded-hero app-card">
        <div className="border-b app-border p-6 sm:p-8">
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/polls" variant="secondary">
              {ui.back}
            </ButtonLink>
            {isOwner ? (
              <>
                <ButtonLink href={`/polls/edit/${poll.id}`} variant="ghost">
                  {ui.edit}
                </ButtonLink>
                <DeletePollButton pollId={poll.id} locale={safeLocale} redirectHref="/polls" />
              </>
            ) : null}
            {isAdmin ? (
              <PollPinButton
                pollId={poll.id}
                currentPinnedUntil={poll.pinnedUntil}
                locale={safeLocale}
              />
            ) : null}
            {!isOwner && isAdmin ? (
              <DeletePollButton
                pollId={poll.id}
                locale={safeLocale}
                redirectHref="/polls"
                adminEndpoint
              />
            ) : null}
            {poll.status === "draft" ? (
              <span className="rounded-full bg-white/8 px-4 py-2 text-sm font-medium text-[color:var(--foreground)]">
                {ui.draft}
              </span>
            ) : null}
            {(isOwner || isAdmin) && (
              <span className="rounded-full border app-border px-4 py-2 text-sm app-muted">
                {getModerationLabel(poll.moderationStatus, safeLocale)}
              </span>
            )}
          </div>

          <h1 className="font-display mt-6 text-4xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-5xl">
            {poll.title}
          </h1>

          {poll.excerpt ? <p className="mt-5 text-lg leading-8 app-muted">{poll.excerpt}</p> : null}

          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm app-muted">
            {poll.author?.username ? (
              <Link
                href={`/${safeLocale}/u/${poll.author.username}`}
                className="flex items-center gap-3 transition hover:opacity-80"
              >
                <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border app-border bg-[color:var(--surface-muted)] text-sm font-semibold text-[color:var(--foreground)]">
                  {poll.author.avatarUrl ? (
                    <OptimizedImage
                      src={poll.author.avatarUrl}
                      alt={authorLabel}
                      fill
                      sizes="44px"
                      className="object-cover"
                    />
                  ) : (
                    <span>{authorInitial}</span>
                  )}
                </span>
                <span className="underline underline-offset-4 decoration-[color:var(--border)]">
                  {authorLabel}
                </span>
              </Link>
            ) : (
              <span className="flex items-center gap-3">
                <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border app-border bg-[color:var(--surface-muted)] text-sm font-semibold text-[color:var(--foreground)]">
                  <span>{authorInitial}</span>
                </span>
                <span>{authorLabel}</span>
              </span>
            )}
            <span>
              {ui.published}: {formatArticleDate(poll.publishedAt || poll.createdAt, safeLocale)}
            </span>
            <span>{getCategoryDisplayName(poll.category, safeLocale)}</span>
            <span>{getPollClosesLabel(poll.closesAt, safeLocale)}</span>
          </div>

          {(isOwner || isAdmin) && poll.moderationNote ? (
            <div className="mt-5 rounded-[1.4rem] app-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
                {ui.moderatorNote}
              </p>
              <p className="mt-2 text-sm leading-7 app-muted">{poll.moderationNote}</p>
            </div>
          ) : null}
        </div>

        {poll.coverImageUrl ? (
          <div className="relative aspect-[16/8]">
            <OptimizedImage
              src={poll.coverImageUrl}
              alt={poll.title}
              fill
              sizes="(max-width: 768px) 100vw, 900px"
              className="object-cover"
            />
          </div>
        ) : null}

        <div className="grid gap-8 p-6 sm:p-8">
          {poll.content && extractPlainTextFromRichText(poll.content) ? (
            <section className="space-y-6">
              <RichTextRenderer content={poll.content} accentColor="var(--brand)" />
            </section>
          ) : null}

          <PollVoting
            locale={safeLocale}
            pollId={poll.id}
            questions={poll.questions}
            hasVoted={poll.hasVoted}
            isClosed={poll.isClosed}
            resultsVisible={poll.resultsVisible}
            isAuthenticated={Boolean(viewerUserId)}
          />

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
          />
        </div>
      </div>
    </main>
  );
}
