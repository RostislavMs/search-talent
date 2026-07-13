// Human-readable stylesheet for /sitemap.xml. Referenced via the
// `<?xml-stylesheet?>` instruction the sitemap route emits; browsers apply it
// to render a styled page, while crawlers ignore it and read the raw XML.
//
// Served from a route handler (not /public) so we can pin the `text/xsl`
// content type — some hosts serve a bare `.xsl` file as octet-stream, which
// browsers refuse to load as a stylesheet.
const STYLESHEET = `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <xsl:output method="html" encoding="UTF-8" indent="yes" doctype-system="about:legacy-compat"/>
  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <meta name="robots" content="noindex"/>
        <title>SearchTalent · XML Sitemap</title>
        <style>
          :root {
            --bg: #fbf8f4;
            --panel: #ffffff;
            --text: #201a16;
            --muted: #7a6f66;
            --border: #ebe3da;
            --accent: #c2532e;
            --accent-soft: #f6e7df;
            --chip: #f2ece5;
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --bg: #171310;
              --panel: #201b17;
              --text: #f2ebe4;
              --muted: #a89b90;
              --border: #33291f;
              --accent: #e0794f;
              --accent-soft: #3a231a;
              --chip: #2b2118;
            }
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 0 1.25rem 4rem;
            background: var(--bg);
            color: var(--text);
            font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          }
          .wrap { max-width: 1040px; margin: 0 auto; }
          header {
            padding: 2.5rem 0 1.75rem;
            border-bottom: 1px solid var(--border);
            margin-bottom: 1.75rem;
          }
          .brand {
            font-size: 0.72rem;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            color: var(--accent);
            font-weight: 700;
            margin: 0 0 0.5rem;
          }
          h1 { font-size: 1.7rem; margin: 0 0 0.6rem; font-weight: 700; letter-spacing: -0.01em; }
          .lead { margin: 0; color: var(--muted); max-width: 60ch; }
          .count { color: var(--text); font-weight: 600; }
          .tablecard {
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 12px;
            overflow: hidden;
          }
          .scroll { overflow-x: auto; }
          table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
          th, td {
            text-align: left;
            padding: 0.7rem 1rem;
            border-bottom: 1px solid var(--border);
            white-space: nowrap;
          }
          th {
            font-size: 0.68rem;
            letter-spacing: 0.09em;
            text-transform: uppercase;
            color: var(--muted);
            font-weight: 600;
            position: sticky;
            top: 0;
            background: var(--panel);
          }
          tbody tr:last-child td { border-bottom: 0; }
          tbody tr:nth-child(even) { background: color-mix(in srgb, var(--panel) 92%, var(--border)); }
          td.num { color: var(--muted); font-variant-numeric: tabular-nums; width: 3rem; }
          td.url { white-space: normal; word-break: break-word; }
          a {
            color: var(--accent);
            text-decoration: none;
            font-family: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
            font-size: 0.9rem;
          }
          a:hover { text-decoration: underline; }
          .chips { display: flex; gap: 0.3rem; flex-wrap: wrap; }
          .chip {
            display: inline-block;
            padding: 0.1rem 0.5rem;
            border-radius: 999px;
            background: var(--chip);
            color: var(--muted);
            font-size: 0.72rem;
            font-weight: 600;
            letter-spacing: 0.02em;
          }
          .chip.x { background: var(--accent-soft); color: var(--accent); }
          td.date { color: var(--muted); font-size: 0.85rem; }
          footer { margin-top: 1.5rem; color: var(--muted); font-size: 0.8rem; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <header>
            <p class="brand">SearchTalent</p>
            <h1>XML Sitemap</h1>
            <p class="lead">
              This sitemap lists
              <span class="count"><xsl:value-of select="count(s:urlset/s:url)"/> URLs</span>
              with their language versions.
            </p>
          </header>
          <div class="tablecard">
            <div class="scroll">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>URL</th>
                    <th>Languages</th>
                    <th>Last modified</th>
                  </tr>
                </thead>
                <tbody>
                  <xsl:for-each select="s:urlset/s:url">
                    <tr>
                      <td class="num"><xsl:value-of select="position()"/></td>
                      <td class="url">
                        <a href="{s:loc}"><xsl:value-of select="s:loc"/></a>
                      </td>
                      <td>
                        <div class="chips">
                          <xsl:for-each select="xhtml:link">
                            <span>
                              <xsl:attribute name="class">
                                <xsl:choose>
                                  <xsl:when test="@hreflang = 'x-default'">chip x</xsl:when>
                                  <xsl:otherwise>chip</xsl:otherwise>
                                </xsl:choose>
                              </xsl:attribute>
                              <xsl:value-of select="@hreflang"/>
                            </span>
                          </xsl:for-each>
                        </div>
                      </td>
                      <td class="date"><xsl:value-of select="substring(s:lastmod, 1, 10)"/></td>
                    </tr>
                  </xsl:for-each>
                </tbody>
              </table>
            </div>
          </div>
          <footer>SearchTalent · <a href="/sitemap.xml">View raw XML</a></footer>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
`;

export const dynamic = "force-static";

export function GET() {
  return new Response(STYLESHEET, {
    headers: {
      "Content-Type": "text/xsl; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
