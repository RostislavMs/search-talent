import type { Metadata } from "next";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import BookmarkRemoveButton from "@/components/bookmark-remove-button";
import { ButtonLink } from "@/components/ui/Button";
import LocalizedLink from "@/components/ui/localized-link";
import { createLocalePath, isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 12;

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
    pathname: "/dashboard/saved",
    title: dictionary.bookmarks.title,
    description: dictionary.bookmarks.description,
    noindex: true,
  });
}

type BookmarkItem = {
  id: string;
  target_type: string;
  target_profile_id: string | null;
  target_project_id: string | null;
  created_at: string;
};

type ProfileInfo = {
  id: string;
  username: string | null;
  name: string | null;
  headline: string | null;
  avatar_url: string | null;
};

type ProjectInfo = {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  cover_url: string | null;
  score: number | null;
};

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = raw ? Number.parseInt(raw, 10) : 1;
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

export default async function SavedItemsPage({
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

  const { count: totalCount } = await supabase
    .from("bookmarks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const totalItems = totalCount || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * PAGE_SIZE;

  const { data: bookmarks } = await supabase
    .from("bookmarks")
    .select("id, target_type, target_profile_id, target_project_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const items = (bookmarks || []) as BookmarkItem[];
  const profileIds = items
    .filter((b) => b.target_type === "profile" && b.target_profile_id)
    .map((b) => b.target_profile_id as string);
  const projectIds = items
    .filter((b) => b.target_type === "project" && b.target_project_id)
    .map((b) => b.target_project_id as string);

  const [profilesRes, projectsRes] = await Promise.all([
    profileIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, username, name, headline, avatar_url")
          .in("id", profileIds)
      : Promise.resolve({ data: [] }),
    projectIds.length > 0
      ? supabase
          .from("projects")
          .select("id, title, slug, description, cover_url, score")
          .in("id", projectIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileMap = new Map(
    ((profilesRes.data || []) as ProfileInfo[]).map((p) => [p.id, p]),
  );
  const projectMap = new Map(
    ((projectsRes.data || []) as ProjectInfo[]).map((p) => [p.id, p]),
  );

  const hasPrev = safePage > 1;
  const hasNext = safePage < totalPages;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <section className="rounded-[2.25rem] app-card p-8 sm:p-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] app-soft">
              {dictionary.bookmarks.title}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[color:var(--foreground)]">
              {dictionary.bookmarks.title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 app-muted">
              {dictionary.bookmarks.description}
            </p>
          </div>
          <ButtonLink href="/dashboard" variant="ghost">
            {dictionary.dashboard.backToDashboard}
          </ButtonLink>
        </div>
      </section>

      <section className="mt-8 rounded-[2rem] app-card p-6 sm:p-8">
        {items.length === 0 ? (
          <p className="text-sm app-muted">{dictionary.bookmarks.emptyMessage}</p>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              if (item.target_type === "profile" && item.target_profile_id) {
                const profile = profileMap.get(item.target_profile_id);

                if (!profile) {
                  return null;
                }

                return (
                  <div
                    key={item.id}
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
                      </div>
                    </LocalizedLink>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-full app-panel px-3 py-1 text-xs app-muted">
                        {dictionary.common.profile}
                      </span>
                      <BookmarkRemoveButton
                        targetType="profile"
                        targetId={profile.id}
                      />
                    </div>
                  </div>
                );
              }

              if (item.target_type === "project" && item.target_project_id) {
                const project = projectMap.get(item.target_project_id);

                if (!project) {
                  return null;
                }

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 rounded-2xl app-panel p-4"
                  >
                    <LocalizedLink
                      href={`/projects/${project.slug}`}
                      className="flex min-w-0 flex-1 items-center gap-4 hover:opacity-90"
                    >
                      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[color:var(--surface-muted)]">
                        {project.cover_url ? (
                          <Image
                            src={project.cover_url}
                            alt={project.title}
                            fill
                            className="object-cover"
                            sizes="48px"
                          />
                        ) : (
                          <span className="text-xs app-muted">P</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[color:var(--foreground)]">
                          {project.title}
                        </p>
                        {project.description && (
                          <p className="truncate text-sm app-muted">
                            {project.description}
                          </p>
                        )}
                      </div>
                    </LocalizedLink>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-full app-panel px-3 py-1 text-xs app-muted">
                        {dictionary.common.project}
                      </span>
                      <BookmarkRemoveButton
                        targetType="project"
                        targetId={project.id}
                      />
                    </div>
                  </div>
                );
              }

              return null;
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
                href={`/dashboard/saved?page=${safePage - 1}`}
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
                href={`/dashboard/saved?page=${safePage + 1}`}
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
