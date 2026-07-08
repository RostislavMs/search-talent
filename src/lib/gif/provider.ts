import "server-only";

/**
 * Isolated GIF-search provider (Giphy). Swapping to Tenor means replacing
 * only this file: keep `searchGifs`, `isGifSearchConfigured` and
 * `isAllowedGifUrl` signatures intact and the rest of the app is unaffected.
 *
 * The API key stays server-side — the browser only ever talks to our own
 * `/api/gif/search` proxy, so no third-party host needs to be added to the
 * CSP `connect-src`.
 */

const GIPHY_API_KEY = process.env.GIPHY_API_KEY;
const GIPHY_BASE = "https://api.giphy.com/v1/gifs";
// Community platform: keep results tame. Giphy ratings: g < pg < pg-13 < r.
const RATING = "pg-13";

export type GifResult = {
  id: string;
  /** Small rendition shown in the picker grid. */
  previewUrl: string;
  /** Rendition stored on the comment and rendered inline. */
  url: string;
  width: number;
  height: number;
  title: string;
};

export function isGifSearchConfigured(): boolean {
  return Boolean(GIPHY_API_KEY);
}

/**
 * Server-side allowlist for a GIF URL before it is persisted on a comment.
 * We never trust the client-supplied URL: it must be https and hosted on the
 * provider CDN (every Giphy rendition lives on a *.giphy.com host).
 */
export function isAllowedGifUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  return host === "giphy.com" || host.endsWith(".giphy.com");
}

type GiphyImage = { url?: string; width?: string; height?: string };
type GiphyItem = {
  id: string;
  title?: string;
  images?: Record<string, GiphyImage>;
};

function normalize(item: GiphyItem): GifResult | null {
  const images = item.images ?? {};
  const display =
    images.fixed_height ?? images.downsized_medium ?? images.original;
  const preview =
    images.fixed_width_small ?? images.fixed_width ?? display;

  if (!display?.url || !preview?.url) return null;
  // Defence in depth: drop anything not on the provider CDN.
  if (!isAllowedGifUrl(display.url)) return null;

  return {
    id: item.id,
    url: display.url,
    previewUrl: preview.url,
    width: Number(display.width) || 0,
    height: Number(display.height) || 0,
    title: item.title ?? "",
  };
}

/**
 * Searches Giphy. An empty query returns trending GIFs. Throws on a failed
 * upstream request so the route can map it to a 502.
 */
export async function searchGifs(
  query: string,
  opts?: { limit?: number; offset?: number },
): Promise<GifResult[]> {
  if (!GIPHY_API_KEY) return [];

  // Giphy caps a single request at 50 items; paginate with `offset` for more.
  const limit = Math.min(Math.max(opts?.limit ?? 30, 1), 50);
  const offset = Math.max(opts?.offset ?? 0, 0);
  const trimmed = query.trim();
  const endpoint = trimmed ? "search" : "trending";

  const params = new URLSearchParams({
    api_key: GIPHY_API_KEY,
    limit: String(limit),
    offset: String(offset),
    rating: RATING,
    // Curated renditions tuned for chat/messaging (no video clips).
    bundle: "messaging_non_clips",
  });
  if (trimmed) params.set("q", trimmed);

  const res = await fetch(`${GIPHY_BASE}/${endpoint}?${params.toString()}`, {
    // Brief server-side cache smooths repeated searches and eases rate limits.
    next: { revalidate: 120 },
  });

  if (!res.ok) {
    throw new Error(`Giphy request failed: ${res.status}`);
  }

  const json = (await res.json()) as { data?: GiphyItem[] };
  return (json.data ?? [])
    .map(normalize)
    .filter((gif): gif is GifResult => gif !== null);
}
