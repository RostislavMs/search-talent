import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PollCard from "@/components/poll-card";
import DeletePollButton from "@/components/delete-poll-button";
import { ButtonLink } from "@/components/ui/Button";
import { getCategoryDisplayName } from "@/lib/articles";
import { getPollClosesLabel } from "@/lib/polls";
import { getDashboardPolls } from "@/lib/db/polls";
import { getUserPollsPage } from "@/lib/db/public";
import { isPublicModerationStatus, normalizeModerationStatus } from "@/lib/moderation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getRouteParams(params: Promise<{ locale: string; username: string }>) {
  const { locale, username } = await params;
  if (!isLocale(locale)) notFound();
  return { locale, username };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; username: string }>;
}): Promise<Metadata> {
  const { locale, username } = await getRouteParams(params);

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, moderation_status")
    .eq("username", username)
    .maybeSingle();

  const displayName = profile?.name?.trim() || `@${username}`;
  const pollsLabel = locale === "uk" ? "Опитування" : "Polls";
  const description =
    locale === "uk"
      ? `Опитування автора ${displayName} на SearchTalent.`
      : `Polls by ${displayName} on SearchTalent.`;

  return buildMetadata({
    locale,
    pathname: `/u/${username}/polls`,
    title: `${pollsLabel} — ${displayName}`,
    description,
    noindex: !profile || !isPublicModerationStatus(profile.moderation_status),
  });
}

function getOwnerUi(locale: string) {
  if (locale === "uk") {
    return {
      eyebrow: "Ваші опитування",
      title: "Мої опитування",
      description:
        "Керуйте опублікованими опитуваннями та чернетками. Створюйте нові або редагуйте наявні.",
      backToProfile: "До профілю",
      createPoll: "Нове опитування",
      openFeed: "Стрічка опитувань",
      empty: "У вас ще немає опитувань. Почніть із нового.",
      draft: "Чернетка",
      published: "Опубліковано",
      openPoll: "Відкрити",
      editPoll: "Редагувати",
      votes: "Голоси",
      comments: "Коментарі",
      note: "Нотатка модератора",
    };
  }
  return {
    eyebrow: "Your polls",
    title: "My polls",
    description: "Manage your drafts and published polls. Create new ones or edit existing.",
    backToProfile: "Back to profile",
    createPoll: "New poll",
    openFeed: "Polls feed",
    empty: "You don't have any polls yet. Start a new one.",
    draft: "Draft",
    published: "Published",
    openPoll: "Open",
    editPoll: "Edit",
    votes: "Votes",
    comments: "Comments",
    note: "Moderator note",
  };
}

function formatModerationBadge(status: string | null, locale: string) {
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

export default async function UserPollsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; username: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, username } = await getRouteParams(params);
  const dictionary = getDictionary(locale);
  const { page } = await searchParams;
  const requestedPage = Number.parseInt(page || "1", 10);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isOwner = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("user_id", user.id)
      .maybeSingle();
    isOwner = profile?.username === username;
  }

  if (isOwner) {
    return renderOwnerView({ locale, username });
  }

  return renderPublicView({
    locale,
    username,
    page: requestedPage,
    dictionary,
  });
}

async function renderOwnerView({ locale, username }: { locale: string; username: string }) {
  const dashboard = await getDashboardPolls(locale);
  const ui = getOwnerUi(locale);

  if (!dashboard) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 sm:py-10">
      <section className="rounded-hero app-card p-5 sm:p-8 md:p-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-eyebrow app-soft">
              {ui.eyebrow}
            </p>
            <h1 className="font-display mt-3 text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
              {ui.title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 app-muted">{ui.description}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/polls/new">{ui.createPoll}</ButtonLink>
            <ButtonLink href="/polls" variant="secondary">
              {ui.openFeed}
            </ButtonLink>
            <ButtonLink href={`/u/${username}`} variant="ghost">
              {ui.backToProfile}
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="mt-6 sm:mt-8">
        {dashboard.items.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {dashboard.items.map((item) => (
              <article key={item.id} className="rounded-panel app-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold text-[color:var(--foreground)]">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm app-muted">
                      {getCategoryDisplayName(item.category, locale)} ·{" "}
                      {getPollClosesLabel(item.closesAt, locale)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full app-panel px-4 py-2 text-sm app-muted">
                      {item.status === "published" ? ui.published : ui.draft}
                    </span>
                    <span className="rounded-full border app-border px-4 py-2 text-sm app-muted">
                      {formatModerationBadge(item.moderationStatus, locale)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-4 text-sm app-muted">
                  <span>
                    {ui.votes}: {item.responsesCount}
                  </span>
                  <span>
                    {ui.comments}: {item.commentsCount}
                  </span>
                </div>

                {item.moderationNote ? (
                  <div className="mt-4 rounded-2xl app-panel p-4">
                    <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
                      {ui.note}
                    </p>
                    <p className="mt-2 text-sm leading-7 app-muted">{item.moderationNote}</p>
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-3">
                  <ButtonLink href={`/polls/${item.slug}`} variant="ghost" size="sm">
                    {ui.openPoll}
                  </ButtonLink>
                  <ButtonLink href={`/polls/edit/${item.id}`} variant="ghost" size="sm">
                    {ui.editPoll}
                  </ButtonLink>
                  <DeletePollButton pollId={item.id} locale={locale} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-panel app-panel-dashed p-6">
            <p className="text-sm app-muted">{ui.empty}</p>
            <div className="mt-4">
              <ButtonLink href="/polls/new" size="sm">
                {ui.createPoll}
              </ButtonLink>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

async function renderPublicView({
  locale,
  username,
  page,
  dictionary,
}: {
  locale: string;
  username: string;
  page: number;
  dictionary: ReturnType<typeof getDictionary>;
}) {
  const result = await getUserPollsPage(username, {
    page: Number.isFinite(page) ? page : 1,
    perPage: 12,
  });

  if (!result) {
    notFound();
  }

  const displayName = result.profile.name || `@${result.profile.username}` || username;
  const heading = locale === "uk" ? "Опитування" : "Polls";
  const empty = locale === "uk" ? "Ще немає опублікованих опитувань." : "No published polls yet.";
  const backToProfile = dictionary.creatorProfile.backToProfile;
  const previous = dictionary.dashboardProjects.previousPage;
  const next = dictionary.dashboardProjects.nextPage;
  const pageLabel = dictionary.dashboardProjects.pageLabel;

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 sm:py-10">
      <section className="rounded-hero app-card p-5 sm:p-8 md:p-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-eyebrow app-soft">{heading}</p>
            <h1 className="font-display mt-3 text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
              {displayName}
            </h1>
            <p className="mt-2 text-sm app-muted">
              {result.totalCount} {locale === "uk" ? "опитувань" : "polls"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <ButtonLink href={`/u/${username}`} variant="ghost">
              {backToProfile}
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="mt-6 sm:mt-8">
        {result.polls.length > 0 ? (
          <>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {result.polls.map((poll) => (
                <PollCard key={poll.id} poll={poll} locale={locale} />
              ))}
            </div>

            {result.totalPages > 1 ? (
              <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm app-muted">
                  {pageLabel} {result.currentPage} / {result.totalPages}
                </span>

                <div className="flex gap-3">
                  {result.currentPage > 1 ? (
                    <ButtonLink
                      href={`/u/${username}/polls?page=${result.currentPage - 1}`}
                      variant="ghost"
                      size="sm"
                    >
                      {previous}
                    </ButtonLink>
                  ) : null}

                  {result.currentPage < result.totalPages ? (
                    <ButtonLink
                      href={`/u/${username}/polls?page=${result.currentPage + 1}`}
                      variant="secondary"
                      size="sm"
                    >
                      {next}
                    </ButtonLink>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-panel app-card p-6">
            <p className="text-sm app-muted">{empty}</p>
          </div>
        )}
      </section>
    </main>
  );
}
