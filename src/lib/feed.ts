/**
 * RSS 2.0 feed generation.
 *
 * Pure, framework-free string building so it can be unit-tested without a
 * server. Every user-controlled value (article title, excerpt, author name)
 * is XML-escaped — an unescaped `<` or `&` would both break feed-reader
 * parsing and open a stored-XSS hole when the feed is rendered elsewhere.
 *
 * The data layer (`src/lib/db/feed.ts`) fetches articles; the route handlers
 * (`/[locale]/articles/feed.xml`, `/[locale]/u/[username]/articles/feed.xml`)
 * wire the two together and set the response headers.
 */

/** A single entry in a feed. All URLs must be absolute. */
export type FeedItem = {
  title: string;
  link: string;
  /** Stable unique id — we use the absolute article URL (a permalink). */
  guid: string;
  description: string | null;
  /** ISO timestamp; rendered as RFC-822. Invalid/missing dates are dropped. */
  pubDate: string | null;
  /** Display name of the author, rendered as `dc:creator`. */
  author?: string | null;
};

/** Channel-level metadata plus the items. */
export type FeedChannel = {
  title: string;
  /** Human-facing URL of the section the feed mirrors. */
  link: string;
  /** Absolute URL of the feed itself (the `atom:self` link). */
  feedUrl: string;
  description: string;
  /** BCP-47-ish language code, e.g. `uk` or `en`. */
  language: string;
  items: FeedItem[];
  /** ISO timestamp; defaults to the newest item's date. */
  lastBuildDate?: string | null;
};

export const FEED_CONTENT_TYPE = "application/rss+xml; charset=utf-8";

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/** Escape the five XML metacharacters for safe element/attribute content. */
export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => XML_ESCAPES[char] ?? char);
}

/** Convert an ISO timestamp to an RFC-822 date, or `null` if unparseable. */
function toRfc822(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toUTCString();
}

function renderItem(item: FeedItem): string {
  const lines = [
    "    <item>",
    `      <title>${escapeXml(item.title)}</title>`,
    `      <link>${escapeXml(item.link)}</link>`,
    `      <guid isPermaLink="true">${escapeXml(item.guid)}</guid>`,
  ];

  const pubDate = toRfc822(item.pubDate);
  if (pubDate) {
    lines.push(`      <pubDate>${pubDate}</pubDate>`);
  }

  if (item.author) {
    lines.push(`      <dc:creator>${escapeXml(item.author)}</dc:creator>`);
  }

  if (item.description) {
    lines.push(`      <description>${escapeXml(item.description)}</description>`);
  }

  lines.push("    </item>");
  return lines.join("\n");
}

/** Render a complete RSS 2.0 document for the given channel. */
export function buildRssFeed(channel: FeedChannel): string {
  const lastBuildDate =
    toRfc822(channel.lastBuildDate) ??
    toRfc822(channel.items.find((item) => item.pubDate)?.pubDate ?? null);

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    "  <channel>",
    `    <title>${escapeXml(channel.title)}</title>`,
    `    <link>${escapeXml(channel.link)}</link>`,
    `    <description>${escapeXml(channel.description)}</description>`,
    `    <language>${escapeXml(channel.language)}</language>`,
    `    <atom:link href="${escapeXml(channel.feedUrl)}" rel="self" type="application/rss+xml" />`,
  ];

  if (lastBuildDate) {
    lines.push(`    <lastBuildDate>${lastBuildDate}</lastBuildDate>`);
  }

  for (const item of channel.items) {
    lines.push(renderItem(item));
  }

  lines.push("  </channel>", "</rss>", "");
  return lines.join("\n");
}
