import { getPortfolioBadgeData } from "@/lib/db/portfolio-badge";
import { getBadgeMessage, renderBadgeSvg } from "@/lib/portfolio-badge";
import { USERNAME_PATTERN } from "@/lib/username";

/**
 * GET /api/badge/{username}.svg — the README badge with the portfolio score
 * (see lib/portfolio-badge). The Markdown snippet in "Мій простір" links it to
 * the portfolio.
 *
 * Public and identical for everyone, so the CDN keeps it for an hour: GitHub's
 * image proxy and every README view hit the cache, not the database. The rating
 * itself is recomputed every few minutes, so an hour of lag is invisible.
 */

const FOUND_CACHE = "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400";
const NOT_FOUND_CACHE = "public, max-age=300, s-maxage=300";

function svgResponse(svg: string, status: number, cacheControl: string) {
  return new Response(svg, {
    status,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": cacheControl,
      // Opened on its own, an SVG is a document: nothing in it may run or load.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username: segment } = await params;
  const username = segment.replace(/\.svg$/i, "");
  const notFound = () =>
    svgResponse(renderBadgeSvg({ message: "not found", muted: true }), 404, NOT_FOUND_CACHE);

  if (!USERNAME_PATTERN.test(username)) {
    return notFound();
  }

  const badge = await getPortfolioBadgeData(username);

  if (!badge.found) {
    return notFound();
  }

  return svgResponse(
    renderBadgeSvg({ message: getBadgeMessage(badge.rating) }),
    200,
    FOUND_CACHE,
  );
}
