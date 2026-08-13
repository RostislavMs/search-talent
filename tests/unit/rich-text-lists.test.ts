// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  indentListItem,
  listDepth,
  listOfItem,
  matchListShortcut,
  outdentListItem,
} from "@/lib/rich-text-lists";

/** Build an editor root from markup and hand back the <li> at `index`. */
function editorWith(html: string) {
  const root = document.createElement("div");
  root.innerHTML = html;
  const items = Array.from(root.querySelectorAll("li"));
  return { root, items, html: () => root.innerHTML };
}

describe("indentListItem", () => {
  it("nests an item inside the item above it (valid <li><ul> markup)", () => {
    const { root, items, html } = editorWith(
      "<ul><li>a</li><li>b</li><li>c</li></ul>",
    );
    expect(indentListItem(items[1], root)).toBe(true);
    expect(html()).toBe("<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>");
  });

  it("reuses a sub-list the previous item already has", () => {
    const { root, html } = editorWith(
      "<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>",
    );
    const c = Array.from(root.querySelectorAll("li")).find(
      (li) => li.textContent === "c",
    )!;
    expect(indentListItem(c, root)).toBe(true);
    // Joins `a`'s existing sub-list instead of starting a second one next to it.
    expect(html()).toBe("<ul><li>a<ul><li>b</li><li>c</li></ul></li></ul>");
  });

  it("builds one sub-list when consecutive items are indented in turn", () => {
    const { root, items, html } = editorWith(
      "<ul><li>a</li><li>b</li><li>c</li></ul>",
    );
    expect(indentListItem(items[1], root)).toBe(true);
    // `c` is now the item right after `a`, so indenting it joins b's sub-list.
    expect(indentListItem(items[2], root)).toBe(true);
    expect(html()).toBe("<ul><li>a<ul><li>b</li><li>c</li></ul></li></ul>");
  });

  it("refuses to indent the first item of a level", () => {
    const { root, items, html } = editorWith("<ul><li>a</li><li>b</li></ul>");
    expect(indentListItem(items[0], root)).toBe(false);
    expect(html()).toBe("<ul><li>a</li><li>b</li></ul>");
  });

  it("keeps the item's own sub-list with it", () => {
    const { root, items, html } = editorWith(
      "<ul><li>a</li><li>b<ul><li>b1</li></ul></li></ul>",
    );
    expect(indentListItem(items[1], root)).toBe(true);
    expect(html()).toBe(
      "<ul><li>a<ul><li>b<ul><li>b1</li></ul></li></ul></li></ul>",
    );
  });

  it("stops at the maximum nesting depth", () => {
    const { root, html } = editorWith(
      "<ul><li>a<ul><li>b<ul><li>c<ul><li>d1</li><li>d2</li></ul></li></ul></li></ul></li></ul>",
    );
    const d2 = Array.from(root.querySelectorAll("li")).find(
      (li) => li.textContent === "d2",
    )!;
    expect(listDepth(listOfItem(d2)!, root)).toBe(4);
    expect(indentListItem(d2, root)).toBe(false);
    expect(html()).toContain("<li>d1</li><li>d2</li>");
  });
});

describe("outdentListItem", () => {
  it("lifts a nested item next to the item it hung under", () => {
    const { root, html } = editorWith(
      "<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>",
    );
    const b = Array.from(root.querySelectorAll("li")).find(
      (li) => li.textContent === "b",
    )!;
    expect(outdentListItem(b)).toBe(b);
    expect(html()).toBe("<ul><li>a</li><li>b</li><li>c</li></ul>");
  });

  it("keeps the items that followed it one level deeper", () => {
    const { root, html } = editorWith(
      "<ul><li>a<ul><li>b1</li><li>b2</li><li>b3</li></ul></li></ul>",
    );
    const b1 = root.querySelectorAll("li")[1];
    outdentListItem(b1);
    expect(html()).toBe(
      "<ul><li>a</li><li>b1<ul><li>b2</li><li>b3</li></ul></li></ul>",
    );
  });

  it("turns a top-level item into a paragraph after the list", () => {
    const { root, html } = editorWith("<ul><li>a</li><li>b</li></ul>");
    const b = root.querySelectorAll("li")[1];
    const target = outdentListItem(b);
    expect(target?.tagName).toBe("P");
    expect(html()).toBe("<ul><li>a</li></ul><p>b</p>");
  });

  it("splits the list when a middle item leaves it", () => {
    const { root, html } = editorWith(
      "<ol><li>a</li><li>b</li><li>c</li></ol>",
    );
    outdentListItem(root.querySelectorAll("li")[1]);
    // The remainder carries on counting: `c` is still the third item.
    expect(html()).toBe(
      '<ol><li>a</li></ol><p>b</p><ol start="2"><li>c</li></ol>',
    );
  });

  it("removes the list when its only item leaves", () => {
    const { root, html } = editorWith("<p>x</p><ul><li>a</li></ul>");
    outdentListItem(root.querySelector("li")!);
    expect(html()).toBe("<p>x</p><p>a</p>");
  });

  it("keeps a sub-list as a list of its own, not inside the paragraph", () => {
    const { root, html } = editorWith(
      "<ul><li>a<ul><li>a1</li></ul></li></ul>",
    );
    outdentListItem(root.querySelector("li")!);
    expect(html()).toBe("<p>a</p><ul><li>a1</li></ul>");
  });

  it("leaves an empty item as an empty paragraph to type into", () => {
    const { root, html } = editorWith("<ul><li>a</li><li><br></li></ul>");
    outdentListItem(root.querySelectorAll("li")[1]);
    expect(html()).toBe("<ul><li>a</li></ul><p><br></p>");
  });

  it("does nothing for an item outside a list", () => {
    const orphan = document.createElement("li");
    expect(outdentListItem(orphan)).toBeNull();
  });
});

describe("indent → outdent round trip", () => {
  it("returns the list to its original shape", () => {
    const original = "<ul><li>a</li><li>b</li><li>c</li></ul>";
    const { root, items, html } = editorWith(original);
    indentListItem(items[1], root);
    outdentListItem(items[1]);
    expect(html()).toBe(original);
  });
});

describe("matchListShortcut", () => {
  it("recognises the Markdown list prefixes", () => {
    expect(matchListShortcut("-")).toEqual({
      command: "insertUnorderedList",
      start: 1,
    });
    expect(matchListShortcut("*")?.command).toBe("insertUnorderedList");
    expect(matchListShortcut("+")?.command).toBe("insertUnorderedList");
    expect(matchListShortcut("1.")).toEqual({
      command: "insertOrderedList",
      start: 1,
    });
    expect(matchListShortcut("5)")).toEqual({
      command: "insertOrderedList",
      start: 5,
    });
  });

  it("ignores anything that is not a bare marker", () => {
    expect(matchListShortcut("")).toBeNull();
    expect(matchListShortcut("a")).toBeNull();
    expect(matchListShortcut("--")).toBeNull();
    expect(matchListShortcut("word -")).toBeNull();
    expect(matchListShortcut("1.2")).toBeNull();
    expect(matchListShortcut("1")).toBeNull();
  });
});
