import { describe, expect, it } from "vitest";
import {
  linkPreviewCacheKey,
  parseLinkPreviewHref,
} from "@/lib/link-preview";

// The parser is the security boundary of the hover-preview feature: the API
// route only ever queries what it returns, so anything it lets through becomes
// a database lookup.

describe("parseLinkPreviewHref", () => {
  it("reads a localized profile href", () => {
    expect(parseLinkPreviewHref("/uk/u/ada")).toEqual({
      kind: "profile",
      key: "ada",
      locale: "uk",
    });
  });

  it("reports a null locale for locale-less hrefs", () => {
    expect(parseLinkPreviewHref("/u/ada")).toEqual({
      kind: "profile",
      key: "ada",
      locale: null,
    });
  });

  it("maps every supported content prefix", () => {
    expect(parseLinkPreviewHref("/en/projects/portfolio")?.kind).toBe("project");
    expect(parseLinkPreviewHref("/en/articles/hello")?.kind).toBe("article");
    // News posts are articles with an admin-only category.
    expect(parseLinkPreviewHref("/en/news/release-2")?.kind).toBe("article");
    expect(parseLinkPreviewHref("/en/polls/best-stack")?.kind).toBe("poll");
  });

  it("strips a query string and a fragment", () => {
    expect(parseLinkPreviewHref("/en/articles/hello?ref=x#section")).toEqual({
      kind: "article",
      key: "hello",
      locale: "en",
    });
  });

  it("decodes percent-encoded slugs", () => {
    // Anchors in the DOM carry encoded Cyrillic slugs.
    expect(parseLinkPreviewHref("/uk/u/%D0%B0%D0%B4%D0%B0")?.key).toBe("ада");
  });

  it("rejects facet and editor sub-routes", () => {
    expect(parseLinkPreviewHref("/uk/projects/tag/react")).toBeNull();
    expect(parseLinkPreviewHref("/uk/talents/skill/figma")).toBeNull();
    expect(parseLinkPreviewHref("/uk/projects/new")).toBeNull();
    expect(parseLinkPreviewHref("/uk/articles/edit")).toBeNull();
    expect(parseLinkPreviewHref("/uk/articles/feed.xml")).toBeNull();
  });

  it("rejects listing pages and unknown prefixes", () => {
    expect(parseLinkPreviewHref("/uk/talents")).toBeNull();
    expect(parseLinkPreviewHref("/uk")).toBeNull();
    expect(parseLinkPreviewHref("/")).toBeNull();
    expect(parseLinkPreviewHref("/uk/admin/users")).toBeNull();
    expect(parseLinkPreviewHref("/uk/my-space/saved")).toBeNull();
  });

  it("rejects anything that is not a same-origin path", () => {
    expect(parseLinkPreviewHref("https://evil.example/u/ada")).toBeNull();
    // Protocol-relative: `//host/path` would point the lookup at another site.
    expect(parseLinkPreviewHref("//evil.example/u/ada")).toBeNull();
    expect(parseLinkPreviewHref("mailto:ada@example.com")).toBeNull();
    expect(parseLinkPreviewHref("#anchor")).toBeNull();
    expect(parseLinkPreviewHref("u/ada")).toBeNull();
    expect(parseLinkPreviewHref("")).toBeNull();
    expect(parseLinkPreviewHref(null)).toBeNull();
    expect(parseLinkPreviewHref(undefined)).toBeNull();
  });

  it("rejects an over-long key", () => {
    expect(parseLinkPreviewHref(`/uk/u/${"a".repeat(201)}`)).toBeNull();
    expect(parseLinkPreviewHref(`/uk/u/${"a".repeat(200)}`)?.kind).toBe("profile");
  });

  it("rejects a malformed percent escape instead of throwing", () => {
    expect(parseLinkPreviewHref("/uk/u/%E0%A4%A")).toBeNull();
  });
});

describe("linkPreviewCacheKey", () => {
  it("keys on kind, locale and a case-folded key", () => {
    expect(
      linkPreviewCacheKey({ kind: "profile", key: "Ada", locale: "en" }, "uk"),
    ).toBe("profile:en:ada");
  });

  it("falls back to the viewer locale for locale-less hrefs", () => {
    expect(
      linkPreviewCacheKey({ kind: "poll", key: "stack", locale: null }, "uk"),
    ).toBe("poll:uk:stack");
  });
});
