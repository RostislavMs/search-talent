import { describe, expect, it } from "vitest";
import {
  buildRssFeed,
  escapeXml,
  type FeedChannel,
  type FeedItem,
} from "@/lib/feed";

// ---------------------------------------------------------------------------
// escapeXml
// ---------------------------------------------------------------------------

describe("escapeXml", () => {
  it("escapes the five XML metacharacters", () => {
    expect(escapeXml(`<a href="x" data='y'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; data=&apos;y&apos;&gt;&amp;&lt;/a&gt;",
    );
  });

  it("neutralizes a script payload", () => {
    expect(escapeXml("<script>alert(1)</script>")).not.toContain("<script>");
  });

  it("leaves plain text untouched", () => {
    expect(escapeXml("Plain title 123")).toBe("Plain title 123");
  });
});

// ---------------------------------------------------------------------------
// buildRssFeed
// ---------------------------------------------------------------------------

const channel = (items: FeedItem[]): FeedChannel => ({
  title: "SearchTalent — Articles",
  link: "https://example.com/uk/articles",
  feedUrl: "https://example.com/uk/articles/feed.xml",
  description: "Latest articles",
  language: "uk",
  items,
});

const item = (overrides: Partial<FeedItem> = {}): FeedItem => ({
  title: "Hello",
  link: "https://example.com/uk/articles/hello",
  guid: "https://example.com/uk/articles/hello",
  description: "An intro",
  pubDate: "2026-01-02T03:04:05Z",
  ...overrides,
});

describe("buildRssFeed", () => {
  it("produces a well-formed RSS 2.0 envelope", () => {
    const xml = buildRssFeed(channel([item()]));
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain("<channel>");
    expect(xml).toContain("</rss>");
    expect(xml).toContain(
      '<atom:link href="https://example.com/uk/articles/feed.xml" rel="self" type="application/rss+xml" />',
    );
  });

  it("renders each item with a permalink guid and RFC-822 date", () => {
    const xml = buildRssFeed(channel([item()]));
    expect(xml).toContain("<item>");
    expect(xml).toContain(
      '<guid isPermaLink="true">https://example.com/uk/articles/hello</guid>',
    );
    expect(xml).toContain("<pubDate>Fri, 02 Jan 2026 03:04:05 GMT</pubDate>");
  });

  it("escapes item content", () => {
    const xml = buildRssFeed(
      channel([item({ title: "Tom & Jerry <best>" })]),
    );
    expect(xml).toContain("<title>Tom &amp; Jerry &lt;best&gt;</title>");
    expect(xml).not.toContain("<best>");
  });

  it("omits pubDate when the date is unparseable", () => {
    const xml = buildRssFeed(channel([item({ pubDate: "not-a-date" })]));
    expect(xml).not.toContain("<pubDate>");
  });

  it("renders the author as dc:creator only when present", () => {
    const withAuthor = buildRssFeed(channel([item({ author: "Ada" })]));
    expect(withAuthor).toContain("<dc:creator>Ada</dc:creator>");

    const withoutAuthor = buildRssFeed(channel([item({ author: null })]));
    expect(withoutAuthor).not.toContain("<dc:creator>");
  });

  it("defaults lastBuildDate to the newest item date", () => {
    const xml = buildRssFeed(
      channel([
        item({ pubDate: "2026-05-01T00:00:00Z" }),
        item({ pubDate: "2026-01-01T00:00:00Z" }),
      ]),
    );
    expect(xml).toContain("<lastBuildDate>Fri, 01 May 2026 00:00:00 GMT</lastBuildDate>");
  });

  it("handles an empty feed without items", () => {
    const xml = buildRssFeed(channel([]));
    expect(xml).toContain("<channel>");
    expect(xml).not.toContain("<item>");
  });
});
