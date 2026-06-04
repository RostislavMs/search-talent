import type { Metadata } from "next";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import LocalizedLink from "@/components/ui/localized-link";
import { createLocalePath, isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 20;

async function getLocaleValue(params: Promise<{ locale: string }>) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return locale;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = await getLocaleValue(params);
  const dictionary = getDictionary(locale);

  return buildMetadata({
    locale,
    pathname: "/dashboard/followers",
    title: dictionary.follows.followersTitle,
    description: dictionary.follows.followersDescription,
    noindex: true,
  });
}

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = raw ? Number.parseInt(raw, 10) : 1;
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

type FollowerProfile = {
  user_id: string;
  username: string | null;
  name: string | null;
  headline: string | null;
  avatar_url: string | null;
};

function formatFollowDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default async function FollowersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const locale = await getLocaleValue(params);
  const resolvedSearch = await searchParams;
  const page = parsePage(resolvedSearch.page);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(createLocalePath(locale, "/login"));
  }

  const dictionary = getDictionary(locale);

  // Total comes from the denormalized counter on the profile (maintained by
  // trigger) instead of count(*) over follows on every page load.
  const { data: counterRow } = await supabase
    .from("profiles")
    .select("followers_count")
    .eq("user_id", user.id)
    .maybeSingle();

  const totalItems = counterRow?.followers_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * PAGE_SIZE;

  const { data: follows } = await supabase
    .from("follows")
    .select("follower_user_id, created_at")
    .eq("following_user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const followerIds = (follows || []).map((row) => row.follower_user_id);

  const { data: profiles } =
    followerIds.length > 0
      ? await supabase
          .from("profiles")
          .select("user_id, username, name, headline, avatar_url")
          .in("user_id", followerIds)
      : { data: [] };

  const profileMap = new Map(
    ((profiles || []) as FollowerProfile[]).map((p) => [p.user_id, p]),
  );

  const items = (follows || []).flatMap((row) => {
    const profile = profileMap.get(row.follower_user_id);
    return profile ? [{ profile, createdAt: row.created_at }] : [];
  });

  const hasPrev = safePage > 1;
  const hasNext = safePage < totalPages;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <section className="rounded-hero app-card p-8 sm:p-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.follows.followersTitle}
            </p>
            <h1 className="font-display mt-3 text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
              {dictionary.follows.followersTitle}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 app-muted">
              {dictionary.follows.followersDescription}
            </p>
          </div>
          <ButtonLink href="/dashboard" variant="ghost">
            {dictionary.dashboard.backToDashboard}
          </ButtonLink>
        </div>
      </section>

      <section className="mt-8 rounded-hero app-card p-6 sm:p-8">
        {items.length === 0 ? (
          <p className="text-sm app-muted">{dictionary.follows.followersEmpty}</p>
        ) : (
          <div className="space-y-3">
            {items.map(({ profile, createdAt }) => (
              <div
                key={profile.user_id}
                className="flex items-center gap-4 rounded-2xl app-panel p-4"
              >
                <LocalizedLink
                  href={`/u/${profile.username}`}
                  className="flex min-w-0 flex-1 items-center gap-4 hover:opacity-90"
                >
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full app-panel text-sm font-semibold text-[color:var(--foreground)]">
                    {profile.avatar_url ? (
                      <Image
                        src={profile.avatar_url}
                        alt={profile.name || profile.username || ""}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    ) : (
                      <span>
                        {(profile.name || profile.username || "U")
                          .slice(0, 1)
                          .toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[color:var(--foreground)]">
                      {profile.name || profile.username}
                    </p>
                    {profile.headline && (
                      <p className="truncate text-sm app-muted">
                        {profile.headline}
                      </p>
                    )}
                    <p className="mt-1 truncate text-xs app-soft">
                      {dictionary.follows.followedAt.replace(
                        "{date}",
                        formatFollowDate(createdAt, locale),
                      )}
                    </p>
                  </div>
                </LocalizedLink>
                <span className="shrink-0 whitespace-nowrap rounded-full app-panel px-3 py-1 text-xs app-muted">
                  {dictionary.follows.followsYou}
                </span>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <nav
            className="mt-8 flex items-center justify-between gap-3"
            aria-label="Pagination"
          >
            {hasPrev ? (
              <ButtonLink
                href={`/dashboard/followers?page=${safePage - 1}`}
                variant="ghost"
                size="sm"
              >
                ← {dictionary.bookmarks.previousPage}
              </ButtonLink>
            ) : (
              <span />
            )}
            <span className="text-xs app-muted">
              {dictionary.bookmarks.pageLabel} {safePage} / {totalPages}
            </span>
            {hasNext ? (
              <ButtonLink
                href={`/dashboard/followers?page=${safePage + 1}`}
                variant="ghost"
                size="sm"
              >
                {dictionary.bookmarks.nextPage} →
              </ButtonLink>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </main>
  );
}
