import "server-only";

import {
  PROVIDER_LONG_TEXT_CHAR_LIMIT,
  type IntegrationResourceDetail,
  type IntegrationResourceSummary,
  type IntegrationStat,
} from "@/lib/constants/provider-integrations";
import type { ProviderAdapter, ProviderTokenSet } from "./provider-types";

/**
 * GitLab (gitlab.com) OAuth + REST v4 adapter.
 *
 * Same contract as the GitHub client: every call resolves to null/empty
 * instead of throwing, so a revoked token or an unreachable GitLab degrades
 * the import/sync instead of breaking the page.
 *
 * Self-managed GitLab instances are deliberately out of scope — they need a
 * per-user base URL and their own OAuth app.
 */

const GITLAB_BASE = "https://gitlab.com";
const GITLAB_API = `${GITLAB_BASE}/api/v4`;

/** `read_api` covers projects/languages/contributors; `read_user` the account. */
const GITLAB_SCOPES = ["read_api", "read_user"] as const;

const PER_PAGE = 100;
const MAX_PAGES = 3;

/** README names tried in order when the project has no readme_url. */
const README_FALLBACKS = ["README.md", "README.rst", "README.txt", "README"];

type GitlabProjectApi = {
  id: number;
  name: string;
  name_with_namespace?: string;
  path_with_namespace: string;
  description: string | null;
  web_url: string;
  star_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  default_branch?: string | null;
  visibility?: string;
  archived?: boolean;
  created_at?: string | null;
  last_activity_at?: string | null;
  topics?: string[] | null;
  tag_list?: string[] | null;
  readme_url?: string | null;
  license?: { key?: string; name?: string; nickname?: string | null } | null;
};

function authHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

function encodeRef(ref: string) {
  // GitLab addresses a project either by numeric id or by URL-encoded path.
  return encodeURIComponent(ref);
}

function toTokenSet(payload: {
  access_token?: string;
  token_type?: string;
  refresh_token?: string | null;
  expires_in?: number | null;
  scope?: string | null;
}): ProviderTokenSet | null {
  if (!payload.access_token) {
    return null;
  }

  return {
    accessToken: payload.access_token,
    tokenType: payload.token_type || "bearer",
    refreshToken: payload.refresh_token || null,
    expiresAt:
      typeof payload.expires_in === "number" && payload.expires_in > 0
        ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
        : null,
    scopes: (payload.scope || GITLAB_SCOPES.join(" ")).split(/[, ]+/).filter(Boolean),
  };
}

async function requestToken(
  body: Record<string, string>,
): Promise<ProviderTokenSet | null> {
  try {
    const response = await fetch(`${GITLAB_BASE}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    });

    if (!response.ok) {
      return null;
    }

    return toTokenSet(await response.json());
  } catch (error) {
    console.error("[gitlab] token request failed", error);
    return null;
  }
}

function summarize(row: GitlabProjectApi): IntegrationResourceSummary {
  const meta = [
    row.default_branch || null,
    typeof row.star_count === "number" ? `★ ${row.star_count}` : null,
    typeof row.forks_count === "number" ? `⑂ ${row.forks_count}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    externalId: String(row.id),
    ref: row.path_with_namespace,
    name: row.name,
    description: row.description,
    url: row.web_url,
    meta: meta || null,
    thumbnailUrl: null,
    isPrivate: row.visibility !== "public",
  };
}

async function fetchLanguages(
  accessToken: string,
  ref: string,
): Promise<string[]> {
  try {
    const response = await fetch(
      `${GITLAB_API}/projects/${encodeRef(ref)}/languages`,
      { headers: authHeaders(accessToken) },
    );
    if (!response.ok) return [];
    const payload = (await response.json()) as Record<string, number>;
    return Object.entries(payload)
      .sort(([, a], [, b]) => b - a)
      .map(([name]) => name);
  } catch (error) {
    console.error("[gitlab] languages failed", error);
    return [];
  }
}

async function fetchContributorsCount(
  accessToken: string,
  ref: string,
): Promise<number> {
  try {
    const response = await fetch(
      `${GITLAB_API}/projects/${encodeRef(ref)}/repository/contributors?per_page=${PER_PAGE}`,
      { headers: authHeaders(accessToken) },
    );
    if (!response.ok) return 0;

    // GitLab reports the real total in a header when it paginates.
    const total = Number(response.headers.get("x-total"));
    if (Number.isFinite(total) && total > 0) return total;

    const rows = (await response.json()) as unknown[];
    return Array.isArray(rows) ? rows.length : 0;
  } catch (error) {
    console.error("[gitlab] contributors failed", error);
    return 0;
  }
}

/**
 * Reads the project README. Prefers the path GitLab reports in `readme_url`
 * (any name, any folder) and falls back to the usual suspects at the root.
 */
async function fetchReadme(
  accessToken: string,
  ref: string,
  branch: string,
  readmeUrl: string | null,
): Promise<string | null> {
  const candidates: string[] = [];

  if (readmeUrl) {
    const match = readmeUrl.match(/\/-\/blob\/[^/]+\/(.+)$/);
    if (match?.[1]) candidates.push(decodeURIComponent(match[1]));
  }

  for (const fallback of README_FALLBACKS) {
    if (!candidates.includes(fallback)) candidates.push(fallback);
  }

  for (const path of candidates) {
    try {
      const response = await fetch(
        `${GITLAB_API}/projects/${encodeRef(ref)}/repository/files/${encodeURIComponent(path)}/raw?ref=${encodeURIComponent(branch)}`,
        { headers: authHeaders(accessToken) },
      );
      if (!response.ok) continue;
      const body = await response.text();
      if (!body.trim()) continue;
      return body.length > PROVIDER_LONG_TEXT_CHAR_LIMIT
        ? body.slice(0, PROVIDER_LONG_TEXT_CHAR_LIMIT)
        : body;
    } catch (error) {
      console.error("[gitlab] readme failed", error);
    }
  }

  return null;
}

export const gitlabAdapter: ProviderAdapter = {
  id: "gitlab",
  scopes: [...GITLAB_SCOPES],
  clientIdEnv: "GITLAB_OAUTH_CLIENT_ID",
  clientSecretEnv: "GITLAB_OAUTH_CLIENT_SECRET",
  // group/subgroup/project — at least one slash, no path traversal.
  refPattern: /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)+$/,

  buildAuthorizeUrl({ clientId, redirectUri, state }) {
    const url = new URL(`${GITLAB_BASE}/oauth/authorize`);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    url.searchParams.set("scope", GITLAB_SCOPES.join(" "));
    return url.toString();
  },

  exchangeCodeForToken({ code, clientId, clientSecret, redirectUri }) {
    return requestToken({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });
  },

  refreshAccessToken({ refreshToken, clientId, clientSecret, redirectUri }) {
    return requestToken({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      redirect_uri: redirectUri,
    });
  },

  async fetchAccount(accessToken) {
    try {
      const response = await fetch(`${GITLAB_API}/user`, {
        headers: authHeaders(accessToken),
      });
      if (!response.ok) return null;
      const payload = (await response.json()) as {
        id: number;
        username: string;
        avatar_url?: string | null;
      };
      return {
        id: String(payload.id),
        login: payload.username,
        avatarUrl: payload.avatar_url || null,
      };
    } catch (error) {
      console.error("[gitlab] /user failed", error);
      return null;
    }
  },

  async listResources(accessToken) {
    const all: IntegrationResourceSummary[] = [];

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      try {
        const url = new URL(`${GITLAB_API}/projects`);
        url.searchParams.set("membership", "true");
        url.searchParams.set("order_by", "last_activity_at");
        url.searchParams.set("per_page", String(PER_PAGE));
        url.searchParams.set("page", String(page));

        const response = await fetch(url.toString(), {
          headers: authHeaders(accessToken),
        });
        if (!response.ok) break;

        const rows = (await response.json()) as GitlabProjectApi[];
        if (!Array.isArray(rows) || rows.length === 0) break;

        for (const row of rows) all.push(summarize(row));
        if (rows.length < PER_PAGE) break;
      } catch (error) {
        console.error("[gitlab] list projects failed", error);
        break;
      }
    }

    return all;
  },

  async fetchResource(accessToken, ref): Promise<IntegrationResourceDetail | null> {
    let project: GitlabProjectApi | null = null;

    try {
      const response = await fetch(
        `${GITLAB_API}/projects/${encodeRef(ref)}?license=true`,
        { headers: authHeaders(accessToken) },
      );
      if (!response.ok) return null;
      project = (await response.json()) as GitlabProjectApi;
    } catch (error) {
      console.error("[gitlab] fetch project failed", error);
      return null;
    }

    if (!project?.path_with_namespace) {
      return null;
    }

    const branch = project.default_branch || "main";
    const [languages, contributorsCount, readme] = await Promise.all([
      fetchLanguages(accessToken, ref),
      fetchContributorsCount(accessToken, ref),
      fetchReadme(accessToken, ref, branch, project.readme_url ?? null),
    ]);

    const topics = [
      ...(Array.isArray(project.topics) ? project.topics : []),
      ...(Array.isArray(project.tag_list) ? project.tag_list : []),
    ];

    const stats: IntegrationStat[] = [];
    const pushStat = (key: IntegrationStat["key"], value: string | null) => {
      if (value) stats.push({ key, value });
    };

    pushStat("stars", project.star_count ? String(project.star_count) : null);
    pushStat("forks", project.forks_count ? String(project.forks_count) : null);
    pushStat(
      "openIssues",
      project.open_issues_count ? String(project.open_issues_count) : null,
    );
    pushStat("contributors", contributorsCount ? String(contributorsCount) : null);
    pushStat("branch", project.default_branch || null);
    pushStat("lastActivity", project.last_activity_at || null);
    pushStat(
      "license",
      project.license?.nickname || project.license?.name || null,
    );
    pushStat("languages", languages.slice(0, 6).join(", ") || null);

    return {
      ...summarize(project),
      homepageUrl: null,
      createdAt: project.created_at ?? null,
      updatedAt: project.last_activity_at ?? null,
      archived: Boolean(project.archived),
      teamSize: contributorsCount > 0 ? contributorsCount : null,
      tags: [...languages, ...topics],
      longText: readme,
      stats,
    };
  },
};
