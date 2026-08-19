import "server-only";

import {
  PROVIDER_LONG_TEXT_CHAR_LIMIT,
  type IntegrationResourceDetail,
  type IntegrationResourceSummary,
  type IntegrationStat,
} from "@/lib/constants/provider-integrations";
import type { ProviderAdapter, ProviderTokenSet } from "./provider-types";

/**
 * Vimeo OAuth 2 + REST API adapter.
 *
 * Vimeo's tokens do not expire and the API has a proper "my videos" listing,
 * so this is the simplest shape a provider can take: connect once, pick from
 * a list, done.
 */

const VIMEO_API = "https://api.vimeo.com";

/**
 * `private` covers the author's own unlisted/private uploads; without it the
 * listing would silently skip everything not published publicly.
 */
const VIMEO_SCOPES = ["public", "private"] as const;

/** Pin the API version so a server-side change cannot reshape our payloads. */
const VIMEO_ACCEPT = "application/vnd.vimeo.*+json;version=3.4";

const PER_PAGE = 100;

/** Only the fields we map — Vimeo's default video payload is enormous. */
const VIDEO_FIELDS = [
  "uri",
  "name",
  "description",
  "link",
  "duration",
  "created_time",
  "modified_time",
  "release_time",
  "privacy.view",
  "pictures.base_link",
  "stats.plays",
  "tags.name",
].join(",");

type VimeoVideoApi = {
  uri?: string;
  name?: string | null;
  description?: string | null;
  link?: string | null;
  duration?: number | null;
  created_time?: string | null;
  modified_time?: string | null;
  release_time?: string | null;
  privacy?: { view?: string | null } | null;
  pictures?: { base_link?: string | null } | null;
  stats?: { plays?: number | null } | null;
  tags?: Array<{ name?: string | null }> | null;
};

function authHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: VIMEO_ACCEPT,
  };
}

/** Vimeo identifies a video by URI ("/videos/123456789"); we key on the id. */
function videoIdFromUri(uri: string | undefined | null): string | null {
  const match = (uri || "").match(/\/videos\/(\d+)/);
  return match?.[1] ?? null;
}

function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) {
    return null;
  }

  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(rest)}`
    : `${minutes}:${pad(rest)}`;
}

function summarize(
  id: string,
  video: VimeoVideoApi,
): IntegrationResourceSummary {
  const duration = formatDuration(video.duration);
  const plays = video.stats?.plays;

  return {
    externalId: id,
    ref: id,
    name: video.name || id,
    description: video.description || null,
    url: video.link || `https://vimeo.com/${id}`,
    meta: [duration, typeof plays === "number" ? `▶ ${plays}` : null]
      .filter(Boolean)
      .join(" · ") || null,
    thumbnailUrl: video.pictures?.base_link || null,
    isPrivate: (video.privacy?.view || "anybody") !== "anybody",
  };
}

async function requestToken(params: {
  clientId: string;
  clientSecret: string;
  body: Record<string, string>;
}): Promise<ProviderTokenSet | null> {
  try {
    const response = await fetch(`${VIMEO_API}/oauth/access_token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${params.clientId}:${params.clientSecret}`,
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: VIMEO_ACCEPT,
      },
      body: new URLSearchParams(params.body).toString(),
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      access_token?: string;
      token_type?: string;
      scope?: string;
    };

    if (!payload.access_token) return null;

    return {
      accessToken: payload.access_token,
      tokenType: payload.token_type || "bearer",
      // Vimeo access tokens do not expire and there is no refresh token.
      refreshToken: null,
      expiresAt: null,
      scopes: (payload.scope || VIMEO_SCOPES.join(" ")).split(/[, ]+/).filter(Boolean),
    };
  } catch (error) {
    console.error("[vimeo] token request failed", error);
    return null;
  }
}

export const vimeoAdapter: ProviderAdapter = {
  id: "vimeo",
  scopes: [...VIMEO_SCOPES],
  clientIdEnv: "VIMEO_OAUTH_CLIENT_ID",
  clientSecretEnv: "VIMEO_OAUTH_CLIENT_SECRET",
  refPattern: /^\d{5,15}$/,

  buildAuthorizeUrl({ clientId, redirectUri, state }) {
    const url = new URL(`${VIMEO_API}/oauth/authorize`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", VIMEO_SCOPES.join(" "));
    return url.toString();
  },

  exchangeCodeForToken({ code, clientId, clientSecret, redirectUri }) {
    return requestToken({
      clientId,
      clientSecret,
      body: {
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      },
    });
  },

  async fetchAccount(accessToken) {
    try {
      const response = await fetch(`${VIMEO_API}/me?fields=uri,name,link,pictures.base_link`, {
        headers: authHeaders(accessToken),
      });
      if (!response.ok) return null;
      const payload = (await response.json()) as {
        uri?: string;
        name?: string | null;
        pictures?: { base_link?: string | null } | null;
      };
      const id = (payload.uri || "").split("/").pop() || "";
      if (!id) return null;
      return {
        id,
        login: payload.name || id,
        avatarUrl: payload.pictures?.base_link || null,
      };
    } catch (error) {
      console.error("[vimeo] /me failed", error);
      return null;
    }
  },

  async listResources(accessToken) {
    try {
      const url = new URL(`${VIMEO_API}/me/videos`);
      url.searchParams.set("per_page", String(PER_PAGE));
      url.searchParams.set("sort", "date");
      url.searchParams.set("direction", "desc");
      url.searchParams.set("fields", VIDEO_FIELDS);

      const response = await fetch(url.toString(), {
        headers: authHeaders(accessToken),
      });
      if (!response.ok) return [];

      const payload = (await response.json()) as { data?: VimeoVideoApi[] | null };
      const rows = Array.isArray(payload.data) ? payload.data : [];

      return rows.flatMap((row) => {
        const id = videoIdFromUri(row.uri);
        return id ? [summarize(id, row)] : [];
      });
    } catch (error) {
      console.error("[vimeo] list videos failed", error);
      return [];
    }
  },

  async fetchResource(accessToken, ref): Promise<IntegrationResourceDetail | null> {
    try {
      const response = await fetch(
        `${VIMEO_API}/videos/${ref}?fields=${encodeURIComponent(VIDEO_FIELDS)}`,
        { headers: authHeaders(accessToken) },
      );
      if (!response.ok) return null;

      const video = (await response.json()) as VimeoVideoApi;
      const stats: IntegrationStat[] = [];
      const pushStat = (key: IntegrationStat["key"], value: string | null) => {
        if (value) stats.push({ key, value });
      };

      pushStat("duration", formatDuration(video.duration));
      pushStat(
        "plays",
        typeof video.stats?.plays === "number" ? String(video.stats.plays) : null,
      );
      pushStat("lastActivity", video.release_time || video.created_time || null);

      const tags = (video.tags || [])
        .map((tag) => (tag?.name || "").trim())
        .filter(Boolean);

      const description = video.description || null;

      return {
        ...summarize(ref, video),
        homepageUrl: null,
        createdAt: video.created_time ?? null,
        updatedAt: video.modified_time ?? null,
        archived: false,
        teamSize: null,
        tags,
        // A Vimeo description is often the full project write-up.
        longText: description
          ? description.slice(0, PROVIDER_LONG_TEXT_CHAR_LIMIT)
          : null,
        stats,
      };
    } catch (error) {
      console.error("[vimeo] fetch video failed", error);
      return null;
    }
  },
};
