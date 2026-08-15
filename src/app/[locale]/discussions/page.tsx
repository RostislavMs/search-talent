import type { Metadata } from "next";
import DiscussionList from "@/components/discussion-list";
import { ButtonLink } from "@/components/ui/Button";
import LocalizedLink from "@/components/ui/localized-link";
import {
  getDiscussionsListing,
  type DiscussionListKind,
} from "@/lib/db/discussions";
import { DISCUSSION_CONTENT_KINDS } from "@/lib/discussions";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FILTER_KINDS: DiscussionListKind[] = ["topic", ...DISCUSSION_CONTENT_KINDS];

function parseKind(value: string | undefined): DiscussionListKind | null {
  return FILTER_KINDS.includes(value as DiscussionListKind)
    ? (value as DiscussionListKind)
    : null;
}

/**
 * The Discussions section: standalone topics plus every comment thread busy
 * enough to have earned its own page. Kept `noindex` along with the topics
 * themselves — the threads it links to are duplicates of content already
 * indexed elsewhere, and a short topic is thin on its own.
 */
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
    pathname: "/discussions",
    title: dictionary.discussions.pageTitle,
    description: dictionary.discussions.pageMetaDescription,
    noindex: true,
  });
}

export default async function DiscussionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(safeLocale);
  const ui = dictionary.discussions;

  const resolved = await searchParams;
  const rawKind = Array.isArray(resolved.kind) ? resolved.kind[0] : resolved.kind;
  const activeKind = parseKind(rawKind);

  const [listing, viewer] = await Promise.all([
    getDiscussionsListing({ kind: activeKind }),
    getCurrentViewerRole(),
  ]);

  const kindLabels: Record<DiscussionListKind, string> = {
    topic: ui.kindTopic,
    project: ui.kindProject,
    article: ui.kindArticle,
    poll: ui.kindPoll,
  };

  const metrics = [
    { value: listing.stats.topics, label: ui.statTopics },
    { value: listing.stats.threads, label: ui.statThreads },
    { value: listing.stats.comments, label: ui.statComments },
  ];

  function filterHref(kind: DiscussionListKind | null) {
    return kind ? `/discussions?kind=${kind}` : "/discussions";
  }

  const filters: Array<{ value: DiscussionListKind | null; label: string }> = [
    { value: null, label: ui.filterAll },
    ...FILTER_KINDS.map((kind) => ({ value: kind, label: kindLabels[kind] })),
  ];

  return (
    <main className="mx-auto max-w-[90rem] px-0 py-10 sm:px-6">
      {/* Same split hero as the articles and polls feeds: copy on the left, a
          brand panel on the right. The panel carries both the metrics and the
          filters — on its own the metrics left most of it empty, and the
          filters cost a whole extra row between the hero and the list. */}
      <section className="rounded-none sm:rounded-hero app-card">
        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)] lg:gap-6">
          <div className="p-5 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {ui.pageEyebrow}
            </p>
            <h1 className="mt-1.5 font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)] sm:mt-2 sm:text-4xl">
              {ui.pageTitle}
            </h1>
            {/* Clamped on phones: the full sentence pushed the list a whole
                screen down for context the title already carries. */}
            <p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-6 app-muted sm:mt-3 sm:line-clamp-none">
              {ui.pageDescription}
            </p>
            {viewer.user ? (
              <div className="mt-4 sm:mt-5">
                <ButtonLink href="/discussions/new" size="sm">
                  {ui.startTopic}
                </ButtonLink>
              </div>
            ) : null}
          </div>

          <div className="bg-brand-hero flex flex-col justify-between gap-4 rounded-none border app-border p-5 text-white shadow-[0_22px_70px_rgba(15,23,42,0.18)] sm:gap-6 sm:rounded-panel sm:p-8 lg:-my-px lg:-mr-px lg:rounded-l-panel lg:rounded-r-hero">
            {/* Three numbers say at a glance whether the room is alive, which a
                list of links cannot. */}
            <dl className="grid grid-cols-3 gap-4">
              {metrics.map((metric) => (
                <div key={metric.label}>
                  <dt className="text-xs uppercase tracking-eyebrow text-white/70">
                    {metric.label}
                  </dt>
                  <dd className="mt-0.5 font-display text-xl font-medium text-white sm:mt-1 sm:text-3xl">
                    {metric.value}
                  </dd>
                </div>
              ))}
            </dl>

            {/* Scrolls sideways on phones instead of wrapping onto a second
                row — five chips would otherwise cost another 44px of height. */}
            <nav
              aria-label={ui.filterAll}
              className="-mx-1 flex gap-2 overflow-x-auto border-t border-white/20 px-1 pt-4 sm:flex-wrap sm:pt-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {filters.map((filter) => {
                const active = filter.value === activeKind;

                return (
                  <LocalizedLink
                    key={filter.label}
                    href={filterHref(filter.value)}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "inline-flex shrink-0 items-center rounded-full px-3.5 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-white font-medium text-[color:var(--brand-ink)]"
                        : "border border-white/30 text-white/80 hover:bg-white/12 hover:text-white",
                    ].join(" ")}
                  >
                    {filter.label}
                  </LocalizedLink>
                );
              })}
            </nav>
          </div>
        </div>
      </section>

      <section className="mt-6 px-4 sm:px-0">
        {listing.items.length > 0 ? (
          <DiscussionList items={listing.items} locale={safeLocale} />
        ) : (
          <p className="rounded-panel app-panel-dashed p-6 text-sm app-muted">
            {activeKind ? ui.emptyFiltered : ui.emptyList}
          </p>
        )}
      </section>
    </main>
  );
}
