import type {
  GithubProjectStats,
  GithubRepoDetail,
} from "@/lib/constants/github";

/**
 * Pure mapping: GitHub repository → the column patch we write to the
 * `projects` table. Kept free of the `server-only` import so it can be
 * unit-tested without touching the database layer.
 *
 * Rules of thumb:
 *   - User-authored text (description, problem, etc.) is never
 *     overwritten — GitHub values are only used to fill BLANK columns.
 *   - README is NOT promoted into `solution`. It lands in its own
 *     `github_readme` column and is rendered as a separate card on the
 *     project page (collapsible). This keeps the project's voice (the
 *     repo) clearly separate from the author's voice (solution / role /
 *     contribution narrative fields).
 *   - Languages + Topics merge into `tech_stack` (deduped, ordered).
 *   - Archived repos imply project_status = "completed".
 *   - Created-at → started_on (YYYY-MM-DD).
 *   - Contributors count → team_size.
 */
export function mapRepoToProjectColumns(
  repo: GithubRepoDetail,
  current: {
    description: string | null;
    project_status?: string | null;
    team_size?: number | null;
    started_on?: string | null;
  },
): {
  description: string | null;
  project_url: string | null;
  repository_url: string;
  project_status: string | null;
  team_size: number | null;
  started_on: string | null;
  github_repo_id: number;
  github_full_name: string;
  github_default_branch: string;
  github_synced_at: string;
  github_stats: GithubProjectStats;
  github_readme: string | null;
  tech_stack: string[];
} {
  const stats: GithubProjectStats = {
    stars: repo.stargazersCount,
    forks: repo.forksCount,
    watchers: repo.watchersCount,
    openIssues: repo.openIssuesCount,
    size: repo.size,
    subscribersCount: repo.subscribersCount,
    contributorsCount: repo.contributorsCount,
    defaultBranch: repo.defaultBranch,
    pushedAt: repo.pushedAt,
    createdAt: repo.createdAt,
    homepage: repo.homepage,
    license: repo.license,
    latestRelease: repo.latestRelease,
    topics: repo.topics,
    languageBreakdown: repo.languageBreakdown,
    archived: repo.isArchived,
  };

  const techStack: string[] = [];
  const seen = new Set<string>();
  for (const name of [...repo.languages, ...repo.topics]) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    techStack.push(trimmed);
  }

  // started_on: GitHub gives ISO timestamp; project column is a date.
  let startedOn: string | null = current.started_on ?? null;
  if (!startedOn && repo.createdAt) {
    const match = repo.createdAt.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) startedOn = match[1];
  }

  // project_status: only set when blank and the repo is archived.
  let projectStatus: string | null = current.project_status ?? null;
  if (!projectStatus && repo.isArchived) projectStatus = "completed";

  // team_size: only set when blank (>0 to satisfy positive-integer check).
  let teamSize: number | null = current.team_size ?? null;
  if ((teamSize === null || teamSize === undefined) && repo.contributorsCount > 0) {
    teamSize = repo.contributorsCount;
  }

  return {
    description:
      current.description && current.description.trim().length > 0
        ? current.description
        : repo.description,
    project_url: repo.homepage,
    repository_url: repo.htmlUrl,
    project_status: projectStatus,
    team_size: teamSize,
    started_on: startedOn,
    github_repo_id: repo.id,
    github_full_name: repo.fullName,
    github_default_branch: repo.defaultBranch,
    github_synced_at: new Date().toISOString(),
    github_stats: stats,
    github_readme: repo.readme,
    tech_stack: techStack,
  };
}
