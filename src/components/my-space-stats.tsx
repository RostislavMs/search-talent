import { ButtonLink } from "@/components/ui/Button";
import RadialActions from "@/components/ui/radial-actions";
import LocalizedLink from "@/components/ui/localized-link";
import type { UserStats } from "@/lib/db/stats";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

import { formatCompactNumber, getStatsUi } from "@/components/stats/stats-ui";

function StatCardLink({
  value,
  label,
  href,
  accent,
}: {
  value: string;
  label: string;
  href: string;
  accent: string;
}) {
  return (
    <LocalizedLink
      href={href}
      className="group relative block rounded-2xl border app-border bg-[color:var(--surface)] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--foreground)] hover:shadow-[0_18px_40px_rgba(2,6,23,0.18)]"
    >
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="absolute right-4 top-4 h-4 w-4 app-soft transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-[color:var(--foreground)]"
        aria-hidden="true"
      >
        <path d="M6 3.5 10.5 8 6 12.5" />
      </svg>
      <div
        className={`mb-3 h-1 w-10 rounded-full ${accent} transition-all duration-200 group-hover:w-16`}
      />
      <p className="text-2xl font-bold tracking-tight text-[color:var(--foreground)]">
        {value}
      </p>
      <p className="mt-1 text-sm font-medium app-soft transition-colors group-hover:text-[color:var(--foreground)]">
        {label}
      </p>
    </LocalizedLink>
  );
}

// Plain tile for metrics without a destination page (no hover — decorative
// containers must not look actionable).
function StatTile({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border app-border bg-[color:var(--surface)] p-5">
      <div className={`mb-3 h-1 w-10 rounded-full ${accent}`} />
      <p className="text-2xl font-bold tracking-tight text-[color:var(--foreground)]">
        {value}
      </p>
      <p className="mt-1 text-sm font-medium app-soft">{label}</p>
    </div>
  );
}

function SectionHeading({ children }: { children: string }) {
  return (
    <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest app-soft">
      {children}
    </h2>
  );
}

export default function MySpaceStats({
  dictionary,
  locale,
  userStats,
  contactOpens = 0,
  isAdmin,
}: {
  dictionary: Dictionary;
  locale: Locale;
  userStats: UserStats;
  /** People (signed in, each once) who opened «Зв'язатися» on the profile. */
  contactOpens?: number;
  isAdmin: boolean;
}) {
  const ui = getStatsUi(locale);
  const compact = (value: number) => formatCompactNumber(value, locale);
  const profileBase = userStats.username ? `/u/${userStats.username}` : null;

  // A tile shows up once there is something behind it: a newcomer sees the
  // checklist above instead of a wall of zeros.
  const contentTiles = [
    {
      key: "projects",
      count: userStats.projectsCount,
      label: dictionary.mySpace.myProjects,
      href: profileBase ? `${profileBase}/projects` : "/projects",
      accent: "bg-emerald-500",
    },
    {
      key: "articles",
      count: userStats.articlesCount,
      label: dictionary.mySpace.myArticles,
      href: profileBase ? `${profileBase}/articles` : "/articles",
      accent: "bg-violet-500",
    },
    {
      key: "polls",
      count: userStats.pollsCount,
      label: dictionary.mySpace.myPolls,
      href: profileBase ? `${profileBase}/polls` : "/polls",
      accent: "bg-indigo-500",
    },
    {
      key: "discussions",
      count: userStats.discussionsCount,
      label: dictionary.mySpace.myDiscussions,
      href: profileBase ? `${profileBase}/discussions` : "/discussions",
      accent: "bg-sky-500",
    },
    {
      key: "bookmarks",
      count: userStats.bookmarksCount,
      label: dictionary.mySpace.bookmarks,
      href: "/my-space/saved",
      accent: "bg-amber-500",
    },
  ].filter((tile) => tile.count > 0);

  const audienceTiles: Array<{
    key: string;
    count: number;
    label: string;
    href?: string;
    accent: string;
  }> = [
    {
      key: "followers",
      count: userStats.followersCount,
      label: dictionary.mySpace.followers,
      href: "/my-space/followers",
      accent: "bg-sky-500",
    },
    {
      key: "following",
      count: userStats.followingCount,
      label: dictionary.mySpace.following,
      href: "/my-space/following",
      accent: "bg-cyan-500",
    },
    {
      key: "likes",
      count: userStats.receivedLikes,
      label: dictionary.mySpace.receivedLikes,
      accent: "bg-rose-500",
    },
    {
      key: "articleViews",
      count: userStats.articleViews,
      label: dictionary.mySpace.articleViews,
      accent: "bg-orange-500",
    },
    {
      key: "contactOpens",
      count: contactOpens,
      label: dictionary.openTo.contactOpens,
      accent: "bg-emerald-500",
    },
  ].filter((tile) => tile.count > 0);

  return (
    <div className="space-y-8">
      {/* ─── Quick actions: create/edit only — browse destinations live on the
           stat cards below and in the global menu ─── */}
      <nav className="flex flex-wrap items-center gap-2">
        <ButtonLink href="/profile/edit" size="sm">
          {ui.editProfile}
        </ButtonLink>
        <RadialActions
          label={ui.create}
          actions={[
            { href: "/projects/new", label: ui.createProject },
            { href: "/articles/new", label: ui.createArticle },
            { href: "/polls/new", label: ui.createPoll },
            { href: "/discussions/new", label: ui.createTopic },
          ]}
        />
        {isAdmin && (
          <ButtonLink href="/admin" variant="ghost" size="sm">
            {dictionary.nav.adminConsole}
          </ButtonLink>
        )}
      </nav>

      {contentTiles.length > 0 ? (
        <section>
          <SectionHeading>{dictionary.mySpace.content}</SectionHeading>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {contentTiles.map((tile) => (
              <StatCardLink
                key={tile.key}
                label={tile.label}
                href={tile.href}
                accent={tile.accent}
                value={compact(tile.count)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {audienceTiles.length > 0 ? (
        <section>
          <SectionHeading>{dictionary.mySpace.audience}</SectionHeading>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {audienceTiles.map((tile) =>
              tile.href ? (
                <StatCardLink
                  key={tile.key}
                  label={tile.label}
                  href={tile.href}
                  accent={tile.accent}
                  value={compact(tile.count)}
                />
              ) : (
                <StatTile
                  key={tile.key}
                  label={tile.label}
                  accent={tile.accent}
                  value={compact(tile.count)}
                />
              ),
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
