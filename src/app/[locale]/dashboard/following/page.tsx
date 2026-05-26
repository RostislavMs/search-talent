import type { Metadata } from "next";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import FollowUnfollowButton from "@/components/follow-unfollow-button";
import { ButtonLink } from "@/components/ui/Button";
import LocalizedLink from "@/components/ui/localized-link";
import { createLocalePath, isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 15;

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
    pathname: "/dashboard/following",
    title: dictionary.follows.feedTitle,
    description: dictionary.follows.feedDescription,
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

type ProfileInfo = {
  user_id: string;
  username: string | null;
  name: string | null;
  headline: string | null;
  avatar_url: string | null;
};

type ArticleItem = {
  id: string;
  author_user_id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  created_at: string;
};

type ProjectItem = {
  id: string;
  owner_id: string;
  title: string;
  slug: string | null;
  description: string | null;
  cover_url: string | null;
  created_at: string;
};

type FeedEntry =
  | { kind: "article"; at: string; article: ArticleItem; author: ProfileInfo }
  | { kind: "project"; at: string; project: ProjectItem; author: ProfileInfo };

function formatRelative(
  iso: string,
  dictionary: ReturnType<typeof getDictionary>,
): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return dictionary.follows.justNow;
  if (hours < 24) {
    return dictionary.follows.hoursAgo.replace("{count}", String(hours));
  }
  const days = Math.floor(hours / 24);
  return dictionary.follows.daysAgo.replace("{count}", String(days));
}

export default async function FollowingPage({
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

  const { data: follows } = await supabase
    .from("follows")
    .select("following_user_id, created_at")
    .eq("follower_user_id", user.id)
    .order("created_at", { ascending: false });

  const followedUserIds = (follows || []).map((f) => f.following_user_id);

  if (followedUserIds.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <section className="rounded-hero app-card p-8 sm:p-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-eyebrow app-soft">
                {dictionary.follows.feedTitle}
              </p>
              <h1 className="font-display mt-3 text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
                {dictionary.follows.feedTitle}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-8 app-muted">
                {dictionary.follows.feedDescription}
              </p>
            </div>
            <ButtonLink href="/dashboard" variant="ghost">
              {dictionary.dashboard.backToDashboard}
            </ButtonLink>
          </div>
        </section>

        <section className="mt-8 rounded-hero app-card p-6 sm:p-8">
          <p className="text-sm app-muted">{dictionary.follows.emptyMessage}</p>
        </section>
      </main>
    );
  }

  const [profilesRes, articlesRes, projectsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, username, name, headline, avatar_url")
      .in("user_id", followedUserIds),
    supabase
      .from("articles")
      .select(
        "id, author_user_id, title, slug, excerpt, cover_image_url, published_at, created_at",
      )
      .in("author_user_id", followedUserIds)
      .eq("status", "published")
      .eq("moderation_status", "approved")
      .order("published_at", { ascending: false })
      .limit(100),
    supabase
      .from("projects")
      .select("id, owner_id, title, slug, description, cover_url, created_at")
      .in("owner_id", followedUserIds)
      .eq("moderation_status", "approved")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const profileMap = new Map(
    ((profilesRes.data || []) as ProfileInfo[]).map((p) => [p.user_id, p]),
  );

  const articles = (articlesRes.data || []) as ArticleItem[];
  const projects = (projectsRes.data || []) as ProjectItem[];

  const entries: FeedEntry[] = [];

  for (const article of articles) {
    const author = profileMap.get(article.author_user_id);
    if (!author) continue;
    const at = article.published_at || article.created_at;
    entries.push({ kind: "article", at, article, author });
  }

  for (const project of projects) {
    const author = profileMap.get(project.owner_id);
    if (!author) continue;
    entries.push({ kind: "project", at: project.created_at, project, author });
  }

  entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const totalItems = entries.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * PAGE_SIZE;
  const pagedEntries = entries.slice(offset, offset + PAGE_SIZE);

  const hasPrev = safePage > 1;
  const hasNext = safePage < totalPages;

  const followedProfiles = followedUserIds
    .map((id) => profileMap.get(id))
    .filter((p): p is ProfileInfo => Boolean(p));

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <section className="rounded-hero app-card p-8 sm:p-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.follows.feedTitle}
            </p>
            <h1 className="font-display mt-3 text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
              {dictionary.follows.feedTitle}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 app-muted">
              {dictionary.follows.feedDescription}
            </p>
          </div>
          <ButtonLink href="/dashboard" variant="ghost">
            {dictionary.dashboard.backToDashboard}
          </ButtonLink>
        </div>
      </section>

      <section className="mt-8 rounded-hero app-card p-6 sm:p-8">
        {pagedEntries.length === 0 ? (
          <p className="text-sm app-muted">{dictionary.follows.feedEmpty}</p>
        ) : (
          <div className="space-y-4">
            {pagedEntries.map((entry) => {
              if (entry.kind === "article") {
                const { article, author, at } = entry;
                return (
                  <article
                    key={`article-${article.id}`}
                    className="flex flex-col gap-4 rounded-2xl app-panel p-4 sm:flex-row sm:items-center"
                  >
                    <LocalizedLink
                      href={`/u/${author.username}`}
                      className="flex shrink-0 items-center gap-3"
                    >
                      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full app-panel text-xs font-semibold text-[color:var(--foreground)]">
                        {author.avatar_url ? (
                          <Image
                            src={author.avatar_url}
                            alt={author.name || author.username || ""}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        ) : (
                          <span>
                            {(author.name || author.username || "U")
                              .slice(0, 1)
                              .toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">
                          {author.name || author.username}
                        </p>
                        <p className="truncate text-xs app-muted">
                          {dictionary.follows.newArticle} ·{" "}
                          {formatRelative(at, dictionary)}
                        </p>
                      </div>
                    </LocalizedLink>

                    <LocalizedLink
                      href={`/articles/${article.slug}`}
                      className="flex min-w-0 flex-1 items-center gap-4 hover:opacity-90"
                    >
                      {article.cover_image_url && (
                        <div className="relative hidden h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-[color:var(--surface-muted)] sm:block">
                          <Image
                            src={article.cover_image_url}
                            alt={article.title}
                            fill
                            className="object-cover"
                            sizes="96px"
                          />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[color:var(--foreground)]">
                          {article.title}
                        </p>
                        {article.excerpt && (
                          <p className="line-clamp-2 text-sm app-muted">
                            {article.excerpt}
                          </p>
                        )}
                      </div>
                    </LocalizedLink>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-full app-panel px-3 py-1 text-xs app-muted">
                        {dictionary.common.article}
                      </span>
                    </div>
                  </article>
                );
              }

              const { project, author, at } = entry;
              return (
                <article
                  key={`project-${project.id}`}
                  className="flex flex-col gap-4 rounded-2xl app-panel p-4 sm:flex-row sm:items-center"
                >
                  <LocalizedLink
                    href={`/u/${author.username}`}
                    className="flex shrink-0 items-center gap-3"
                  >
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full app-panel text-xs font-semibold text-[color:var(--foreground)]">
                      {author.avatar_url ? (
                        <Image
                          src={author.avatar_url}
                          alt={author.name || author.username || ""}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      ) : (
                        <span>
                          {(author.name || author.username || "U")
                            .slice(0, 1)
                            .toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">
                        {author.name || author.username}
                      </p>
                      <p className="truncate text-xs app-muted">
                        {dictionary.follows.newProject} ·{" "}
                        {formatRelative(at, dictionary)}
                      </p>
                    </div>
                  </LocalizedLink>

                  <LocalizedLink
                    href={`/projects/${project.slug}`}
                    className="flex min-w-0 flex-1 items-center gap-4 hover:opacity-90"
                  >
                    {project.cover_url && (
                      <div className="relative hidden h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-[color:var(--surface-muted)] sm:block">
                        <Image
                          src={project.cover_url}
                          alt={project.title}
                          fill
                          className="object-cover"
                          sizes="96px"
                        />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[color:var(--foreground)]">
                        {project.title}
                      </p>
                      {project.description && (
                        <p className="line-clamp-2 text-sm app-muted">
                          {project.description}
                        </p>
                      )}
                    </div>
                  </LocalizedLink>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full app-panel px-3 py-1 text-xs app-muted">
                      {dictionary.common.project}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <nav
            className="mt-8 flex items-center justify-between gap-3"
            aria-label="Pagination"
          >
            {hasPrev ? (
              <ButtonLink
                href={`/dashboard/following?page=${safePage - 1}`}
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
                href={`/dashboard/following?page=${safePage + 1}`}
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

      {followedProfiles.length > 0 && (
        <section className="mt-8 rounded-hero app-card p-6 sm:p-8">
          <div className="mb-5">
            <h2 className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
              {dictionary.follows.manageFollowing}
            </h2>
            <p className="mt-2 text-sm app-muted">
              {dictionary.follows.manageFollowingDescription}
            </p>
          </div>
          <div className="space-y-3">
            {followedProfiles.map((profile) => (
              <div
                key={profile.user_id}
                className="flex items-center gap-4 rounded-2xl app-panel p-3"
              >
                <LocalizedLink
                  href={`/u/${profile.username}`}
                  className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-90"
                >
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full app-panel text-xs font-semibold text-[color:var(--foreground)]">
                    {profile.avatar_url ? (
                      <Image
                        src={profile.avatar_url}
                        alt={profile.name || profile.username || ""}
                        fill
                        className="object-cover"
                        sizes="40px"
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
                    <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">
                      {profile.name || profile.username}
                    </p>
                    {profile.headline && (
                      <p className="truncate text-xs app-muted">
                        {profile.headline}
                      </p>
                    )}
                  </div>
                </LocalizedLink>
                <FollowUnfollowButton followingUserId={profile.user_id} />
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
