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

  it("keeps a spoiler expanded and intact even when empty", () => {
    const result = normalizeRichTextForEditor(
      "<details><summary>Title</summary><p>Body</p></details>",
    );
    expect(result).toMatch(/^<details open>/);
    expect(result).toContain("<summary>Title</summary>");
    expect(result).toContain("Body");
  });
});
