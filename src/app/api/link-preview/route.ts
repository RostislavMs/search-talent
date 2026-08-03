import { NextResponse } from "next/server";
import { getLinkPreview } from "@/lib/db/link-preview";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import { parseLinkPreviewHref } from "@/lib/link-preview";
import { rateLimit } from "@/lib/rate-limit";

/**
 * GET /api/link-preview?href=/uk/u/ada&locale=uk
 *
 * Returns the hover-card payload for an internal link, or `{ preview: null }`
 * when the target does not exist or is not public. Feeds the hover previews on
 * @mentions and in-article links (see `components/link-preview-provider`).
 *
 * Public and viewer-independent by design: the resolver reads through the
 * anonymous client, so the response is identical for every visitor and can be
 * cached. Only the whitelisted route shapes in `parseLinkPreviewHref` resolve —
 * anything else is rejected before a query runs.
 */

/**
 * Hovering is cheap for a human (a handful of cards per page) but trivially
 * scriptable, so the window is generous enough to never bite real reading and
 * still caps a scraper walking the whole site through this endpoint.
 */
const RATE_LIMIT = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const ip =
    forwarded.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  return `link-preview:${ip}`;
}

export async function GET(request: Request) {
  const limited = rateLimit(clientKey(request), RATE_LIMIT, RATE_LIMIT_WINDOW_MS);
  if (limited) {
    return limited;
  }

  const { searchParams } = new URL(request.url);
  const target = parseLinkPreviewHref(searchParams.get("href"));

  if (!target) {
    return NextResponse.json({ preview: null }, { status: 400 });
  }

  const localeParam = searchParams.get("locale");
  const locale =
    target.locale ??
    (localeParam && isLocale(localeParam) ? localeParam : defaultLocale);

  const preview = await getLinkPreview(target, locale);

  return NextResponse.json(
    { preview },
    {
      headers: {
        // Short shared cache: preview copy changes when the target is edited,
        // and a stale card for a few minutes is harmless. `stale-while-
        // revalidate` keeps the first hover after expiry instant.
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=1800",
      },
    },
  );
}
