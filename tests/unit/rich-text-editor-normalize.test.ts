// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { normalizeRichTextForEditor } from "@/lib/rich-text";

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
