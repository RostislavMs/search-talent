import "server-only";

import {
  PROVIDER_LONG_TEXT_CHAR_LIMIT,
  type IntegrationResourceDetail,
  type IntegrationResourceSummary,
  type IntegrationStat,
} from "@/lib/constants/provider-integrations";
import type { ProviderAdapter, ProviderTokenSet } from "./provider-types";

/**
 * Sketchfab OAuth 2 + Data API v3 adapter.
 *
 * Access tokens last a month and come with a refresh token, so the shared
 * refresh path in `@/lib/db/provider-integrations` does the renewing.
 */

const SKETCHFAB_BASE = "https://sketchfab.com";
const SKETCHFAB_API = "https://api.sketchfab.com/v3";

/** Sketchfab issues a single implicit read scope; none is sent explicitly. */
const SKETCHFAB_SCOPES: string[] = [];

const PER_PAGE = 24;

type SketchfabModelApi = {
  uid?: string;
  name?: string | null;
  description?: string | null;
  viewerUrl?: string | null;
  viewCount?: number | null;
  likeCount?: number | null;
  faceCount?: number | null;
  vertexCount?: number | null;
  createdAt?: string | null;
  publishedAt?: string | null;
  isPrivate?: boolean | null;
  tags?: Array<{ name?: string | null; slug?: string | null }> | null;
  categories?: Array<{ name?: string | null }> | null;
  license?: { label?: string | null; fullName?: string | null } | null;
  thumbnails?: {
    images?: Array<{ url?: string | null; width?: number | null }> | null;
  } | null;
};

function authHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

/** Picks the widest thumbnail that still stays list-sized. */
function pickThumbnail(model: SketchfabModelApi): string | null {
  const images = model.thumbnails?.images;
  if (!Array.isArray(images) || images.length === 0) return null;

  const sorted = [...images].sort(
    (a, b) => (a.width ?? 0) - (b.width ?? 0),
  );
  const preferred =
    sorted.find((image) => (image.width ?? 0) >= 400) ??
    sorted[sorted.length - 1];

  return preferred?.url || null;
}

function formatCount(value: number | null | undefined): string | null {
  return typeof value === "number" && value > 0
    ? value.toLocaleString("en-US")
    : null;
}

function summarize(model: SketchfabModelApi): IntegrationResourceSummary | null {
  const uid = model.uid;

  if (!uid) return null;

  const views = formatCount(model.viewCount);
  const faces = formatCount(model.faceCount);

  return {
    externalId: uid,
    ref: uid,
    name: model.name || uid,
    description: model.description || null,
    url: model.viewerUrl || `${SKETCHFAB_BASE}/3d-models/${uid}`,
    meta: [views ? `👁 ${views}` : null, faces ? `${faces} tris` : null]
      .filter(Boolean)
      .join(" · ") || null,
    thumbnailUrl: pickThumbnail(model),
    isPrivate: Boolean(model.isPrivate),
  };
}

async function requestToken(
  body: Record<string, string>,
): Promise<ProviderTokenSet | null> {
  try {
    const response = await fetch(`${SKETCHFAB_BASE}/oauth2/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      access_token?: string;
      token_type?: string;
      refresh_token?: string | null;
      expires_in?: number | null;
      scope?: string | null;
    };

    if (!payload.access_token) return null;

    return {
      accessToken: payload.access_token,
      tokenType: payload.token_type || "Bearer",
      refreshToken: payload.refresh_token || null,
      expiresAt:
        typeof payload.expires_in === "number" && payload.expires_in > 0
          ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
          : null,
      scopes: (payload.scope || "").split(/[, ]+/).filter(Boolean),
    };
  } catch (error) {
    console.error("[sketchfab] token request failed", error);
    return null;
  }
}

export const sketchfabAdapter: ProviderAdapter = {
  id: "sketchfab",
  scopes: SKETCHFAB_SCOPES,
  clientIdEnv: "SKETCHFAB_OAUTH_CLIENT_ID",
  clientSecretEnv: "SKETCHFAB_OAUTH_CLIENT_SECRET",
  refPattern: /^[0-9a-fA-F]{16,64}$/,

  buildAuthorizeUrl({ clientId, redirectUri, state }) {
    const url = new URL(`${SKETCHFAB_BASE}/oauth2/authorize/`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    return url.toString();
  },

  exchangeCodeForToken({ code, clientId, clientSecret, redirectUri }) {
    return requestToken({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    });
  },

  refreshAccessToken({ refreshToken, clientId, clientSecret }) {
    return requestToken({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });
  },

  async fetchAccount(accessToken) {
    try {
      const response = await fetch(`${SKETCHFAB_API}/me`, {
        headers: authHeaders(accessToken),
      });
      if (!response.ok) return null;
      const payload = (await response.json()) as {
        uid?: string;
        username?: string | null;
        displayName?: string | null;
        avatar?: { images?: Array<{ url?: string | null }> | null } | null;
      };
      if (!payload.uid) return null;
      return {
        id: payload.uid,
        login: payload.username || payload.displayName || payload.uid,
        avatarUrl: payload.avatar?.images?.[0]?.url || null,
      };
    } catch (error) {
      console.error("[sketchfab] /me failed", error);
      return null;
    }
  },

  async listResources(accessToken) {
    try {
      const url = new URL(`${SKETCHFAB_API}/me/models`);
      url.searchParams.set("count", String(PER_PAGE));
      url.searchParams.set("sort_by", "-createdAt");

      const response = await fetch(url.toString(), {
        headers: authHeaders(accessToken),
      });
      if (!response.ok) return [];

      const payload = (await response.json()) as {
        results?: SketchfabModelApi[] | null;
      };
      const rows = Array.isArray(payload.results) ? payload.results : [];

      return rows.flatMap((row) => {
        const summary = summarize(row);
        return summary ? [summary] : [];
      });
    } catch (error) {
      console.error("[sketchfab] list models failed", error);
      return [];
    }
  },

  async fetchResource(accessToken, ref): Promise<IntegrationResourceDetail | null> {
    try {
      const response = await fetch(`${SKETCHFAB_API}/models/${ref}`, {
        headers: authHeaders(accessToken),
      });
      if (!response.ok) return null;

      const model = (await response.json()) as SketchfabModelApi;
      const summary = summarize(model);
      if (!summary) return null;

      const stats: IntegrationStat[] = [];
      const pushStat = (key: IntegrationStat["key"], value: string | null) => {
        if (value) stats.push({ key, value });
      };

      pushStat("faces", formatCount(model.faceCount));
      pushStat("vertices", formatCount(model.vertexCount));
      pushStat("views", formatCount(model.viewCount));
      pushStat("likes", formatCount(model.likeCount));
      pushStat("license", model.license?.label || model.license?.fullName || null);
      pushStat("lastActivity", model.publishedAt || model.createdAt || null);

      const tags = [
        ...(model.tags || []).map((tag) => (tag?.name || tag?.slug || "").trim()),
        ...(model.categories || []).map((category) => (category?.name || "").trim()),
      ].filter(Boolean);

      return {
        ...summary,
        homepageUrl: null,
        createdAt: model.createdAt ?? null,
        updatedAt: model.publishedAt ?? null,
        archived: false,
        teamSize: null,
        tags,
        longText: model.description
          ? model.description.slice(0, PROVIDER_LONG_TEXT_CHAR_LIMIT)
          : null,
        stats,
      };
    } catch (error) {
      console.error("[sketchfab] fetch model failed", error);
      return null;
    }
  },
};
