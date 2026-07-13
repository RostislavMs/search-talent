import {
  SITEMAP_IDS,
  getSitemapEntries,
  type SitemapEntry,
} from "@/lib/sitemap-data";

// The sitemap reads live moderation state from the DB, so it must never be
// statically prerendered at build time (there is no DB session then).
export const dynamic = "force-dynamic";

// Escape the five XML predefined entities. URLs here are clean slug paths, but
// a slug could in theory carry an `&`/`<`, and an unescaped one would make the
// whole document non-well-formed (browsers then fall back to a raw text dump —
// the exact problem this route exists to avoid).
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderUrl(entry: SitemapEntry): string {
  const lines = [`  <url>`, `    <loc>${escapeXml(entry.url)}</loc>`];

  for (const alternate of entry.alternates) {
    lines.push(
      `    <xhtml:link rel="alternate" hreflang="${escapeXml(
        alternate.locale,
      )}" href="${escapeXml(alternate.href)}"/>`,
    );
  }

  if (entry.lastModified) {
    lines.push(`    <lastmod>${entry.lastModified.toISOString()}</lastmod>`);
  }
  if (entry.changeFrequency) {
    lines.push(`    <changefreq>${entry.changeFrequency}</changefreq>`);
  }
  if (typeof entry.priority === "number") {
    lines.push(`    <priority>${entry.priority}</priority>`);
  }

  lines.push(`  </url>`);
  return lines.join("\n");
}

export async function GET() {
  const entries = (
    await Promise.all(SITEMAP_IDS.map((id) => getSitemapEntries(id)))
  ).flat();

  // The <?xml-stylesheet?> instruction makes browsers render a human-readable
  // page (see /sitemap.xsl) instead of the unstyled text/tree the native XML
  // viewer produces. Search-engine crawlers ignore it and read the raw urlset.
  const body = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`,
    ...entries.map(renderUrl),
    `</urlset>`,
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Served fresh from the CDN edge and regenerated at most hourly in the
      // background (stale-while-revalidate), so visitors never wait on the ~9
      // DB queries. The client keeps max-age=0 so a manual reload always gets
      // the current cached copy. Crawlers refetch on their own cadence.
      "Cache-Control":
        "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
