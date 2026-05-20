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
