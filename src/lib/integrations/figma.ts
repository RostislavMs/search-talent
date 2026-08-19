import "server-only";

import type {
  IntegrationResourceDetail,
  IntegrationResourceSummary,
  IntegrationStat,
} from "@/lib/constants/provider-integrations";
import type { ProviderAdapter, ProviderTokenSet } from "./provider-types";

/**
 * Figma OAuth + REST adapter.
 *
 * Figma has no "list every file I can see" endpoint, and the endpoints that
 * walk a team's projects (`/v1/teams/:id/projects`, `/v1/projects/:id/files`)
 * are documented as unusable from a public OAuth app — and ours must be
 * public, since arbitrary users connect their own Figma. So discovery is by
 * pasted file link: `searchResources` resolves it, `listResources` is empty.
 *
 * That is still a real authorised import — the name, pages, components,
 * styles, version and edit time all come from the API, not from the URL.
 */

const FIGMA_API = "https://api.figma.com";
const FIGMA_AUTHORIZE = "https://www.figma.com/oauth";

/**
 * Figma retired the coarse `file_read` / `files:read` scopes in favour of
 * granular ones, so an app published today must ask for exactly what it
 * calls: the account (`/v1/me`), the cheap metadata used for the preview
 * (`/meta`), the file body read once on import (`/v1/files/:key`) and the
 * published assets (`/components`, `/styles`).
 */
const FIGMA_SCOPES = [
  "current_user:read",
  "file_metadata:read",
  "file_content:read",
  "library_assets:read",
] as const;

type FigmaFileApi = {
  name?: string;
  lastModified?: string | null;
  thumbnailUrl?: string | null;
  version?: string | null;
  document?: { children?: Array<{ id: string; name: string }> | null } | null;
};

function authHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

function fileUrl(key: string) {
  return `https://www.figma.com/design/${key}`;
}

function basicAuth(clientId: string, clientSecret: string) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

function toTokenSet(payload: {
  access_token?: string;
  refresh_token?: string | null;
  expires_in?: number | null;
}): ProviderTokenSet | null {
  if (!payload.access_token) {
    return null;
  }

  return {
    accessToken: payload.access_token,
    tokenType: "bearer",
    refreshToken: payload.refresh_token || null,
    expiresAt:
      typeof payload.expires_in === "number" && payload.expires_in > 0
        ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
        : null,
    scopes: [...FIGMA_SCOPES],
  };
}

/**
 * Pulls the file key out of a pasted Figma URL, or accepts a bare key typed
 * by hand. Returns null for anything else — including team and project links,
 * which a public OAuth app is not allowed to expand.
 *
 * Exported for unit tests: the parsing is where the sharp edges live.
 */
export function parseFigmaFileKey(input: string): string | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  if (/^[A-Za-z0-9]{10,64}$/.test(trimmed)) {
    return trimmed;
  }

  let path: string;
  try {
    const url = new URL(trimmed);
    if (!/(^|\.)figma\.com$/.test(url.hostname.toLowerCase())) {
      return null;
    }
    path = url.pathname;
  } catch {
    return null;
  }

  const file = path.match(
    /\/(?:file|design|board|slides|proto)\/([A-Za-z0-9]{10,64})/,
  );

  return file?.[1] ?? null;
}

async function fetchFile(
  accessToken: string,
  key: string,
): Promise<FigmaFileApi | null> {
  try {
    // depth=1 returns the page list without the whole node tree — a full file
    // payload can be tens of megabytes.
    const response = await fetch(`${FIGMA_API}/v1/files/${key}?depth=1`, {
      headers: authHeaders(accessToken),
    });
    if (!response.ok) return null;
    return (await response.json()) as FigmaFileApi;
  } catch (error) {
    console.error("[figma] fetch file failed", error);
    return null;
  }
}

/**
 * The metadata-only twin of `fetchFile`. It is a Tier 3 call against a Tier 1
 * one, so the preview shown before the author confirms an import costs a
 * fraction of the rate-limit budget — which matters on a Starter plan, where
 * Tier 1 is capped at 10/min.
 */
async function fetchFileMeta(
  accessToken: string,
  key: string,
): Promise<{
  name: string | null;
  thumbnailUrl: string | null;
  lastTouchedAt: string | null;
} | null> {
  try {
    const response = await fetch(`${FIGMA_API}/v1/files/${key}/meta`, {
      headers: authHeaders(accessToken),
    });
    if (!response.ok) return null;
    // Unlike the file endpoint, /meta wraps its payload and uses snake_case.
    const payload = (await response.json()) as {
      file?: {
        name?: string | null;
        thumbnail_url?: string | null;
        last_touched_at?: string | null;
      } | null;
    };
    if (!payload.file) return null;
    return {
      name: payload.file.name || null,
      thumbnailUrl: payload.file.thumbnail_url || null,
      lastTouchedAt: payload.file.last_touched_at || null,
    };
  } catch (error) {
    console.error("[figma] file meta failed", error);
    return null;
  }
}

function summarize(
  key: string,
  values: {
    name: string | null;
    thumbnailUrl: string | null;
    lastTouchedAt: string | null;
  },
): IntegrationResourceSummary {
  return {
    externalId: key,
    ref: key,
    name: values.name || key,
    description: null,
    url: fileUrl(key),
    meta: values.lastTouchedAt,
    thumbnailUrl: values.thumbnailUrl,
    isPrivate: true,
  };
}

async function countMeta(
  accessToken: string,
  key: string,
  segment: "components" | "styles",
): Promise<number> {
  try {
    const response = await fetch(`${FIGMA_API}/v1/files/${key}/${segment}`, {
      headers: authHeaders(accessToken),
    });
    if (!response.ok) return 0;
    const payload = (await response.json()) as {
      meta?: Record<string, unknown> | null;
    };
    const rows = payload.meta?.[segment];
    return Array.isArray(rows) ? rows.length : 0;
  } catch (error) {
    console.error(`[figma] ${segment} failed`, error);
    return 0;
  }
}

export const figmaAdapter: ProviderAdapter = {
  id: "figma",
  scopes: [...FIGMA_SCOPES],
  clientIdEnv: "FIGMA_OAUTH_CLIENT_ID",
  clientSecretEnv: "FIGMA_OAUTH_CLIENT_SECRET",
  refPattern: /^[A-Za-z0-9]{10,64}$/,

  buildAuthorizeUrl({ clientId, redirectUri, state }) {
    const url = new URL(FIGMA_AUTHORIZE);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", FIGMA_SCOPES.join(" "));
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    return url.toString();
  },

  async exchangeCodeForToken({ code, clientId, clientSecret, redirectUri }) {
    try {
      const response = await fetch(`${FIGMA_API}/v1/oauth/token`, {
        method: "POST",
        headers: {
          Authorization: basicAuth(clientId, clientSecret),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          redirect_uri: redirectUri,
          code,
          grant_type: "authorization_code",
        }).toString(),
      });
      if (!response.ok) return null;
      return toTokenSet(await response.json());
    } catch (error) {
      console.error("[figma] token exchange failed", error);
      return null;
    }
  },

  async refreshAccessToken({ refreshToken, clientId, clientSecret }) {
    try {
      const response = await fetch(`${FIGMA_API}/v1/oauth/refresh`, {
        method: "POST",
        headers: {
          Authorization: basicAuth(clientId, clientSecret),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ refresh_token: refreshToken }).toString(),
      });
      if (!response.ok) return null;
      const token = toTokenSet(await response.json());
      // Figma's refresh response omits the refresh token — keep the old one.
      return token ? { ...token, refreshToken } : null;
    } catch (error) {
      console.error("[figma] token refresh failed", error);
      return null;
    }
  },

  async fetchAccount(accessToken) {
    try {
      const response = await fetch(`${FIGMA_API}/v1/me`, {
        headers: authHeaders(accessToken),
      });
      if (!response.ok) return null;
      const payload = (await response.json()) as {
        id: string;
        handle?: string;
        email?: string;
        img_url?: string | null;
      };
      return {
        id: String(payload.id),
        login: payload.handle || payload.email || String(payload.id),
        avatarUrl: payload.img_url || null,
      };
    } catch (error) {
      console.error("[figma] /me failed", error);
      return null;
    }
  },

  // Figma exposes no account-wide file listing; discovery goes through
  // searchResources with a pasted file link.
  async listResources() {
    return [];
  },

  async searchResources(accessToken, query) {
    const key = parseFigmaFileKey(query);

    if (!key) {
      return [];
    }

    const meta = await fetchFileMeta(accessToken, key);

    if (meta) {
      return [summarize(key, meta)];
    }

    // An app authorised before `file_metadata:read` was granted still gets a
    // preview — just at the cost of a full (Tier 1) file read.
    const file = await fetchFile(accessToken, key);

    return file
      ? [
          summarize(key, {
            name: file.name ?? null,
            thumbnailUrl: file.thumbnailUrl ?? null,
            lastTouchedAt: file.lastModified ?? null,
          }),
        ]
      : [];
  },

  async fetchResource(accessToken, ref): Promise<IntegrationResourceDetail | null> {
    const file = await fetchFile(accessToken, ref);

    if (!file) {
      return null;
    }

    const [components, styles] = await Promise.all([
      countMeta(accessToken, ref, "components"),
      countMeta(accessToken, ref, "styles"),
    ]);

    const pages = file.document?.children?.length ?? 0;
    const stats: IntegrationStat[] = [];
    const pushStat = (key: IntegrationStat["key"], value: string | null) => {
      if (value) stats.push({ key, value });
    };

    pushStat("pages", pages ? String(pages) : null);
    pushStat("components", components ? String(components) : null);
    pushStat("styles", styles ? String(styles) : null);
    pushStat("version", file.version || null);
    pushStat("lastModified", file.lastModified || null);

    return {
      ...summarize(ref, {
        name: file.name ?? null,
        thumbnailUrl: file.thumbnailUrl ?? null,
        lastTouchedAt: file.lastModified ?? null,
      }),
      homepageUrl: null,
      // Figma reports no creation time, only the last edit.
      createdAt: null,
      updatedAt: file.lastModified ?? null,
      archived: false,
      teamSize: null,
      tags: ["Figma"],
      longText: null,
      stats,
    };
  },
};
