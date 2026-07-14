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
  isAdmin,
}: {
  dictionary: Dictionary;
  locale: Locale;
  userStats: UserStats;
  isAdmin: boolean;
}) {
  const ui = getStatsUi(locale);
  const compact = (value: number) => formatCompactNumber(value, locale);

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
          ]}
        />
        {isAdmin && (
          <ButtonLink href="/admin" variant="ghost" size="sm">
            {dictionary.nav.adminConsole}
          </ButtonLink>
        )}
      </nav>

      {/* ─── Content ─── */}
      <section>
        <SectionHeading>{dictionary.mySpace.content}</SectionHeading>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCardLink
            value={compact(userStats.projectsCount)}
            label={dictionary.mySpace.myProjects}
            href={
              userStats.username
                ? `/u/${userStats.username}/projects`
                : "/projects"
            }
            accent="bg-emerald-500"
          />
          <StatCardLink
            value={compact(userStats.articlesCount)}
            label={dictionary.mySpace.myArticles}
            href={
              userStats.username
                ? `/u/${userStats.username}/articles`
                : "/articles"
            }
            accent="bg-violet-500"
          />
          <StatCardLink
            value={compact(userStats.pollsCount)}
            label={dictionary.mySpace.myPolls}
            href={
              userStats.username ? `/u/${userStats.username}/polls` : "/polls"
            }
            accent="bg-indigo-500"
          />
          <StatCardLink
            value={compact(userStats.bookmarksCount)}
            label={dictionary.mySpace.bookmarks}
            href="/my-space/saved"
            accent="bg-amber-500"
          />
        </div>
      </section>

      {/* ─── Audience ─── */}
      <section>
        <SectionHeading>{dictionary.mySpace.audience}</SectionHeading>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCardLink
            value={compact(userStats.followersCount)}
            label={dictionary.mySpace.followers}
            href="/my-space/followers"
            accent="bg-sky-500"
          />
          <StatCardLink
            value={compact(userStats.followingCount)}
            label={dictionary.mySpace.following}
            href="/my-space/following"
            accent="bg-cyan-500"
          />
          <StatTile
            value={compact(userStats.receivedLikes)}
            label={dictionary.mySpace.receivedLikes}
            accent="bg-rose-500"
          />
          <StatTile
            value={compact(userStats.articleViews)}
            label={dictionary.mySpace.articleViews}
            accent="bg-orange-500"
          />
        </div>
      </section>
    </div>
  );
}
