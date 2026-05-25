"use client";

import { useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import type { DashboardStats, UserDashboardStats } from "@/lib/db/dashboard";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

function formatCompactNumber(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "uk" ? "uk-UA" : "en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

function formatMonthLabel(value: string, locale: Locale) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));

  return new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", {
    month: "short",
  }).format(date);
}

function getDashboardUi(locale: Locale) {
  if (locale === "uk") {
    return {
      publicProfiles: "Публічні профілі",
      creatorDirections: "Напрямки",
      creatorCountries: "Країни",
      creatorOrigins: "Географія фахівців",
      creatorDirectionsMix: "Розподіл за напрямками",
      profileReadiness: "Якість профілів",
      skillsUniverse: "Карта скілів платформи",
      skillsDescription:
        "Навички з профілів і технології з проєктів разом — реальний стек платформи.",
      starter: "Початковий",
      growing: "Розвивається",
      complete: "Сильний",
      directionLabel: "Напрямок",
      ownerLabel: "Автор",
      likesLabel: "Лайки",
      dislikesLabel: "Дизлайки",
      editProfile: "Редагувати профіль",
      manageProjects: "Керувати проєктами",
      openSearch: "Пошук",
      savedItems: "Збережене",
      followingAuthors: "Підписки",
      writeArticle: "Написати статтю",
      showMore: "Показати більше",
      showLess: "Згорнути",
      experienceDistribution: "Рівень досвіду",
      salaryDistribution: "Зарплатні очікування",
      salaryByCountry: "Середня зарплата по країнам",
      salaryByCategory: "Середня зарплата по напрямкам",
      avgSalaryLabel: "~${avg} $",
      profilesCount: "{count} профілів",
      workFormatDistribution: "Бажаний формат роботи",
      employmentTypeDistribution: "Варіант зайнятості",
      contactMethodDistribution: "Бажаний спосіб зв'язку",
      experienceLevels: {
        no_experience: "Без досвіду",
        months_3: "3 міс",
        months_6: "6 міс",
        year_1: "1 рік",
        years_2: "2 роки",
        years_3: "3 роки",
        years_4: "4 роки",
        years_5: "5 років",
        years_6: "6 років",
        years_7: "7 років",
        years_8: "8 років",
        years_9: "9 років",
        years_10: "10 років",
        more_than_10_years: "> 10 років",
      },
      salaryRanges: {
        under_500: "до 500 $",
        "500_1000": "500 – 1000 $",
        "1000_2000": "1000 – 2000 $",
        "2000_3500": "2000 – 3500 $",
        "3500_5000": "3500 – 5000 $",
        "5000_plus": "5000 $ і більше",
        custom: "Інше",
      },
      workFormats: {
        remote: "Віддалено",
        hybrid: "Гібридно",
        office: "В офісі",
      },
      employmentTypes: {
        full_time: "Повна зайнятість",
        part_time: "Часткова зайнятість",
        contract: "Контракт",
        freelance: "Фриланс",
        internship: "Стажування",
      },
      contactMethods: {
        email: "Email",
        telegram: "Telegram",
        phone: "Телефон",
        linkedin: "LinkedIn",
        website: "Сайт",
      },
    };
  }

  return {
    publicProfiles: "Public profiles",
    creatorDirections: "Directions",
    creatorCountries: "Countries",
    creatorOrigins: "Talent geography",
    creatorDirectionsMix: "Direction distribution",
    profileReadiness: "Profile readiness",
    skillsUniverse: "Platform skill map",
    skillsDescription:
      "Profile skills and project technologies combined — the actual platform stack.",
    starter: "Starter",
    growing: "Growing",
    complete: "Strong",
    directionLabel: "Direction",
    ownerLabel: "Owner",
    likesLabel: "Likes",
    dislikesLabel: "Dislikes",
    editProfile: "Edit profile",
    manageProjects: "Manage projects",
    openSearch: "Search",
    savedItems: "Saved",
    followingAuthors: "Following",
    writeArticle: "Write article",
    showMore: "Show more",
    showLess: "Collapse",
    experienceDistribution: "Experience level",
    salaryDistribution: "Salary expectations",
    salaryByCountry: "Average salary by country",
    salaryByCategory: "Average salary by direction",
    avgSalaryLabel: "~${avg} $",
    profilesCount: "{count} profiles",
    workFormatDistribution: "Preferred work format",
    employmentTypeDistribution: "Employment type",
    contactMethodDistribution: "Preferred contact method",
    experienceLevels: {
      no_experience: "No experience",
      months_3: "3 months",
      months_6: "6 months",
      year_1: "1 year",
      years_2: "2 years",
      years_3: "3 years",
      years_4: "4 years",
      years_5: "5 years",
      years_6: "6 years",
      years_7: "7 years",
      years_8: "8 years",
      years_9: "9 years",
      years_10: "10 years",
      more_than_10_years: "More than 10 years",
    },
    salaryRanges: {
      under_500: "under $500",
      "500_1000": "$500 – 1000",
      "1000_2000": "$1000 – 2000",
      "2000_3500": "$2000 – 3500",
      "3500_5000": "$3500 – 5000",
      "5000_plus": "$5000 and above",
      custom: "Other",
    },
    workFormats: {
      remote: "Remote",
      hybrid: "Hybrid",
      office: "Office",
    },
    employmentTypes: {
      full_time: "Full-time",
      part_time: "Part-time",
      contract: "Contract",
      freelance: "Freelance",
      internship: "Internship",
    },
    contactMethods: {
      email: "Email",
      telegram: "Telegram",
      phone: "Phone",
      linkedin: "LinkedIn",
      website: "Website",
    },
  };
}

/* ─── Small reusable pieces ─── */

function PersonalStatCard({
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
    <a
      href={href}
      className="group block rounded-2xl border app-border bg-[color:var(--surface)] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--foreground)] hover:shadow-[0_18px_40px_rgba(2,6,23,0.18)]"
    >
      <div
        className={`mb-3 h-1 w-10 rounded-full ${accent} transition-all duration-200 group-hover:w-16`}
      />
      <p className="text-2xl font-bold tracking-tight text-[color:var(--foreground)]">
        {value}
      </p>
      <p className="mt-1 text-sm font-medium app-soft transition-colors group-hover:text-[color:var(--foreground)]">
        {label}
      </p>
    </a>
  );
}

function PlatformMetricCard({
  value,
  label,
  hint,
  accent,
}: {
  value: string;
  label: string;
  hint?: string;
  accent: string;
}) {
  return (
    <article className="rounded-2xl border app-border bg-[color:var(--surface)] p-5">
      <div className={`mb-3 h-1 w-10 rounded-full ${accent}`} />
      <p className="text-sm font-medium app-soft">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-[color:var(--foreground)]">
        {value}
      </p>
      {hint && <p className="mt-1.5 text-xs app-muted">{hint}</p>}
    </article>
  );
}

/* ─── Activity chart ─── */

function ActivityChart({
  items,
  dictionary,
  locale,
}: {
  items: DashboardStats["monthlyActivity"];
  dictionary: Dictionary;
  locale: Locale;
}) {
  const maxValue = Math.max(
    ...items.flatMap((item) => [item.profiles, item.projects]),
    1,
  );

  const series = [
    {
      key: "profiles",
      label: dictionary.dashboard.creatorsJoined,
      color: "bg-sky-500",
      dot: "bg-sky-500",
      value: (item: DashboardStats["monthlyActivity"][number]) => item.profiles,
    },
    {
      key: "projects",
      label: dictionary.dashboard.projectsPublished,
      color: "bg-emerald-500",
      dot: "bg-emerald-500",
      value: (item: DashboardStats["monthlyActivity"][number]) => item.projects,
    },
  ];

  return (
    <section className="rounded-2xl app-card p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
          {dictionary.dashboard.growthLastMonths}
        </h2>
        <div className="flex flex-wrap gap-4">
          {series.map((entry) => (
            <div key={entry.key} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${entry.dot}`} />
              <span className="text-xs font-medium app-soft">{entry.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex h-56 gap-2 sm:gap-3">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex min-w-0 flex-1 flex-col items-stretch gap-1"
          >
            <div className="relative flex flex-1 items-stretch gap-0.5 sm:gap-1">
              {series.map((entry) => {
                const v = entry.value(item);
                const height = Math.max((v / maxValue) * 100, v > 0 ? 6 : 0);
                return (
                  <div
                    key={`${item.key}-${entry.key}`}
                    className="relative flex-1"
                    title={`${entry.label}: ${v}`}
                  >
                    <div
                      className={`absolute inset-x-0 bottom-0 rounded-t-lg ${entry.color} transition-all`}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <span className="mt-2 text-center text-xs app-soft">
              {formatMonthLabel(item.key, locale)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Expandable horizontal bar distribution ─── */

const DISTRIBUTION_DEFAULT_LIMIT = 6;

function ExpandableDistributionChart({
  title,
  items,
  locale,
  ui,
}: {
  title: string;
  items: Array<{ label: string; value: number }>;
  locale: Locale;
  ui: ReturnType<typeof getDashboardUi>;
}) {
  const [expanded, setExpanded] = useState(false);
  const maxValue = Math.max(...items.map((item) => item.value), 1);
  const totalValue = items.reduce((sum, item) => sum + item.value, 0);
  const shouldShowToggle = items.length > DISTRIBUTION_DEFAULT_LIMIT;
  const visibleItems = expanded || !shouldShowToggle
    ? items
    : items.slice(0, DISTRIBUTION_DEFAULT_LIMIT);

  return (
    <section className="rounded-2xl app-card p-6">
      <h2 className="mb-5 text-lg font-semibold text-[color:var(--foreground)]">{title}</h2>

      <div className="space-y-3">
        {visibleItems.length > 0 ? (
          visibleItems.map((item) => {
            const pct =
              totalValue > 0 ? Math.round((item.value / totalValue) * 100) : 0;
            return (
              <div key={item.label}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[color:var(--foreground)]">
                    {item.label}
                  </p>
                  <p className="text-sm tabular-nums app-soft">
                    {formatCompactNumber(item.value, locale)}{" "}
                    <span className="app-muted">({pct}%)</span>
                  </p>
                </div>
                <div className="h-2 rounded-full bg-[color:var(--surface-muted)]">
                  <div
                    className="h-2 rounded-full bg-[color:var(--foreground)] opacity-70"
                    style={{ width: `${(item.value / maxValue) * 100}%` }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm app-muted">0</p>
        )}
      </div>

      {shouldShowToggle && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-4 text-sm font-medium text-[color:var(--foreground)] hover:underline"
        >
          {expanded ? ui.showLess : `${ui.showMore} (${items.length - DISTRIBUTION_DEFAULT_LIMIT})`}
        </button>
      )}
    </section>
  );
}

/* ─── Completion bands ─── */

function CompletionBands({
  items,
  total,
  locale,
  ui,
}: {
  items: DashboardStats["completionBreakdown"];
  total: number;
  locale: Locale;
  ui: ReturnType<typeof getDashboardUi>;
}) {
  const labels = {
    starter: ui.starter,
    growing: ui.growing,
    complete: ui.complete,
  } as const;

  const colors = {
    starter: "bg-slate-400",
    growing: "bg-amber-500",
    complete: "bg-emerald-500",
  } as const;

  const dots = {
    starter: "bg-slate-400",
    growing: "bg-amber-500",
    complete: "bg-emerald-500",
  } as const;

  return (
    <section className="rounded-2xl app-card p-6">
      <h2 className="mb-5 text-lg font-semibold text-[color:var(--foreground)]">
        {ui.profileReadiness}
      </h2>

      {/* stacked bar */}
      <div className="mb-5 flex h-4 overflow-hidden rounded-full bg-[color:var(--surface-muted)]">
        {items.map((item) => {
          const pct = total > 0 ? (item.value / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={item.key}
              className={`${colors[item.key]}`}
              style={{ width: `${pct}%` }}
              title={`${labels[item.key]}: ${item.value}`}
            />
          );
        })}
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <div key={item.key} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${dots[item.key]}`} />
                <span className="text-sm font-medium text-[color:var(--foreground)]">
                  {labels[item.key]}
                </span>
              </div>
              <span className="text-sm tabular-nums app-soft">
                {formatCompactNumber(item.value, locale)} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─── Expandable skills cloud ─── */

const SKILLS_DEFAULT_LIMIT = 14;

function SkillCloud({
  skills,
  ui,
  dictionary,
}: {
  skills: DashboardStats["topSkills"];
  ui: ReturnType<typeof getDashboardUi>;
  dictionary: Dictionary;
}) {
  const [expanded, setExpanded] = useState(false);

  if (skills.length === 0) {
    return (
      <section className="rounded-2xl app-card p-6">
        <h2 className="mb-2 text-lg font-semibold text-[color:var(--foreground)]">
          {ui.skillsUniverse}
        </h2>
        <p className="text-sm app-muted">{dictionary.dashboard.noProjectsYet}</p>
      </section>
    );
  }

  const maxCount = Math.max(...skills.map((s) => s.value), 1);
  const shouldShowToggle = skills.length > SKILLS_DEFAULT_LIMIT;
  const visibleSkills = expanded || !shouldShowToggle
    ? skills
    : skills.slice(0, SKILLS_DEFAULT_LIMIT);

  return (
    <section className="rounded-2xl app-card p-6">
      <h2 className="mb-2 text-lg font-semibold text-[color:var(--foreground)]">
        {ui.skillsUniverse}
      </h2>
      <p className="mb-5 text-xs app-muted">{ui.skillsDescription}</p>

      <div className="flex flex-wrap gap-2">
        {visibleSkills.map((skill) => {
          const intensity = Math.max(0.35, skill.value / maxCount);
          return (
            <span
              key={skill.name}
              className="inline-flex items-center gap-1.5 rounded-full border app-border bg-[color:var(--surface)] px-3 py-1.5 text-sm"
              style={{ opacity: 0.5 + intensity * 0.5 }}
            >
              <span className="font-medium text-[color:var(--foreground)]">{skill.name}</span>
              <span className="text-xs tabular-nums app-soft">{skill.value}</span>
            </span>
          );
        })}
      </div>

      {shouldShowToggle && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-4 text-sm font-medium text-[color:var(--foreground)] hover:underline"
        >
          {expanded ? ui.showLess : `${ui.showMore} (${skills.length - SKILLS_DEFAULT_LIMIT})`}
        </button>
      )}
    </section>
  );
}

/* ─── Salary by group chart ─── */

function SalaryByGroupChart({
  title,
  items,
  locale,
  ui,
}: {
  title: string;
  items: Array<{ label: string; avgSalary: number; count: number }>;
  locale: Locale;
  ui: ReturnType<typeof getDashboardUi>;
}) {
  const [expanded, setExpanded] = useState(false);
  const maxSalary = Math.max(...items.map((item) => item.avgSalary), 1);
  const shouldShowToggle = items.length > DISTRIBUTION_DEFAULT_LIMIT;
  const visibleItems =
    expanded || !shouldShowToggle
      ? items
      : items.slice(0, DISTRIBUTION_DEFAULT_LIMIT);

  return (
    <section className="rounded-2xl app-card p-6">
      <h2 className="mb-5 text-lg font-semibold text-[color:var(--foreground)]">
        {title}
      </h2>

      <div className="space-y-3">
        {visibleItems.length > 0 ? (
          visibleItems.map((item) => (
            <div key={item.label}>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-[color:var(--foreground)]">
                  {item.label}
                </p>
                <p className="text-sm tabular-nums app-soft">
                  {ui.avgSalaryLabel.replace(
                    "${avg}",
                    formatCompactNumber(item.avgSalary, locale),
                  )}{" "}
                  <span className="app-muted">
                    ({ui.profilesCount.replace("{count}", String(item.count))})
                  </span>
                </p>
              </div>
              <div className="h-2 rounded-full bg-[color:var(--surface-muted)]">
                <div
                  className="h-2 rounded-full bg-emerald-500 opacity-70"
                  style={{
                    width: `${(item.avgSalary / maxSalary) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm app-muted">0</p>
        )}
      </div>

      {shouldShowToggle && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-4 text-sm font-medium text-[color:var(--foreground)] hover:underline"
        >
          {expanded
            ? ui.showLess
            : `${ui.showMore} (${items.length - DISTRIBUTION_DEFAULT_LIMIT})`}
        </button>
      )}
    </section>
  );
}

/* ─── Main component ─── */

export default function DashboardAnalytics({
  dictionary,
  locale,
  stats,
  userStats,
  isAdmin,
}: {
  dictionary: Dictionary;
  locale: Locale;
  stats: DashboardStats;
  userStats: UserDashboardStats;
  isAdmin: boolean;
}) {
  const ui = getDashboardUi(locale);
  const publicProfilesRate =
    stats.siteTotals.profiles > 0
      ? Math.round((stats.siteTotals.publicProfiles / stats.siteTotals.profiles) * 100)
      : 0;
  const completionTotal = stats.completionBreakdown.reduce((s, i) => s + i.value, 0);

  const experienceLevelLabels = ui.experienceLevels as Record<string, string>;
  const salaryRangeLabels = ui.salaryRanges as Record<string, string>;
  const workFormatLabels = ui.workFormats as Record<string, string>;
  const employmentTypeLabels = ui.employmentTypes as Record<string, string>;

  function relabel(
    items: Array<{ key: string; label: string; value: number }>,
    lookup: Record<string, string>,
  ) {
    return items.map((item) => ({
      label: lookup[item.key] || item.label || item.key,
      value: item.value,
    }));
  }

  return (
    <div className="space-y-6">
      {/* ─── Quick actions ─── */}
      <nav className="flex flex-wrap gap-2">
        <ButtonLink href="/profile/edit" size="sm">
          {ui.editProfile}
        </ButtonLink>
        <ButtonLink href={userStats.username ? `/u/${userStats.username}/projects` : "/projects"} variant="secondary" size="sm">
          {ui.manageProjects}
        </ButtonLink>
        <ButtonLink href="/articles/new" variant="secondary" size="sm">
          {ui.writeArticle}
        </ButtonLink>
        <ButtonLink href="/talents" variant="ghost" size="sm">
          {ui.openSearch}
        </ButtonLink>
        <ButtonLink href="/dashboard/saved" variant="ghost" size="sm">
          {ui.savedItems}
        </ButtonLink>
        <ButtonLink href="/dashboard/following" variant="ghost" size="sm">
          {ui.followingAuthors}
        </ButtonLink>
        {isAdmin && (
          <ButtonLink href="/admin" variant="ghost" size="sm">
            {dictionary.nav.adminConsole}
          </ButtonLink>
        )}
      </nav>

      {/* ─── Personal stats ─── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest app-soft">
          {dictionary.dashboard.myStats}
        </h2>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <PersonalStatCard
            value={String(userStats.projectsCount)}
            label={dictionary.dashboard.myProjects}
            href={userStats.username ? `/${locale}/u/${userStats.username}/projects` : `/${locale}/projects`}
            accent="bg-emerald-500"
          />
          <PersonalStatCard
            value={String(userStats.articlesCount)}
            label={dictionary.dashboard.myArticles}
            href={userStats.username ? `/${locale}/u/${userStats.username}/articles` : `/${locale}/articles`}
            accent="bg-violet-500"
          />
          <PersonalStatCard
            value={String(userStats.followersCount)}
            label={dictionary.dashboard.followers}
            href={`/${locale}/dashboard/followers`}
            accent="bg-sky-500"
          />
          <PersonalStatCard
            value={String(userStats.followingCount)}
            label={dictionary.dashboard.following}
            href={`/${locale}/dashboard/following`}
            accent="bg-cyan-500"
          />
          <PersonalStatCard
            value={String(userStats.bookmarksCount)}
            label={dictionary.dashboard.bookmarks}
            href={`/${locale}/dashboard/saved`}
            accent="bg-amber-500"
          />
          <PersonalStatCard
            value={String(userStats.receivedLikes)}
            label={dictionary.dashboard.receivedLikes}
            href={userStats.username ? `/${locale}/u/${userStats.username}/projects` : `/${locale}/projects`}
            accent="bg-rose-500"
          />
        </div>
      </section>

      {/* ─── Platform overview (without total votes) ─── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest app-soft">
          {dictionary.dashboard.platformOverview}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <PlatformMetricCard
            label={dictionary.dashboard.totalCreators}
            value={formatCompactNumber(stats.siteTotals.profiles, locale)}
            accent="bg-sky-500"
            hint={`${formatCompactNumber(stats.siteTotals.publicProfiles, locale)} ${ui.publicProfiles.toLowerCase()} (${publicProfilesRate}%)`}
          />
          <PlatformMetricCard
            label={dictionary.dashboard.totalProjects}
            value={formatCompactNumber(stats.siteTotals.projects, locale)}
            accent="bg-emerald-500"
            hint={dictionary.dashboard.siteProjectsHint}
          />
          <PlatformMetricCard
            label={dictionary.dashboard.profileCompletion}
            value={`${stats.siteTotals.avgProfileCompletion}%`}
            accent="bg-slate-500"
            hint={ui.profileReadiness}
          />
        </div>
      </section>

      {/* ─── Activity chart ─── */}
      <ActivityChart items={stats.monthlyActivity} dictionary={dictionary} locale={locale} />

      {/* ─── Distributions: geography & directions ─── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ExpandableDistributionChart
          title={ui.creatorOrigins}
          locale={locale}
          items={stats.countryBreakdown}
          ui={ui}
        />
        <ExpandableDistributionChart
          title={ui.creatorDirectionsMix}
          locale={locale}
          items={stats.categoryBreakdown}
          ui={ui}
        />
      </div>

      {/* ─── Profile quality & skills ─── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CompletionBands
          items={stats.completionBreakdown}
          total={completionTotal}
          locale={locale}
          ui={ui}
        />
        <SkillCloud skills={stats.topSkills} ui={ui} dictionary={dictionary} />
      </div>

      {/* ─── Experience & salary ─── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ExpandableDistributionChart
          title={ui.experienceDistribution}
          locale={locale}
          items={relabel(stats.experienceBreakdown, experienceLevelLabels)}
          ui={ui}
        />
        <ExpandableDistributionChart
          title={ui.salaryDistribution}
          locale={locale}
          items={relabel(stats.salaryBreakdown, salaryRangeLabels)}
          ui={ui}
        />
      </div>

      {/* ─── Salary by country & category ─── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SalaryByGroupChart
          title={ui.salaryByCountry}
          items={stats.salaryByCountry}
          locale={locale}
          ui={ui}
        />
        <SalaryByGroupChart
          title={ui.salaryByCategory}
          items={stats.salaryByCategory}
          locale={locale}
          ui={ui}
        />
      </div>

      {/* ─── Work format & employment type ─── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ExpandableDistributionChart
          title={ui.workFormatDistribution}
          locale={locale}
          items={relabel(stats.workFormatBreakdown, workFormatLabels)}
          ui={ui}
        />
        <ExpandableDistributionChart
          title={ui.employmentTypeDistribution}
          locale={locale}
          items={relabel(stats.employmentTypeBreakdown, employmentTypeLabels)}
          ui={ui}
        />
      </div>

    </div>
  );
}
