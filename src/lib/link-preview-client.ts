import { apiFetch } from "@/lib/api-client";
import type { Locale } from "@/lib/i18n/config";
import type { LinkPreview } from "@/lib/link-preview";

/**
 * The browser side of internal-link previews, shared by the hover cards
 * (`components/link-preview-provider`) and the cards under chat messages
 * (`components/message-link-cards`), so the same link is asked for once.
 *
 * Resolved previews live for the whole session: they are public, cheap, and
 * re-hovering the same @mention in a comment thread is the common case. `null`
 * (a miss) is cached too, so a broken link is not re-requested on every hover.
 */
const previewCache = new Map<string, LinkPreview | null>();
const inflightRequests = new Map<string, Promise<LinkPreview | null>>();

/**
 * Ceiling on the session cache. Reaching it takes hundreds of distinct links in
 * one session, so dropping everything is simpler than tracking recency and
 * costs at most one refetch per link afterwards.
 */
const CACHE_LIMIT = 250;

/** `undefined`: not asked yet; `null`: asked, and there is no card. */
export function getCachedLinkPreview(cacheKey: string): LinkPreview | null | undefined {
  return previewCache.has(cacheKey) ? (previewCache.get(cacheKey) ?? null) : undefined;
}

export function loadLinkPreview(href: string, locale: Locale, cacheKey: string): Promise<LinkPreview | null> {
  const inflight = inflightRequests.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const request = apiFetch<{ preview: LinkPreview | null }>(
    `/api/link-preview?href=${encodeURIComponent(href)}&locale=${locale}`,
  )
    .then((result) => (result.ok ? result.data.preview ?? null : null))
    .catch(() => null)
    .then((preview) => {
      if (previewCache.size >= CACHE_LIMIT) {
        previewCache.clear();
      }
      previewCache.set(cacheKey, preview);
      return preview;
    })
    .finally(() => {
      inflightRequests.delete(cacheKey);
    });

  inflightRequests.set(cacheKey, request);
  return request;
}
