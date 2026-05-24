/**
 * GitHub OAuth scope set the integration requests.
 * `read:user` — basic profile (login, id, avatar).
 * `public_repo` — list + read public repositories.
 *
 * We do NOT request `repo` (full private access) by default to stay
 * least-privilege. Users with private repos they want to import can
 * upgrade scopes manually in their GitHub OAuth App settings.
 */
export const GITHUB_OAUTH_SCOPES = ["read:user", "public_repo"] as const;

export const GITHUB_OAUTH_SCOPE_STRING = GITHUB_OAUTH_SCOPES.join(" ");

export const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
export const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
export const GITHUB_API_BASE = "https://api.github.com";

export const GITHUB_OAUTH_STATE_COOKIE = "gh_oauth_state";
export const GITHUB_OAUTH_STATE_TTL_SECONDS = 600;

/** Hard cap to prevent runaway pagination on the repo listing endpoint. */
export const GITHUB_REPOS_MAX_PER_PAGE = 100;
export const GITHUB_REPOS_MAX_PAGES = 3;

/** Treat a project as "fresh" if its last sync was within this window. */
export const GITHUB_AUTO_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type GithubRepoSummary = {
  id: number;
  fullName: string;
  name: string;
  description: string | null;
  htmlUrl: string;
  homepage: string | null;
  language: string | null;
  stargazersCount: number;
  forksCount: number;
  watchersCount: number;
  openIssuesCount: number;
  defaultBranch: string;
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  pushedAt: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  topics: string[];
  license: { key: string; name: string; spdxId: string | null } | null;
  size: number;
  subscribersCount: number;
};

export type GithubReleaseInfo = {
  tagName: string;
  name: string | null;
  publishedAt: string | null;
  htmlUrl: string;
  isPrerelease: boolean;
};

export type GithubLanguageBreakdown = {
  name: string;
  bytes: number;
  percent: number;
};

export type GithubRepoDetail = GithubRepoSummary & {
  languages: string[];
  languageBreakdown: GithubLanguageBreakdown[];
  readme: string | null;
  contributorsCount: number;
  latestRelease: GithubReleaseInfo | null;
};

export type GithubIntegrationSummary = {
  githubLogin: string;
  githubUserId: number;
  githubAvatarUrl: string | null;
  scopes: string[];
  connectedAt: string;
};

export type GithubProjectStats = {
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  size?: number;
  subscribersCount?: number;
  contributorsCount?: number;
  defaultBranch?: string;
  pushedAt?: string | null;
  createdAt?: string | null;
  homepage?: string | null;
  license?: { key: string; name: string; spdxId: string | null } | null;
  latestRelease?: GithubReleaseInfo | null;
  topics?: string[];
  languageBreakdown?: GithubLanguageBreakdown[];
  archived?: boolean;
};

/**
 * Hard cap on the README body when fetched from GitHub. Stored verbatim
 * in `projects.github_readme`; the project page renders it in a
 * collapsible "Project README" card.
 */
export const GITHUB_README_FETCH_CHAR_LIMIT = 50_000;

/** Allowed values for `projects.github_role`. NULL = not specified. */
export const GITHUB_PROJECT_ROLES = [
  "solo",
  "founder",
  "maintainer",
  "core_contributor",
  "contributor",
  "fork_owner",
] as const;

export type GithubProjectRole = (typeof GITHUB_PROJECT_ROLES)[number];

export const GITHUB_FIELD_LIMITS = {
  contribution: 2000,
  motivation: 1500,
  techDecisions: 2000,
  learnings: 1500,
  showcaseNotes: 1500,
  productionUsage: 500,
} as const;

export type GithubDisplayOptions = {
  showStats: boolean;
  showLanguages: boolean;
  showRelease: boolean;
  showLicense: boolean;
  showContributors: boolean;
  showActivity: boolean;
  showTopics: boolean;
  showReadme: boolean;
};

export const DEFAULT_GITHUB_DISPLAY_OPTIONS: GithubDisplayOptions = {
  showStats: true,
  showLanguages: true,
  showRelease: true,
  showLicense: true,
  showContributors: true,
  showActivity: true,
  showTopics: true,
  showReadme: true,
};
