// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  normalizeRichTextForEditor,
  richTextFromClipboard,
} from "@/lib/rich-text";

describe("normalizeRichTextForEditor (editor DOM path)", () => {
  it("wraps bare top-level text in a paragraph", () => {
    expect(normalizeRichTextForEditor("hello")).toBe("<p>hello</p>");
  });

  it("converts <div> lines into <p> paragraphs", () => {
    expect(normalizeRichTextForEditor("<div>one</div><div>two</div>")).toBe(
      "<p>one</p><p>two</p>",
    );
  });

  it("splits stray top-level <br> into separate paragraphs", () => {
    expect(normalizeRichTextForEditor("one<br>two")).toBe("<p>one</p><p>two</p>");
  });

  it("keeps an explicit blank line between paragraphs", () => {
    expect(normalizeRichTextForEditor("<p>a</p><p><br></p><p>b</p>")).toBe(
      "<p>a</p><p><br></p><p>b</p>",
    );
  });

  it("preserves a trailing blank line after real content", () => {
    expect(normalizeRichTextForEditor("<p>a</p><p><br></p>")).toBe(
      "<p>a</p><p><br></p>",
    );
  });

  it("collapses a document that is only empty paragraphs to nothing", () => {
    expect(normalizeRichTextForEditor("<p><br></p>")).toBe("");
    expect(normalizeRichTextForEditor("<p><br></p><p><br></p>")).toBe("");
  });

  it("leaves well-formed paragraphs untouched", () => {
    expect(normalizeRichTextForEditor("<p>one</p><p>two</p>")).toBe(
      "<p>one</p><p>two</p>",
    );
  });

  it("strips a trailing filler <br> left inside a heading", () => {
    expect(normalizeRichTextForEditor("<h2>Heading<br></h2>")).toBe(
      "<h2>Heading</h2>",
    );
  });

  it("strips a trailing filler <br> left inside a paragraph", () => {
    expect(normalizeRichTextForEditor("<p>text<br></p>")).toBe("<p>text</p>");
  });

  it("strips a trailing filler <br> from each list item", () => {
    expect(
      normalizeRichTextForEditor("<ul><li>a<br></li><li>b<br></li></ul>"),
    ).toBe("<ul><li>a</li><li>b</li></ul>");
  });

  it("keeps a soft line break in the middle of a paragraph", () => {
    expect(normalizeRichTextForEditor("<p>line1<br>line2<br></p>")).toBe(
      "<p>line1<br>line2</p>",
    );
  });

  it("drops a trailing bare <br> at the root instead of adding a blank line", () => {
    expect(normalizeRichTextForEditor("<p>a</p><br>")).toBe("<p>a</p>");
    expect(normalizeRichTextForEditor("<ul><li>a</li></ul><br>")).toBe(
      "<ul><li>a</li></ul>",
    );
  });

  it("drops an empty <div> the browser leaves between blocks", () => {
    expect(
      normalizeRichTextForEditor("<p>a</p><div><br></div><p>b</p>"),
    ).toBe("<p>a</p><p>b</p>");
  });

  it("drops a bare <br> between blocks instead of adding a blank line", () => {
    expect(normalizeRichTextForEditor("<h2>H</h2><br><p>b</p>")).toBe(
      "<h2>H</h2><p>b</p>",
    );
  });

  it("drops an &nbsp;-only paragraph inserted between blocks", () => {
    expect(
      normalizeRichTextForEditor("<p>a</p><p>&nbsp;</p><p>b</p>"),
    ).toBe("<p>a</p><p>b</p>");
  });

  it("still keeps a real <p><br></p> blank line the user typed", () => {
    expect(normalizeRichTextForEditor("<p>a</p><p><br></p><p>b</p>")).toBe(
      "<p>a</p><p><br></p><p>b</p>",
    );
  });

  it("is stable across repeated normalisation (focus/blur cycles)", () => {
    const doc =
      "<p>a</p><h3>H</h3><blockquote>q</blockquote><ul><li>x</li></ul>";
    const once = normalizeRichTextForEditor(doc);
    expect(normalizeRichTextForEditor(once)).toBe(once);
  });

  it("strips trailing filler <br> inside a spoiler body", () => {
    expect(
      normalizeRichTextForEditor(
        "<details open><summary>Title</summary><ul><li>a<br></li><li>b</li></ul></details>",
      ),
    ).toBe(
      "<details open><summary>Title</summary><ul><li>a</li><li>b</li></ul></details>",
    );
  });

  it("keeps a spoiler expanded and intact even when empty", () => {
    const result = normalizeRichTextForEditor(
      "<details><summary>Title</summary><p>Body</p></details>",
    );
    expect(result).toMatch(/^<details open>/);
    expect(result).toContain("<summary>Title</summary>");
    expect(result).toContain("Body");
  });
});

describe("normalizeRichTextForEditor (lists)", () => {
  it("fuses adjacent same-type lists into one", () => {
    // One <ol> per item is what a "loose" Markdown paste and repeated toolbar
    // clicks both produce — and every list after the first restarts at "1.".
    expect(
      normalizeRichTextForEditor(
        "<ol><li>a</li></ol><ol><li>b</li></ol><ol><li>c</li></ol>",
      ),
    ).toBe("<ol><li>a</li><li>b</li><li>c</li></ol>");
    expect(
      normalizeRichTextForEditor("<ul><li>a</li></ul><ul><li>b</li></ul>"),
    ).toBe("<ul><li>a</li><li>b</li></ul>");
  });

  it("does NOT fuse lists of different types", () => {
    expect(
      normalizeRichTextForEditor("<ul><li>a</li></ul><ol><li>b</li></ol>"),
    ).toBe("<ul><li>a</li></ul><ol><li>b</li></ol>");
  });

  it("does NOT fuse a list that deliberately restarts its numbering", () => {
    expect(
      normalizeRichTextForEditor(
        '<ol><li>a</li></ol><ol start="7"><li>b</li></ol>',
      ),
    ).toBe('<ol><li>a</li></ol><ol start="7"><li>b</li></ol>');
  });

  it("moves a list nested beside an item into that item", () => {
    // What execCommand("indent") and pasted HTML produce: invalid markup that
    // indents by accident rather than by structure.
    expect(
      normalizeRichTextForEditor(
        "<ul><li>a</li><ul><li>b</li></ul><li>c</li></ul>",
      ),
    ).toBe("<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>");
  });

  it("keeps valid nesting untouched and stable", () => {
    const doc = "<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>";
    expect(normalizeRichTextForEditor(doc)).toBe(doc);
    expect(normalizeRichTextForEditor(normalizeRichTextForEditor(doc))).toBe(doc);
  });

  it("keeps an <ol start> so a continued list keeps counting", () => {
    expect(normalizeRichTextForEditor('<ol start="4"><li>a</li></ol>')).toBe(
      '<ol start="4"><li>a</li></ol>',
    );
    // start="1" is the default, and junk values are dropped.
    expect(normalizeRichTextForEditor('<ol start="1"><li>a</li></ol>')).toBe(
      "<ol><li>a</li></ol>",
    );
    expect(normalizeRichTextForEditor('<ol start="oops"><li>a</li></ol>')).toBe(
      "<ol><li>a</li></ol>",
    );
  });

  it("absorbs loose text between items into the item above it", () => {
    expect(
      normalizeRichTextForEditor("<ul><li>a</li>stray<li>b</li></ul>"),
    ).toBe("<ul><li>astray</li><li>b</li></ul>");
  });

  it("ignores formatting whitespace between items", () => {
    expect(
      normalizeRichTextForEditor("<ul>\n  <li>a</li>\n  <li>b</li>\n</ul>"),
    ).toBe("<ul><li>a</li><li>b</li></ul>");
  });

  it("gives a stray top-level <li> a list of its own", () => {
    expect(normalizeRichTextForEditor("<li>a</li><li>b</li>")).toBe(
      "<ul><li>a</li><li>b</li></ul>",
    );
  });

  it("drops an empty list but keeps an item being typed into", () => {
    expect(normalizeRichTextForEditor("<p>a</p><ul></ul>")).toBe("<p>a</p>");
    expect(normalizeRichTextForEditor("<ul><li><br></li></ul>")).toBe(
      "<ul><li><br></li></ul>",
    );
  });

  it("unwraps the paragraph a word processor puts inside every item", () => {
    expect(
      normalizeRichTextForEditor("<ul><li><p>a</p></li><li><p>b</p></li></ul>"),
    ).toBe("<ul><li>a</li><li>b</li></ul>");
    // …including when the item also carries a sub-list.
    expect(
      normalizeRichTextForEditor(
        "<ul><li><p>a</p><ul><li><p>a1</p></li></ul></li></ul>",
      ),
    ).toBe("<ul><li>a<ul><li>a1</li></ul></li></ul>");
    // An item that really holds two paragraphs keeps them.
    expect(
      normalizeRichTextForEditor("<ul><li><p>a</p><p>b</p></li></ul>"),
    ).toBe("<ul><li><p>a</p><p>b</p></li></ul>");
  });
});

/** A trimmed-down version of what Google Docs actually puts on the clipboard. */
const DOCS_CLIPBOARD_HTML =
  '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-x">' +
  '<ol style="margin-top:0;padding-inline-start:48px;">' +
  '<li dir="ltr" style="list-style-type:decimal;" aria-level="1">' +
  '<p dir="ltr" role="presentation"><span style="font-weight:400;">one</span></p></li>' +
  '<li dir="ltr" style="list-style-type:decimal;" aria-level="1">' +
  '<p dir="ltr" role="presentation"><span style="font-weight:700;">two</span></p>' +
  '<ol style="margin-top:0;"><li dir="ltr" style="list-style-type:lower-alpha;" aria-level="2">' +
  '<p dir="ltr" role="presentation"><span style="font-style:italic;">two-a</span></p></li>' +
  '<li dir="ltr" style="list-style-type:lower-alpha;" aria-level="2">' +
  '<p dir="ltr" role="presentation"><span>two-b</span></p></li></ol></li></ol></b>';

// The plain-text flavour of that same selection: the nesting is gone, the levels
// are marked by letters only.
const DOCS_CLIPBOARD_TEXT = "1. one\n2. two\na. two-a\nb. two-b";

describe("richTextFromClipboard", () => {
  it("keeps a Google Docs list nested, bold and italic included", () => {
    expect(richTextFromClipboard(DOCS_CLIPBOARD_HTML, DOCS_CLIPBOARD_TEXT)).toBe(
      "<ol><li>one</li><li><strong>two</strong>" +
        "<ol><li><em>two-a</em></li><li>two-b</li></ol></li></ol>",
    );
  });

  it("does not let the Docs wrapper make everything bold", () => {
    // Docs wraps the whole selection in <b style="font-weight:normal">.
    const pasted = richTextFromClipboard(
      '<b style="font-weight:normal" id="docs-internal-guid-x"><h1>Title</h1>' +
        "<p>Plain body.</p></b>",
      "Title\nPlain body.",
    );
    expect(pasted).toBe("<h2>Title</h2><p>Plain body.</p>");
    expect(pasted).not.toContain("<strong>");
  });

  it("rebuilds Markdown source from the text flavour, not the coloured HTML", () => {
    // A copy out of a code editor: the HTML is <span>/<div> soup with the
    // Markdown still literal inside it.
    const vsCodeHtml =
      '<div style="color:#d4d4d4;background-color:#1f1f1f;font-family:Consolas;">' +
      '<div><span style="color:#6a9955;">## Heading</span></div>' +
      '<div><span style="color:#d4d4d4;">1. one</span></div>' +
      '<div><span style="color:#d4d4d4;">2. two</span></div></div>';
    const text = "## Heading\n\n1. one\n2. two";

    expect(richTextFromClipboard(vsCodeHtml, text)).toBe(
      "<h2>Heading</h2><ol><li>one</li><li>two</li></ol>",
    );
  });

  it("rebuilds from plain text when there is no HTML flavour at all", () => {
    expect(richTextFromClipboard("", "1. one\n\n2. two")).toBe(
      "<ol><li>one</li><li>two</li></ol>",
    );
  });

  it("leaves a small inline paste to the browser", () => {
    expect(richTextFromClipboard("<b>word</b>", "word")).toBe("");
    expect(richTextFromClipboard("", "just a sentence")).toBe("");
    expect(richTextFromClipboard("", "")).toBe("");
  });
});
