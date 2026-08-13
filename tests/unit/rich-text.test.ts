import { describe, expect, it } from "vitest";
import {
  extractClipboardHtmlFragment,
  extractPlainTextFromRichText,
  extractYouTubeVideoId,
  findHeadingOrderIssue,
  hasMarkdownSyntax,
  htmlFragmentHasBlocks,
  inlineMarkdownToHtml,
  linkifyMentionsInHtml,
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

  it("keeps the supported <h2>–<h4> outline and clamps levels outside it", () => {
    const result = sanitizeRichTextHtml(
      "<h1>Title</h1><h3>Section</h3><h4>Minor</h4><h5>Deep</h5><h6>Deeper</h6>",
    );

    // <h1> demotes to <h2>; <h5>/<h6> promote to the deepest level, <h4>.
    expect(result).not.toMatch(/<h1\b/i);
    expect(result).not.toMatch(/<h5\b/i);
    expect(result).not.toMatch(/<h6\b/i);
    // <h1> → <h2> (one occurrence).
    expect(result.match(/<h2\b/gi)?.length).toBe(1);
    // <h3> is now a supported level and passes through untouched.
    expect(result.match(/<h3\b/gi)?.length).toBe(1);
    // <h4> plus the two promoted from <h5>/<h6>.
    expect(result.match(/<h4\b/gi)?.length).toBe(3);
    expect(result).toContain("Title");
    expect(result).toContain("Section");
    expect(result).toContain("Minor");
    expect(result).toContain("Deep");
    expect(result).toContain("Deeper");
  });

  it("keeps existing <h2> headings untouched", () => {
    const result = sanitizeRichTextHtml("<h2>Kept</h2>");

    expect(result).toMatch(/<h2\b/i);
    expect(result).toContain("Kept");
  });

  it("keeps stored <h3>/<h4> body headings at their level", () => {
    const result = sanitizeRichTextHtml("<h3>Section</h3><h4>Sub</h4>");

    expect(result).toMatch(/<h3\b/i);
    expect(result).toMatch(/<h4\b/i);
    expect(result).toContain("Section");
    expect(result).toContain("Sub");
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
  it("maps Markdown heading levels onto the <h2>–<h4> outline", () => {
    // `#`/`##` open a section as <h2>; `###` → <h3>; `####`+ clamp to <h4>.
    expect(markdownToHtml("# Title")).toBe("<h2>Title</h2>");
    expect(markdownToHtml("## Title")).toBe("<h2>Title</h2>");
    expect(markdownToHtml("### Title")).toBe("<h3>Title</h3>");
    expect(markdownToHtml("#### Title")).toBe("<h4>Title</h4>");
    expect(markdownToHtml("##### Title")).toBe("<h4>Title</h4>");
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
    // `1)` is as common as `1.` in hand-written and generated Markdown.
    expect(markdownToHtml("1) one\n2) two")).toBe(
      "<ol><li>one</li><li>two</li></ol>",
    );
  });

  it("keeps a blank-line-separated ('loose') list as ONE list", () => {
    // The shape assistants and docs emit. Closing the list on the blank line gave
    // every item its own <ol>, so each item restarted at "1." with a gap between.
    expect(markdownToHtml("1. one\n\n2. two\n\n3. three")).toBe(
      "<ol><li>one</li><li>two</li><li>three</li></ol>",
    );
    expect(markdownToHtml("- one\n\n- two")).toBe(
      "<ul><li>one</li><li>two</li></ul>",
    );
  });

  it("nests indented items inside the item above them", () => {
    expect(markdownToHtml("- one\n  - nested\n- two")).toBe(
      "<ul><li>one<ul><li>nested</li></ul></li><li>two</li></ul>",
    );
    // A tab counts as four columns, and a sub-list can switch marker style.
    expect(markdownToHtml("1. one\n\t- nested\n2. two")).toBe(
      "<ol><li>one<ul><li>nested</li></ul></li><li>two</li></ol>",
    );
    // Two steps down and back up in one go.
    expect(markdownToHtml("- a\n  - b\n    - c\n- d")).toBe(
      "<ul><li>a<ul><li>b<ul><li>c</li></ul></li></ul></li><li>d</li></ul>",
    );
  });

  it("treats a stray single space as the same level, not a sub-list", () => {
    expect(markdownToHtml("- one\n - two")).toBe(
      "<ul><li>one</li><li>two</li></ul>",
    );
  });

  it("continues an item across a wrapped line instead of splitting the list", () => {
    expect(markdownToHtml("- one line\n  continued here\n- two")).toBe(
      "<ul><li>one line continued here</li><li>two</li></ul>",
    );
  });

  it("ends the list at the next non-list block", () => {
    expect(markdownToHtml("- one\n\nProse after.")).toBe(
      "<ul><li>one</li></ul><p>Prose after.</p>",
    );
    expect(markdownToHtml("- one\n## Heading")).toBe(
      "<ul><li>one</li></ul><h2>Heading</h2>",
    );
    expect(markdownToHtml("- one\n> quoted")).toBe(
      "<ul><li>one</li></ul><blockquote>quoted</blockquote>",
    );
  });

  it("starts a switched marker style as its own list", () => {
    expect(markdownToHtml("- bullet\n1. number")).toBe(
      "<ul><li>bullet</li></ul><ol><li>number</li></ol>",
    );
  });

  it("keeps the first number of a list that does not start at 1", () => {
    expect(markdownToHtml("4. four\n5. five")).toBe(
      '<ol start="4"><li>four</li><li>five</li></ol>',
    );
  });

  it("renders task markers as glyphs instead of literal brackets", () => {
    expect(markdownToHtml("- [ ] todo\n- [x] done")).toBe(
      "<ul><li>☐ todo</li><li>☑ done</li></ul>",
    );
  });

  it("rebuilds a word-processor outline that has no indentation left", () => {
    // What Google Docs / Word put on the plain-text flavour of a nested list:
    // the sub-levels are marked by letters and roman numerals only, with the
    // indentation gone. Read as flat text, every sub-item used to be swallowed
    // by the item above it.
    const outline = [
      "1. one",
      "2. two",
      "a. two-a",
      "b. two-b",
      "i. two-b-i",
      "ii. two-b-ii",
      "c. two-c",
      "3. three",
    ].join("\n");

    expect(markdownToHtml(outline)).toBe(
      "<ol><li>one</li><li>two" +
        "<ol><li>two-a</li><li>two-b" +
        "<ol><li>two-b-i</li><li>two-b-ii</li></ol>" +
        "</li><li>two-c</li></ol>" +
        "</li><li>three</li></ol>",
    );
  });

  it("nests word-processor bullet glyphs by glyph", () => {
    expect(markdownToHtml("● one\n○ sub\n○ sub2\n● two")).toBe(
      "<ul><li>one<ul><li>sub</li><li>sub2</li></ul></li><li>two</li></ul>",
    );
  });

  it("keeps ASCII bullets at one level whichever character is used", () => {
    // Markdown treats - and * as the same level; only typographic glyphs (which
    // come from a word processor) carry depth.
    expect(markdownToHtml("- one\n* two")).toBe(
      "<ul><li>one</li><li>two</li></ul>",
    );
  });

  it("reads an ambiguous single letter from the list it continues", () => {
    // `i.` right after `h.` is the ninth letter, not roman numeral one.
    expect(markdownToHtml("g. seven\nh. eight\ni. nine")).toBe(
      '<ol start="7"><li>seven</li><li>eight</li><li>nine</li></ol>',
    );
    // `i.` after `b.` has nowhere to continue, so it opens the roman sub-level.
    expect(markdownToHtml("a. one\nb. two\ni. deep")).toBe(
      "<ol><li>one</li><li>two<ol><li>deep</li></ol></li></ol>",
    );
  });

  it("does not turn prose into a list", () => {
    // A multi-letter token is only a marker when it is a roman numeral.
    expect(markdownToHtml("Ok. Then this.\nAnd. Another line.")).toBe(
      "<p>Ok. Then this. And. Another line.</p>",
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
  it("keeps pasted headings as real headings (<h1> demotes, <h3> stays)", () => {
    // What a Markdown-preview copy puts on the clipboard.
    const clipboard =
      "<html><body><!--StartFragment-->" +
      "<h1>Big title</h1><p>Intro paragraph.</p>" +
      "<h3>Subsection</h3><ul><li>point one</li><li>point two</li></ul>" +
      "<!--EndFragment--></body></html>";

    const fragment = extractClipboardHtmlFragment(clipboard);
    expect(htmlFragmentHasBlocks(fragment)).toBe(true);

    const stored = sanitizeRichTextHtml(fragment);
    // <h1> demotes to <h2> (no <h1> in the body); <h3> is supported and stays.
    expect(stored).toContain("<h2>Big title</h2>");
    expect(stored).toContain("<h3>Subsection</h3>");
    expect(stored).toContain("<ul>");
    // <h1>/<h5>/<h6> never survive; <h2>–<h4> do.
    expect(stored).not.toMatch(/<h[156]\b/);
  });
});

describe("lists on the stored / rendered path", () => {
  it("stores a pasted 'loose' numbered list as one counting list", () => {
    // The end-to-end shape of the bug: three items, three <ol>s, every one of
    // them numbered "1." with a block gap between.
    const stored = sanitizeRichTextHtml(
      markdownToHtml("1. one\n\n2. two\n\n3. three"),
    );
    expect(stored).toBe("<ol><li>one</li><li>two</li><li>three</li></ol>");
  });

  it("repairs bodies stored before lists were merged, with no migration", () => {
    expect(sanitizeRichTextHtml("<ol><li>a</li></ol><ol><li>b</li></ol>")).toBe(
      "<ol><li>a</li><li>b</li></ol>",
    );
    expect(sanitizeRichTextHtml("<ul><li>a</li></ul>\n<ul><li>b</li></ul>")).toBe(
      "<ul><li>a</li><li>b</li></ul>",
    );
  });

  it("keeps an <ol start> so a deliberate restart survives storage", () => {
    expect(sanitizeRichTextHtml('<ol start="4"><li>a</li></ol>')).toBe(
      '<ol start="4"><li>a</li></ol>',
    );
    expect(
      sanitizeRichTextHtml('<ol><li>a</li></ol><ol start="7"><li>b</li></ol>'),
    ).toBe('<ol><li>a</li></ol><ol start="7"><li>b</li></ol>');
  });

  it("keeps only a real list position in start, and only on <ol>", () => {
    expect(
      sanitizeRichTextHtml('<ol start="javascript:alert(1)"><li>a</li></ol>'),
    ).toBe("<ol><li>a</li></ol>");
    expect(sanitizeRichTextHtml('<ol start="1"><li>a</li></ol>')).toBe(
      "<ol><li>a</li></ol>",
    );
    expect(sanitizeRichTextHtml('<ol start="-3"><li>a</li></ol>')).toBe(
      "<ol><li>a</li></ol>",
    );
    expect(sanitizeRichTextHtml('<ul start="4"><li>a</li></ul>')).toBe(
      "<ul><li>a</li></ul>",
    );
    expect(sanitizeRichTextHtml('<p start="4">text</p>')).toBe("<p>text</p>");
  });

  it("keeps nested lists nested", () => {
    expect(
      sanitizeRichTextHtml(
        "<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>",
      ),
    ).toBe("<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>");
  });
});

describe("linkifyMentionsInHtml", () => {
  const linkify = (html: string) => linkifyMentionsInHtml(html, "/uk/u/");

  it("turns a mention in body text into a locale-prefixed profile link", () => {
    expect(linkify("<p>Дякую @rostyslav за ревʼю</p>")).toBe(
      '<p>Дякую <a href="/uk/u/rostyslav" data-link-preview="" class="rich-text-mention">@rostyslav</a> за ревʼю</p>',
    );
  });

  it("handles several mentions across several blocks", () => {
    const out = linkify("<p>@ada and @bob</p><p>@ada again</p>");
    expect(out.match(/rich-text-mention/g)).toHaveLength(3);
  });

  it("leaves text inside an existing link alone", () => {
    // Nesting anchors would produce invalid markup and swallow the link.
    const html = '<p><a href="https://example.com">ping @ada</a></p>';
    expect(linkify(html)).toBe(html);
  });

  it("leaves code and pre untouched", () => {
    expect(linkify("<p><code>@decorator</code></p>")).toBe(
      "<p><code>@decorator</code></p>",
    );
    expect(linkify("<pre><code>npm i @scope/pkg</code></pre>")).toBe(
      "<pre><code>npm i @scope/pkg</code></pre>",
    );
  });

  it("resumes linkifying after a skipped element closes", () => {
    const out = linkify("<p><code>@x</code> ping @ada</p>");
    expect(out).toContain("<code>@x</code>");
    expect(out).toContain('href="/uk/u/ada"');
  });

  it("does not touch attribute values that contain an at-sign", () => {
    const html = '<p><img src="https://cdn.test/a@2x.png" alt="a"></p>';
    expect(linkify(html)).toBe(html);
  });

  it("skips email addresses", () => {
    const html = "<p>write to ada@example.com</p>";
    expect(linkify(html)).toBe(html);
  });

  it("returns the input untouched when there is no mention", () => {
    const html = "<p>plain text</p>";
    expect(linkify(html)).toBe(html);
    expect(linkify("")).toBe("");
  });

  it("cannot inject markup — the username charset is fixed by the matcher", () => {
    // `@<img …>` is not a mention: `<` ends the token, and the tag was already
    // sanitized away upstream, so nothing here can become executable.
    const out = linkify("<p>@&lt;script&gt;alert(1)&lt;/script&gt;</p>");
    expect(out).not.toContain("<script");
  });
});

describe("findHeadingOrderIssue", () => {
  it("returns null for a clean H2 → H3 → H4 outline", () => {
    expect(
      findHeadingOrderIssue(
        "<h2>Intro</h2><p>x</p><h3>Detail</h3><h4>Fine</h4><h2>Next</h2><h3>More</h3>",
      ),
    ).toBeNull();
  });

  it("returns null when there are no headings", () => {
    expect(findHeadingOrderIssue("<p>Just prose.</p><ul><li>a</li></ul>")).toBeNull();
  });

  it("flags a body that opens below <h2>", () => {
    const issue = findHeadingOrderIssue("<h3>Starts too deep</h3><p>x</p>");
    expect(issue).toEqual({
      kind: "first",
      level: 3,
      text: "Starts too deep",
    });
  });

  it("flags a skipped level (H2 straight to H4)", () => {
    const issue = findHeadingOrderIssue("<h2>Top</h2><h4>Skipped H3</h4>");
    expect(issue).toEqual({ kind: "skip", from: 2, to: 4, text: "Skipped H3" });
  });

  it("allows jumping back up any number of levels", () => {
    expect(
      findHeadingOrderIssue("<h2>A</h2><h3>B</h3><h4>C</h4><h2>D</h2>"),
    ).toBeNull();
  });

  it("strips inline markup from the reported heading text", () => {
    const issue = findHeadingOrderIssue("<h4><strong>Bold</strong>&nbsp;title</h4>");
    expect(issue).toEqual({ kind: "first", level: 4, text: "Bold title" });
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

