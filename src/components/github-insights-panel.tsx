"use client";

import { useState } from "react";
import {
  DEFAULT_GITHUB_DISPLAY_OPTIONS,
  type GithubDisplayOptions,
  type GithubProjectStats,
} from "@/lib/constants/github";
import { useDictionary } from "@/lib/i18n/client";

type Props = {
  fullName: string;
  syncedAt: string | null;
  stats: GithubProjectStats | null;
  techStack: string[] | null;
  readme: string | null;
  displayOptions?: Partial<GithubDisplayOptions> | null;
  locale: string;
};

const TOP_LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178C6",
  JavaScript: "#F7DF1E",
  Python: "#3776AB",
  Go: "#00ADD8",
  Rust: "#DEA584",
  Java: "#B07219",
  Kotlin: "#A97BFF",
  Ruby: "#CC342D",
  PHP: "#777BB4",
  Swift: "#FA7343",
  C: "#555555",
  "C++": "#F34B7D",
  "C#": "#178600",
  HTML: "#E34F26",
  CSS: "#563D7C",
  SCSS: "#C6538C",
  Shell: "#89E051",
  Dart: "#00B4AB",
};

function colorFor(language: string): string {
  return TOP_LANGUAGE_COLORS[language] || "#94A3B8";
}

function formatRelative(iso: string | null, locale: string): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return locale === "uk" ? "щойно" : "just now";
  if (minutes < 60) {
    return locale === "uk" ? `${minutes} хв тому` : `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return locale === "uk" ? `${hours} год тому` : `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return locale === "uk" ? `${days} дн тому` : `${days}d ago`;
  }
  const months = Math.floor(days / 30);
  if (months < 12) {
    return locale === "uk" ? `${months} міс тому` : `${months}mo ago`;
  }
  const years = Math.floor(months / 12);
  return locale === "uk" ? `${years} р тому` : `${years}y ago`;
}

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", {
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function GithubInsightsPanel({
  fullName,
  syncedAt,
  stats,
  techStack,
  readme,
  displayOptions,
  locale,
}: Props) {
  const dictionary = useDictionary();
  const dict = dictionary.githubIntegration;
  const [readmeOpen, setReadmeOpen] = useState(false);

  const options: GithubDisplayOptions = {
    ...DEFAULT_GITHUB_DISPLAY_OPTIONS,
    ...(displayOptions || {}),
  };

  const breakdown = stats?.languageBreakdown || [];
  const topics = stats?.topics || [];
  const license = stats?.license;
  const latestRelease = stats?.latestRelease;

  return (
    <section
      aria-labelledby="github-insights-title"
      className="rounded-panel app-card p-5 sm:p-6"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="github-insights-title"
          className="font-display text-xl font-semibold tracking-tight text-[color:var(--foreground)]"
        >
          {dict.insightsTitle}
        </h2>
        <a
          href={`https://github.com/${fullName}`}
          target="_blank"
          rel="noopener noreferrer"
          className="cursor-pointer text-xs font-medium app-soft transition-colors hover:text-[color:var(--foreground)] hover:underline"
        >
          {fullName} ↗
        </a>
      </header>

      {options.showStats && stats ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full app-panel px-3 py-1 text-sm app-muted">
            ★ {stats.stars ?? 0}
          </span>
          <span className="rounded-full app-panel px-3 py-1 text-sm app-muted">
            ⑂ {stats.forks ?? 0}
          </span>
          {options.showContributors &&
          typeof stats.contributorsCount === "number" &&
          stats.contributorsCount > 0 ? (
            <span className="rounded-full app-panel px-3 py-1 text-sm app-muted">
              👥 {stats.contributorsCount}
            </span>
          ) : null}
          {typeof stats.subscribersCount === "number" &&
          stats.subscribersCount > 0 ? (
            <span className="rounded-full app-panel px-3 py-1 text-sm app-muted">
              👁 {stats.subscribersCount}
            </span>
          ) : null}
          {stats.archived ? (
            <span className="rounded-full app-panel px-3 py-1 text-sm app-muted">
              {dict.archivedBadge}
            </span>
          ) : null}
        </div>
      ) : null}

      {options.showLanguages && breakdown.length > 0 ? (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-eyebrow app-soft">
            {dict.languageBreakdown}
          </p>
          <div
            role="img"
            aria-label={breakdown
              .map((entry) => `${entry.name} ${entry.percent}%`)
              .join(", ")}
            className="flex h-2.5 w-full overflow-hidden rounded-full app-panel"
          >
            {breakdown.map((entry) => (
              <span
                key={entry.name}
                style={{
                  width: `${entry.percent}%`,
                  backgroundColor: colorFor(entry.name),
                }}
                title={`${entry.name} ${entry.percent}%`}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs app-muted">
            {breakdown.map((entry) => (
              <span key={entry.name} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: colorFor(entry.name) }}
                />
                <span className="text-[color:var(--foreground)]">
                  {entry.name}
                </span>
                <span>{entry.percent}%</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {options.showTopics && topics.length > 0 ? (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-eyebrow app-soft">
            {dict.topics}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {topics.map((topic) => (
              <span
                key={topic}
                className="rounded-full app-panel px-2.5 py-1 text-xs app-muted"
              >
                #{topic}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {(options.showActivity && (stats?.createdAt || stats?.pushedAt)) ||
      (options.showRelease && latestRelease) ||
      (options.showLicense && license) ? (
        <dl className="mt-5 grid gap-y-1 text-xs sm:grid-cols-2">
          {options.showActivity && stats?.createdAt ? (
            <div className="flex items-center gap-2">
              <dt className="app-soft">{dict.startedLabel}</dt>
              <dd className="text-[color:var(--foreground)]">
                {formatDate(stats.createdAt, locale)}
              </dd>
            </div>
          ) : null}
          {options.showActivity && stats?.pushedAt ? (
            <div className="flex items-center gap-2">
              <dt className="app-soft">{dict.lastCommitLabel}</dt>
              <dd className="text-[color:var(--foreground)]">
                {formatRelative(stats.pushedAt, locale)}
              </dd>
            </div>
          ) : null}
          {options.showRelease && latestRelease ? (
            <div className="flex items-center gap-2">
              <dt className="app-soft">{dict.latestReleaseLabel}</dt>
              <dd>
                <a
                  href={latestRelease.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cursor-pointer font-medium text-[color:var(--foreground)] hover:underline"
                >
                  {latestRelease.tagName}
                </a>
                <span className="ml-1 app-muted">
                  ({formatRelative(latestRelease.publishedAt, locale)})
                </span>
              </dd>
            </div>
          ) : null}
          {options.showLicense && license ? (
            <div className="flex items-center gap-2">
              <dt className="app-soft">{dict.licenseLabel}</dt>
              <dd className="text-[color:var(--foreground)]">
                {license.spdxId || license.name}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {techStack && techStack.length > 0 ? (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-eyebrow app-soft">
            {dict.techStack}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {techStack.slice(0, 12).map((tag) => (
              <span
                key={tag}
                className="rounded-full app-panel px-2.5 py-1 text-xs app-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {options.showReadme && readme ? (
        <div className="mt-5 rounded-2xl border app-border">
          <button
            type="button"
            onClick={() => setReadmeOpen((value) => !value)}
            aria-expanded={readmeOpen}
            className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left text-sm font-medium text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--surface-muted)]"
          >
            <span>{dict.readmeTitle}</span>
            <span aria-hidden="true">{readmeOpen ? "▾" : "▸"}</span>
          </button>
          {readmeOpen ? (
            <pre className="max-h-96 overflow-auto border-t app-border bg-[color:var(--surface-muted)] px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap text-[color:var(--foreground)]">
              {readme}
            </pre>
          ) : null}
        </div>
      ) : null}

      {syncedAt ? (
        <p className="mt-4 text-[11px] app-soft">
          {dict.lastSynced}: {formatRelative(syncedAt, locale)}
        </p>
      ) : null}
    </section>
  );
}
