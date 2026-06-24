import { describe, expect, it } from "vitest";
import {
  extractPlainTextFromRichText,
  extractYouTubeVideoId,
  sanitizeRichTextHtml,
} from "@/lib/rich-text";

describe("sanitizeRichTextHtml (server path)", () => {
  it("returns empty string for empty/whitespace input", () => {
    expect(sanitizeRichTextHtml("")).toBe("");
    expect(sanitizeRichTextHtml("   ")).toBe("");
  });

  it("strips <script> tags and their content", () => {
    const result = sanitizeRichTextHtml(
      "<p>hello</p><script>alert('xss')</script>",
    );

    expect(result).not.toMatch(/script/i);
    expect(result).toContain("hello");
  });

  it("strips inline event handlers (onerror, onclick)", () => {
    const result = sanitizeRichTextHtml(
      `<p onclick="evil()">hi</p><img src="x" onerror="alert(1)">`,
    );

    expect(result).not.toMatch(/onclick/i);
    expect(result).not.toMatch(/onerror/i);
  });

  it("removes javascript: and vbscript: URLs", () => {
    const result = sanitizeRichTextHtml(
      `<a href="javascript:alert(1)">x</a><a href="vbscript:msgbox">y</a>`,
    );

    expect(result).not.toMatch(/javascript:/i);
    expect(result).not.toMatch(/vbscript:/i);
  });

  it("removes non-image data: URLs but keeps data:image/", () => {
    const result = sanitizeRichTextHtml(
      `<img src="data:text/html,<script>alert(1)</script>">` +
        `<img src="data:image/png;base64,abc">`,
    );

    expect(result).not.toMatch(/data:text/i);
    expect(result).toMatch(/data:image\/png/i);
  });

  it("strips disallowed tags but keeps their text", () => {
    const result = sanitizeRichTextHtml("<p>keep <object>nope</object> text</p>");

    expect(result).toContain("keep");
    expect(result).toContain("text");
    expect(result).not.toMatch(/<object/i);
  });

  it("drops the opening tag of iframes that are not YouTube embeds", () => {
    const result = sanitizeRichTextHtml(
      `<iframe src="https://evil.example.com/x"></iframe>`,
    );

    expect(result).not.toMatch(/<iframe\b/i);
    expect(result).not.toMatch(/evil\.example\.com/);
  });

  it("keeps YouTube embed iframes", () => {
    const result = sanitizeRichTextHtml(
      `<iframe src="https://www.youtube.com/embed/abc123XYZ_-"></iframe>`,
    );

    expect(result).toMatch(/<iframe\b/i);
    expect(result).toMatch(/youtube\.com\/embed/i);
  });

  it("strips <style> tags and their content", () => {
    const result = sanitizeRichTextHtml(
      "<p>hello</p><style>body { color: red; }</style><p>world</p>",
    );

    expect(result).not.toMatch(/style/i);
    expect(result).toContain("hello");
    expect(result).toContain("world");
  });

  it("strips single-quoted event handlers", () => {
    const result = sanitizeRichTextHtml(
      `<p onclick='alert(1)'>hi</p>`,
    );

    expect(result).not.toMatch(/onclick/i);
    expect(result).toContain("hi");
  });

  it("strips unquoted event handlers", () => {
    const result = sanitizeRichTextHtml(
      `<img src="x" onerror=alert(1)>`,
    );

    expect(result).not.toMatch(/onerror/i);
  });

  it("keeps allowed tags like <strong>, <em>, <blockquote>", () => {
    const result = sanitizeRichTextHtml(
      "<p><strong>bold</strong> <em>italic</em></p><blockquote>quote</blockquote>",
    );

    expect(result).toMatch(/<strong>/i);
    expect(result).toMatch(/<em>/i);
    expect(result).toMatch(/<blockquote>/i);
  });

  it("collapses unsupported heading levels onto <h3>", () => {
    const result = sanitizeRichTextHtml(
      "<h1>Title</h1><h2>Section</h2><h4>Minor</h4>",
    );

    expect(result).not.toMatch(/<h1\b/i);
    expect(result).not.toMatch(/<h2\b/i);
    expect(result).not.toMatch(/<h4\b/i);
    expect(result.match(/<h3\b/gi)?.length).toBe(3);
    expect(result).toContain("Title");
    expect(result).toContain("Section");
    expect(result).toContain("Minor");
  });

  it("keeps existing <h3> headings untouched", () => {
    const result = sanitizeRichTextHtml("<h3>Kept</h3>");

    expect(result).toMatch(/<h3\b/i);
    expect(result).toContain("Kept");
  });

  it("keeps <hr> dividers", () => {
    const result = sanitizeRichTextHtml("<p>a</p><hr><p>b</p>");

    expect(result).toMatch(/<hr\b/i);
  });

  it("keeps <details>/<summary> spoilers and drops the open attribute", () => {
    const result = sanitizeRichTextHtml(
      "<details open><summary>Title</summary><p>Hidden</p></details>",
    );

    expect(result).toMatch(/<details\b/i);
    expect(result).toMatch(/<summary\b/i);
    expect(result).toContain("Title");
    expect(result).toContain("Hidden");
    expect(result).not.toMatch(/<details[^>]*\sopen/i);
  });

  it("keeps youtube-nocookie iframes", () => {
    const result = sanitizeRichTextHtml(
      `<iframe src="https://www.youtube-nocookie.com/embed/abc123XYZ"></iframe>`,
    );

    expect(result).toMatch(/<iframe\b/i);
    expect(result).toMatch(/youtube-nocookie/i);
  });
});

describe("extractPlainTextFromRichText", () => {
  it("returns empty string for blank input", () => {
    expect(extractPlainTextFromRichText("")).toBe("");
    expect(extractPlainTextFromRichText("   ")).toBe("");
  });

  it("strips tags and collapses whitespace", () => {
    expect(extractPlainTextFromRichText("<p>foo</p><p>bar</p>")).toBe("foo bar");
  });

  it("strips inline tags without producing spurious whitespace", () => {
    expect(extractPlainTextFromRichText("<p>hello <strong>world</strong></p>"))
      .toBe("hello world");
  });

  it("handles nested tags", () => {
    const result = extractPlainTextFromRichText(
      "<p>Hello <strong><em>World</em></strong></p>",
    );

    expect(result).toBe("Hello World");
  });

  it("handles text with entities", () => {
    const result = extractPlainTextFromRichText("<p>A &amp; B</p>");

    expect(result).toContain("A");
    expect(result).toContain("B");
  });
});

describe("extractYouTubeVideoId", () => {
  it("extracts an id from a youtu.be short URL", () => {
    expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("extracts an id from a watch URL", () => {
    expect(
      extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=2"),
    ).toBe("dQw4w9WgXcQ");
  });

  it("extracts an id from an embed URL", () => {
    expect(
      extractYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
  });

  it("returns null for non-YouTube URLs", () => {
    expect(extractYouTubeVideoId("https://example.com/video")).toBeNull();
    expect(extractYouTubeVideoId("not a url at all")).toBeNull();
  });
});

