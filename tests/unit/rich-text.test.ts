import { describe, expect, it } from "vitest";
import {
  extractClipboardHtmlFragment,
  extractPlainTextFromRichText,
  extractYouTubeVideoId,
  hasMarkdownSyntax,
  htmlFragmentHasBlocks,
  inlineMarkdownToHtml,
  markdownToHtml,
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

  it("collapses unsupported heading levels onto <h2>", () => {
    const result = sanitizeRichTextHtml(
      "<h1>Title</h1><h3>Section</h3><h4>Minor</h4>",
    );

    expect(result).not.toMatch(/<h1\b/i);
    expect(result).not.toMatch(/<h3\b/i);
    expect(result).not.toMatch(/<h4\b/i);
    expect(result.match(/<h2\b/gi)?.length).toBe(3);
    expect(result).toContain("Title");
    expect(result).toContain("Section");
    expect(result).toContain("Minor");
  });

  it("keeps existing <h2> headings untouched", () => {
    const result = sanitizeRichTextHtml("<h2>Kept</h2>");

    expect(result).toMatch(/<h2\b/i);
    expect(result).toContain("Kept");
  });

  it("promotes legacy stored <h3> body headings to <h2>", () => {
    const result = sanitizeRichTextHtml("<h3>Legacy section</h3>");

    expect(result).toMatch(/<h2\b/i);
    expect(result).not.toMatch(/<h3\b/i);
    expect(result).toContain("Legacy section");
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

describe("inlineMarkdownToHtml", () => {
  it("converts bold, italic and inline code", () => {
    expect(inlineMarkdownToHtml("**bold** and *italic* and `code`")).toBe(
      "<strong>bold</strong> and <em>italic</em> and <code>code</code>",
    );
  });

  it("converts links and keeps the href", () => {
    expect(inlineMarkdownToHtml("see [docs](https://example.com/a)")).toBe(
      'see <a href="https://example.com/a">docs</a>',
    );
  });

  it("does not touch markup-looking characters inside code spans", () => {
    expect(inlineMarkdownToHtml("run `a < b && c`")).toBe(
      "run <code>a &lt; b &amp;&amp; c</code>",
    );
  });

  it("escapes stray angle brackets in plain text", () => {
    expect(inlineMarkdownToHtml("a < b > c")).toBe("a &lt; b &gt; c");
  });

  it("does not mistake spaced digits for a code placeholder", () => {
    expect(inlineMarkdownToHtml("levels 3 4 5 matter")).toBe(
      "levels 3 4 5 matter",
    );
  });
});

describe("markdownToHtml", () => {
  it("turns ## lines into <h2> (any level collapses to h2)", () => {
    expect(markdownToHtml("## Title")).toBe("<h2>Title</h2>");
    expect(markdownToHtml("# Title")).toBe("<h2>Title</h2>");
    expect(markdownToHtml("#### Title")).toBe("<h2>Title</h2>");
  });

  it("wraps blank-line-separated paragraphs", () => {
    expect(markdownToHtml("First para.\n\nSecond para.")).toBe(
      "<p>First para.</p><p>Second para.</p>",
    );
  });

  it("builds bullet and ordered lists", () => {
    expect(markdownToHtml("- one\n- two")).toBe(
      "<ul><li>one</li><li>two</li></ul>",
    );
    expect(markdownToHtml("1. one\n2. two")).toBe(
      "<ol><li>one</li><li>two</li></ol>",
    );
  });

  it("builds blockquotes and horizontal rules", () => {
    expect(markdownToHtml("> quoted line")).toBe(
      "<blockquote>quoted line</blockquote>",
    );
    expect(markdownToHtml("---")).toBe("<hr>");
  });

  it("passes raw <details> spoiler blocks through, wrapping their body", () => {
    const md = "<details>\n<summary>More</summary>\n\nHidden body.\n\n</details>";
    expect(markdownToHtml(md)).toBe(
      "<details><summary>More</summary><p>Hidden body.</p></details>",
    );
  });

  it("survives the sanitizer as real blocks (end-to-end)", () => {
    const md = [
      "## Heading",
      "",
      "A paragraph with a [link](https://searchtalent.dev/uk/talents/role).",
      "",
      "- first",
      "- second",
      "",
      "> a quote",
    ].join("\n");
    const stored = sanitizeRichTextHtml(markdownToHtml(md));

    expect(stored).toContain("<h2>Heading</h2>");
    expect(stored).toContain("<ul>");
    expect(stored).toContain("<blockquote>");
    expect(stored).toContain(
      'href="https://searchtalent.dev/uk/talents/role"',
    );
    // The link is turned into a real anchor, not left as literal "[link](...)".
    expect(stored).not.toContain("[link]");
  });
});

describe("hasMarkdownSyntax", () => {
  it("detects block and inline Markdown markers", () => {
    expect(hasMarkdownSyntax("## Heading")).toBe(true);
    expect(hasMarkdownSyntax("- a\n- b")).toBe(true);
    expect(hasMarkdownSyntax("1. a")).toBe(true);
    expect(hasMarkdownSyntax("> quote")).toBe(true);
    expect(hasMarkdownSyntax("---")).toBe(true);
    expect(hasMarkdownSyntax("<details>")).toBe(true);
    expect(hasMarkdownSyntax("a **bold** word")).toBe(true);
    expect(hasMarkdownSyntax("some `code` here")).toBe(true);
    expect(hasMarkdownSyntax("see [docs](https://x.dev/a)")).toBe(true);
  });

  it("does NOT fire on plain prose, even multi-paragraph", () => {
    // Rendered sources carry no syntax markers — they take the HTML path.
    expect(hasMarkdownSyntax("Heading text\n\nA rendered paragraph.")).toBe(
      false,
    );
    expect(hasMarkdownSyntax("just a word")).toBe(false);
    expect(hasMarkdownSyntax("https://example.com/page")).toBe(false);
    expect(hasMarkdownSyntax("prices: 2 * 3 * 4 items")).toBe(false);
  });
});

describe("extractClipboardHtmlFragment", () => {
  it("slices out the StartFragment/EndFragment selection (Chrome/Edge)", () => {
    const clipboard =
      "<html><body>\n<!--StartFragment--><h2>Heading</h2><p>Body</p><!--EndFragment-->\n</body></html>";
    expect(extractClipboardHtmlFragment(clipboard)).toBe(
      "<h2>Heading</h2><p>Body</p>",
    );
  });

  it("drops <head>/<style>/wrapper noise when there is no fragment marker", () => {
    const clipboard =
      "<html><head><style>h2{color:red}</style></head><body><h2>Title</h2></body></html>";
    expect(extractClipboardHtmlFragment(clipboard)).toBe("<h2>Title</h2>");
  });
});

describe("htmlFragmentHasBlocks", () => {
  it("is true for headings, lists and multi-paragraph fragments", () => {
    expect(htmlFragmentHasBlocks("<h1>Title</h1>")).toBe(true);
    expect(htmlFragmentHasBlocks("<ul><li>a</li></ul>")).toBe(true);
    expect(htmlFragmentHasBlocks("<p>one</p><p>two</p>")).toBe(true);
  });

  it("is false for a small inline fragment", () => {
    expect(htmlFragmentHasBlocks("<b>word</b>")).toBe(false);
    expect(htmlFragmentHasBlocks("<p>one paragraph</p>")).toBe(false);
    expect(htmlFragmentHasBlocks("just text")).toBe(false);
  });
});

describe("preview paste → real headings (end-to-end)", () => {
  it("keeps pasted <h1>/<h3> as <h2> instead of flattening to text", () => {
    // What a Markdown-preview copy puts on the clipboard.
    const clipboard =
      "<html><body><!--StartFragment-->" +
      "<h1>Big title</h1><p>Intro paragraph.</p>" +
      "<h3>Subsection</h3><ul><li>point one</li><li>point two</li></ul>" +
      "<!--EndFragment--></body></html>";

    const fragment = extractClipboardHtmlFragment(clipboard);
    expect(htmlFragmentHasBlocks(fragment)).toBe(true);

    const stored = sanitizeRichTextHtml(fragment);
    expect(stored).toContain("<h2>Big title</h2>");
    expect(stored).toContain("<h2>Subsection</h2>");
    expect(stored).toContain("<ul>");
    // No heading levels survive other than the supported <h2>.
    expect(stored).not.toMatch(/<h[13456]\b/);
  });
});

// Adversarial XSS regressions. These pin the behavior of the DOMPurify config
// + custom hooks against bypasses that motivated the sanitizer (the historical
// slash-attribute img, obfuscated schemes, mXSS, and iframe host-spoofing).
describe("sanitizeRichTextHtml — adversarial XSS", () => {
  it("neutralizes the historical slash-separated img/onerror bypass", () => {
    // <img/src=x/onerror=...> — the exact vector that broke the old regex pass.
    const result = sanitizeRichTextHtml(`<img/src=x/onerror=alert(1)>`);
    expect(result).not.toMatch(/onerror/i);
    expect(result).not.toMatch(/alert/i);
  });

  it("drops obfuscated javascript: schemes (whitespace, tab, entity, case)", () => {
    const vectors = [
      `<a href="  javascript:alert(1)">a</a>`,
      `<a href="java\tscript:alert(1)">b</a>`,
      `<a href="java&#115;cript:alert(1)">c</a>`,
      `<a href="JaVaScRiPt:alert(1)">d</a>`,
      `<a href="javascript&#58;alert(1)">e</a>`,
    ];
    for (const html of vectors) {
      const result = sanitizeRichTextHtml(html);
      // The dangerous href is stripped, so no executable scheme survives.
      expect(result).not.toMatch(/javascript\s*:/i);
      expect(result).not.toMatch(/alert/i);
    }
  });

  it("neutralizes mutation-XSS payloads (svg/math/template/noscript)", () => {
    const vectors = [
      `<svg><style><img src=x onerror=alert(1)></style></svg>`,
      `<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>`,
      `<template><img src=x onerror=alert(1)></template>`,
      `<noscript><p title="</noscript><img src=x onerror=alert(1)>">`,
    ];
    for (const html of vectors) {
      const result = sanitizeRichTextHtml(html);
      expect(result).not.toMatch(/onerror/i);
      expect(result).not.toMatch(/<script\b/i);
    }
  });

  it("rejects iframe srcs that spoof the YouTube host", () => {
    const vectors = [
      `<iframe src="https://www.youtube.com@evil.com/embed/x"></iframe>`,
      `<iframe src="https://www.youtube.com.evil.com/embed/x"></iframe>`,
      `<iframe src="https://evil.com/www.youtube.com/embed/x"></iframe>`,
    ];
    for (const html of vectors) {
      const result = sanitizeRichTextHtml(html);
      expect(result).not.toMatch(/<iframe\b/i);
      // Plain substring check (not a regex) — the spoof host must not survive
      // anywhere in the output.
      expect(result).not.toContain("evil.com");
    }
  });

  it("confines an svg data-URI payload to the img src (inert, not live markup)", () => {
    const result = sanitizeRichTextHtml(
      `<img src="data:image/svg+xml,<svg onload=alert(1)>">`,
    );
    // The data:image/ src is intentionally allowed, and an SVG loaded via <img>
    // cannot execute script. The property we pin: the <svg>/onload text lives
    // ONLY inside the src attribute value, never as a real element/attribute.
    // Blank the src value; nothing dangerous may remain in the actual markup.
    const withoutSrcValue = result.replace(/src="[^"]*"/i, 'src=""');
    expect(withoutSrcValue).not.toMatch(/<svg\b/i);
    expect(withoutSrcValue).not.toMatch(/onload/i);
    expect(withoutSrcValue).not.toMatch(/<script\b/i);
  });
});

