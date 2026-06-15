import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PollModerationTable from "@/components/admin/poll-moderation-table";
import { getPollModerationQueue } from "@/lib/db/polls";
import { createLocalePath, isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getModerationCopy } from "@/lib/moderation-copy";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function resolveLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const dictionary = getDictionary(locale);
  const isUk = locale === "uk";
  return buildMetadata({
    locale,
    pathname: "/admin/content/polls",
    title: `${isUk ? "Опитування" : "Polls"} · ${dictionary.admin.shell.title}`,
    description: isUk ? "Модерація опитувань спільноти." : "Moderate community polls.",
    noindex: true,
  });
}

export default async function AdminPollsContentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await resolveLocale(params);
  const dictionary = getDictionary(locale);
  const copy = dictionary.admin.content;
  const moderationCopy = getModerationCopy(locale);
  const isUk = locale === "uk";

  const queue = await getPollModerationQueue(locale);

  if (!queue) {
    notFound();
  }

  function formatDate(value: string | null) {
    if (!value) return "—";
    try {
      return new Intl.DateTimeFormat(isUk ? "uk-UA" : "en-US", {
        dateStyle: "medium",
      }).format(new Date(value));
    } catch {
      return value;
    }
  }

  const items = queue.map((poll) => ({
    id: poll.id,
    title: poll.title,
    href: createLocalePath(locale, `/polls/${poll.slug}`),
    authorLabel: poll.authorDeleted
      ? isUk
        ? "Видалений користувач"
        : "Deleted user"
      : poll.author?.name || poll.author?.username || (isUk ? "Автор" : "Author"),
    moderationStatus: poll.moderationStatus,
    createdAtLabel: formatDate(poll.createdAt),
    responsesCount: poll.responsesCount,
    commentsCount: poll.commentsCount,
  }));

  return (
    <div className="space-y-6">
      <section className="rounded-hero app-card p-5 sm:p-8">
        <h2 className="font-display text-xl sm:text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
          {isUk ? "Опитування" : "Polls"}
        </h2>
        <p className="mt-2 max-w-3xl app-muted">
          {isUk
            ? "Усі опитування на платформі. Змінюйте видимість або видаляйте записи."
            : "All polls on the platform. Change visibility or remove items."}
        </p>
      </section>

      <section className="rounded-hero app-card p-4 sm:p-6">
        {items.length === 0 ? (
          <div className="rounded-3xl app-panel-dashed p-8 text-center">
            <p className="text-sm app-muted">{copy.empty}</p>
          </div>
        ) : (
          <PollModerationTable
            items={items}
            locale={locale}
            statusLabels={moderationCopy.statusLabels}
            columnLabels={{
              title: copy.columns.title,
              author: copy.columns.author,
              status: copy.columns.status,
              created: copy.columns.created,
              engagement: copy.columns.engagement,
              actions: copy.columns.actions,
            }}
            openLabel={copy.openItem}
            errorFallback={copy.errorFallback}
            redirectAfterDelete={createLocalePath(locale, "/admin/content/polls")}
          />
        )}
      </section>
    </div>
  );
}
