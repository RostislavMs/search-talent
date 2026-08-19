import "server-only";

import {
  PROVIDER_LONG_TEXT_CHAR_LIMIT,
  type IntegrationResourceDetail,
  type IntegrationResourceSummary,
  type IntegrationStat,
} from "@/lib/constants/provider-integrations";
import type { ProviderAdapter, ProviderTokenSet } from "./provider-types";

/**
 * Notion OAuth 2 + REST API adapter.
 *
 * Notion has no scope system: during the consent step the user picks exactly
 * which pages the connection may read, and the token can reach nothing else.
 * That makes the listing here a `search` over precisely what they shared.
 */

const NOTION_API = "https://api.notion.com/v1";

/** Pinned API version — Notion requires the header on every call. */
const NOTION_VERSION = "2022-06-28";

const PAGE_SIZE = 50;

/** Blocks pulled for the page body. Deep pages are truncated, not paginated. */
const BLOCK_LIMIT = 100;

type NotionRichText = { plain_text?: string | null };

type NotionPageApi = {
  id?: string;
  url?: string | null;
  created_time?: string | null;
  last_edited_time?: string | null;
  archived?: boolean | null;
  properties?: Record<
    string,
    { type?: string; title?: NotionRichText[] | null } | undefined
  > | null;
};

function authHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

/** A Notion page's title lives in whichever property has type "title". */
function readTitle(page: NotionPageApi): string | null {
  const properties = page.properties || {};

  for (const property of Object.values(properties)) {
    if (property?.type !== "title" || !Array.isArray(property.title)) continue;
    const text = property.title
      .map((part) => part?.plain_text || "")
      .join("")
      .trim();
    if (text) return text;
  }

  return null;
}

function summarize(page: NotionPageApi): IntegrationResourceSummary | null {
  const id = page.id;

  if (!id) return null;

  return {
    externalId: id,
    ref: id.replace(/-/g, ""),
    name: readTitle(page) || "Untitled",
    description: null,
    url: page.url || `https://www.notion.so/${id.replace(/-/g, "")}`,
    meta: page.last_edited_time || null,
    thumbnailUrl: null,
    // Everything the connection can see was shared with it deliberately.
    isPrivate: true,
  };
}

async function requestToken(params: {
  clientId: string;
  clientSecret: string;
  body: Record<string, string>;
}): Promise<ProviderTokenSet | null> {
  try {
    const response = await fetch(`${NOTION_API}/oauth/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${params.clientId}:${params.clientSecret}`,
        ).toString("base64")}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
      },
      body: JSON.stringify(params.body),
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      access_token?: string;
      token_type?: string;
      refresh_token?: string | null;
      expires_in?: number | null;
    };

    if (!payload.access_token) return null;

    return {
      accessToken: payload.access_token,
      tokenType: payload.token_type || "bearer",
      refreshToken: payload.refresh_token || null,
      expiresAt:
        typeof payload.expires_in === "number" && payload.expires_in > 0
          ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
          : null,
      scopes: [],
    };
  } catch (error) {
    console.error("[notion] token request failed", error);
    return null;
  }
}

/**
 * Flattens a page's blocks into plain text. Only the text-bearing block types
 * are read — tables, embeds and databases contribute nothing useful to a
 * project write-up.
 */
async function fetchPageText(
  accessToken: string,
  pageId: string,
): Promise<string | null> {
  try {
    const response = await fetch(
      `${NOTION_API}/blocks/${pageId}/children?page_size=${BLOCK_LIMIT}`,
      { headers: authHeaders(accessToken) },
    );
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      results?: Array<Record<string, unknown>> | null;
    };
    const blocks = Array.isArray(payload.results) ? payload.results : [];
    const lines: string[] = [];

    for (const block of blocks) {
      const type = typeof block.type === "string" ? block.type : "";
      const body = block[type];
      if (typeof body !== "object" || body === null) continue;
      const richText = (body as { rich_text?: NotionRichText[] | null })
        .rich_text;
      if (!Array.isArray(richText)) continue;
      const text = richText
        .map((part) => part?.plain_text || "")
        .join("")
        .trim();
      if (text) lines.push(text);
    }

    const joined = lines.join("\n\n").trim();

    return joined ? joined.slice(0, PROVIDER_LONG_TEXT_CHAR_LIMIT) : null;
  } catch (error) {
    console.error("[notion] page blocks failed", error);
    return null;
  }
}

export const notionAdapter: ProviderAdapter = {
  id: "notion",
  scopes: [],
  clientIdEnv: "NOTION_OAUTH_CLIENT_ID",
  clientSecretEnv: "NOTION_OAUTH_CLIENT_SECRET",
  // Page ids are UUIDs; Notion accepts them with or without dashes.
  refPattern: /^[0-9a-fA-F]{32}$|^[0-9a-fA-F-]{36}$/,

  buildAuthorizeUrl({ clientId, redirectUri, state }) {
    const url = new URL(`${NOTION_API}/oauth/authorize`);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("owner", "user");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
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

  refreshAccessToken({ refreshToken, clientId, clientSecret }) {
    return requestToken({
      clientId,
      clientSecret,
      body: { grant_type: "refresh_token", refresh_token: refreshToken },
    });
  },

  async fetchAccount(accessToken) {
    try {
      const response = await fetch(`${NOTION_API}/users/me`, {
        headers: authHeaders(accessToken),
      });
      if (!response.ok) return null;
      const payload = (await response.json()) as {
        id?: string;
        name?: string | null;
        avatar_url?: string | null;
        bot?: { owner?: { user?: { name?: string | null } | null } | null } | null;
      };
      if (!payload.id) return null;
      return {
        id: payload.id,
        // /users/me returns the bot; the human's name hides one level down.
        login: payload.bot?.owner?.user?.name || payload.name || payload.id,
        avatarUrl: payload.avatar_url || null,
      };
    } catch (error) {
      console.error("[notion] /users/me failed", error);
      return null;
    }
  },

  async listResources(accessToken) {
    try {
      const response = await fetch(`${NOTION_API}/search`, {
        method: "POST",
        headers: authHeaders(accessToken),
        body: JSON.stringify({
          filter: { property: "object", value: "page" },
          sort: { direction: "descending", timestamp: "last_edited_time" },
          page_size: PAGE_SIZE,
        }),
      });
      if (!response.ok) return [];

      const payload = (await response.json()) as {
        results?: NotionPageApi[] | null;
      };
      const rows = Array.isArray(payload.results) ? payload.results : [];

      return rows.flatMap((row) => {
        if (row.archived) return [];
        const summary = summarize(row);
        return summary ? [summary] : [];
      });
    } catch (error) {
      console.error("[notion] search failed", error);
      return [];
    }
  },

  async fetchResource(accessToken, ref): Promise<IntegrationResourceDetail | null> {
    try {
      const response = await fetch(`${NOTION_API}/pages/${ref}`, {
        headers: authHeaders(accessToken),
      });
      if (!response.ok) return null;

      const page = (await response.json()) as NotionPageApi;
      const summary = summarize(page);
      if (!summary) return null;

      const longText = await fetchPageText(accessToken, ref);

      const stats: IntegrationStat[] = [];
      if (page.last_edited_time) {
        stats.push({ key: "lastModified", value: page.last_edited_time });
      }
      if (longText) {
        const words = longText.split(/\s+/).filter(Boolean).length;
        if (words > 0) stats.push({ key: "words", value: String(words) });
      }

      return {
        ...summary,
        homepageUrl: null,
        createdAt: page.created_time ?? null,
        updatedAt: page.last_edited_time ?? null,
        archived: Boolean(page.archived),
        teamSize: null,
        tags: [],
        longText,
        stats,
      };
    } catch (error) {
      console.error("[notion] fetch page failed", error);
      return null;
    }
  },
};
