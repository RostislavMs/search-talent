import "server-only";

import {
  GITHUB_API_BASE,
  GITHUB_README_FETCH_CHAR_LIMIT,
  GITHUB_REPOS_MAX_PAGES,
  GITHUB_REPOS_MAX_PER_PAGE,
  GITHUB_TOKEN_URL,
  type GithubLanguageBreakdown,
  type GithubReleaseInfo,
  type GithubRepoDetail,
  type GithubRepoSummary,
} from "@/lib/constants/github";

/**
 * Thin async wrapper around GitHub's REST API. Each call goes out with
 * the supplied bearer token; the caller is responsible for loading and
 * persisting the token via `@/lib/db/github-integrations`.
 *
 * All functions return null/empty on failure rather than throwing — the
 * sync feature must degrade gracefully when GitHub is unreachable or
 * the user revoked access externally.
 */

const COMMON_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

function authHeaders(accessToken: string) {
  return {
    ...COMMON_HEADERS,
    Authorization: `Bearer ${accessToken}`,
  };
}

type GhRepoApi = {
  id: number;
  full_name: string;
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  default_branch: string;
  private: boolean;
  fork: boolean;
  archived: boolean;
  pushed_at: string | null;
  updated_at: string | null;
  created_at: string | null;
  topics?: string[] | null;
  license?: {
    key?: string;
    name?: string;
    spdx_id?: string | null;
  } | null;
  size?: number;
  subscribers_count?: number;
};

function mapRepo(row: GhRepoApi): GithubRepoSummary {
  return {
    id: row.id,
    fullName: row.full_name,
    name: row.name,
    description: row.description,
    htmlUrl: row.html_url,
    homepage: row.homepage,
    language: row.language,
    stargazersCount: row.stargazers_count,
    forksCount: row.forks_count,
    watchersCount: row.watchers_count,
    openIssuesCount: row.open_issues_count,
    defaultBranch: row.default_branch,
    isPrivate: row.private,
    isFork: row.fork,
    isArchived: row.archived,
    pushedAt: row.pushed_at,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    topics: Array.isArray(row.topics) ? row.topics : [],
    license:
      row.license && row.license.key
        ? {
            key: row.license.key,
            name: row.license.name || row.license.key,
            spdxId: row.license.spdx_id ?? null,
          }
        : null,
    size: row.size ?? 0,
    subscribersCount: row.subscribers_count ?? 0,
  };
}

export async function exchangeCodeForToken(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<{
  accessToken: string;
  tokenType: string;
  scopes: string[];
} | null> {
  try {
    const response = await fetch(GITHUB_TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: params.code,
        client_id: params.clientId,
        client_secret: params.clientSecret,
        redirect_uri: params.redirectUri,
      }),
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      access_token?: string;
      token_type?: string;
      scope?: string;
      error?: string;
    };

    if (!payload.access_token) return null;

    return {
      accessToken: payload.access_token,
      tokenType: payload.token_type || "bearer",
      scopes: (payload.scope || "").split(/[, ]+/).filter(Boolean),
    };
  } catch (error) {
    console.error("[github] token exchange failed", error);
    return null;
  }
}

export async function fetchAuthenticatedUser(accessToken: string): Promise<{
  id: number;
  login: string;
  avatarUrl: string | null;
} | null> {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/user`, {
      headers: authHeaders(accessToken),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      id: number;
      login: string;
      avatar_url: string | null;
    };
    return {
      id: payload.id,
      login: payload.login,
      avatarUrl: payload.avatar_url,
    };
  } catch (error) {
    console.error("[github] /user failed", error);
    return null;
  }
}

/**
 * Lists repos the authenticated user owns or has explicit access to.
 * Paginated up to `GITHUB_REPOS_MAX_PAGES * GITHUB_REPOS_MAX_PER_PAGE`.
 */
export async function listUserRepos(accessToken: string): Promise<GithubRepoSummary[]> {
  const all: GithubRepoSummary[] = [];

  for (let page = 1; page <= GITHUB_REPOS_MAX_PAGES; page += 1) {
    try {
      const url = new URL(`${GITHUB_API_BASE}/user/repos`);
      url.searchParams.set("per_page", String(GITHUB_REPOS_MAX_PER_PAGE));
      url.searchParams.set("page", String(page));
      url.searchParams.set("sort", "updated");
      url.searchParams.set("affiliation", "owner,collaborator");

      const response = await fetch(url.toString(), {
        headers: authHeaders(accessToken),
      });

      if (!response.ok) break;

      const rows = (await response.json()) as GhRepoApi[];
      if (!Array.isArray(rows) || rows.length === 0) break;

      for (const row of rows) all.push(mapRepo(row));

      if (rows.length < GITHUB_REPOS_MAX_PER_PAGE) break;
    } catch (error) {
      console.error("[github] list repos failed", error);
      break;
    }
  }

  return all;
}

export async function fetchRepoByFullName(
  accessToken: string,
  fullName: string,
): Promise<GithubRepoSummary | null> {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${fullName}`, {
      headers: authHeaders(accessToken),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as GhRepoApi;
    return mapRepo(payload);
  } catch (error) {
    console.error("[github] fetch repo failed", error);
    return null;
  }
}

export async function fetchRepoLanguages(
  accessToken: string,
  fullName: string,
): Promise<GithubLanguageBreakdown[]> {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${fullName}/languages`,
      { headers: authHeaders(accessToken) },
    );
    if (!response.ok) return [];
    const payload = (await response.json()) as Record<string, number>;
    const entries = Object.entries(payload);
    const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0);
    if (total === 0) return entries.map(([name]) => ({ name, bytes: 0, percent: 0 }));
    return entries
      .map(([name, bytes]) => ({
        name,
        bytes,
        percent: Math.round((bytes / total) * 1000) / 10,
      }))
      .sort((a, b) => b.bytes - a.bytes);
  } catch (error) {
    console.error("[github] fetch languages failed", error);
    return [];
  }
}

/**
 * Counts unique contributors via the dedicated `contributors` endpoint.
 * Uses HEAD-style pagination (per_page=1 + last-page Link header) so we
 * don't have to pull every contributor — only the count.
 */
export async function fetchContributorsCount(
  accessToken: string,
  fullName: string,
): Promise<number> {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${fullName}/contributors?per_page=1&anon=1`,
      { headers: authHeaders(accessToken) },
    );
    if (!response.ok) return 0;

    const link = response.headers.get("link") || "";
    const lastMatch = link.match(/<[^>]*[?&]page=(\d+)[^>]*>; rel="last"/);
    if (lastMatch) return Number(lastMatch[1]) || 0;

    // No Link header → either ≤1 contributor or the API didn't paginate.
    const rows = (await response.json()) as unknown[];
    return Array.isArray(rows) ? rows.length : 0;
  } catch (error) {
    console.error("[github] fetch contributors failed", error);
    return 0;
  }
}

export async function fetchLatestRelease(
  accessToken: string,
  fullName: string,
): Promise<GithubReleaseInfo | null> {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${fullName}/releases/latest`,
      { headers: authHeaders(accessToken) },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      tag_name?: string;
      name?: string | null;
      published_at?: string | null;
      html_url?: string;
      prerelease?: boolean;
    };
    if (!payload.tag_name || !payload.html_url) return null;
    return {
      tagName: payload.tag_name,
      name: payload.name ?? null,
      publishedAt: payload.published_at ?? null,
      htmlUrl: payload.html_url,
      isPrerelease: Boolean(payload.prerelease),
    };
  } catch (error) {
    console.error("[github] fetch latest release failed", error);
    return null;
  }
}

export async function fetchRepoReadme(
  accessToken: string,
  fullName: string,
): Promise<string | null> {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${fullName}/readme`,
      {
        headers: {
          ...authHeaders(accessToken),
          // raw view returns the README body directly without base64.
          Accept: "application/vnd.github.raw+json",
        },
      },
    );
    if (!response.ok) return null;
    return await response.text();
  } catch (error) {
    console.error("[github] fetch readme failed", error);
    return null;
  }
}

/**
 * Aggregate fetch: repo metadata + languages + readme + contributors
 * count + latest release. Used by the import preview and the sync
 * endpoint. README is capped at `GITHUB_README_FETCH_CHAR_LIMIT`.
 */
export async function fetchRepoFullDetail(
  accessToken: string,
  fullName: string,
): Promise<GithubRepoDetail | null> {
  const [repo, languageBreakdown, readme, contributorsCount, latestRelease] =
    await Promise.all([
      fetchRepoByFullName(accessToken, fullName),
      fetchRepoLanguages(accessToken, fullName),
      fetchRepoReadme(accessToken, fullName),
      fetchContributorsCount(accessToken, fullName),
      fetchLatestRelease(accessToken, fullName),
    ]);

  if (!repo) return null;

  const cappedReadme =
    typeof readme === "string" && readme.length > GITHUB_README_FETCH_CHAR_LIMIT
      ? readme.slice(0, GITHUB_README_FETCH_CHAR_LIMIT)
      : readme;

  return {
    ...repo,
    languages: languageBreakdown.map((entry) => entry.name),
    languageBreakdown,
    readme: cappedReadme,
    contributorsCount,
    latestRelease,
  };
}
