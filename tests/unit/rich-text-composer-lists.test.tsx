// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";

import RichTextComposer from "@/components/rich-text-composer";

// jsdom implements neither execCommand nor queryCommandState. The list keyboard
// handling under test does its own DOM work, so no-op stubs are enough — and the
// one command that IS delegated (the "- " shortcut) is asserted through the spy.
beforeEach(() => {
  document.execCommand = vi.fn(() => true);
  document.queryCommandState = vi.fn(() => false);
});

afterEach(cleanup);

function renderWithValue(value: string) {
  const onChange = vi.fn();
  const { container } = render(
    <RichTextComposer
      locale="en"
      value={value}
      onChange={onChange}
      placeholder="Text"
    />,
  );
  const editor = container.querySelector<HTMLElement>(".rich-text-editor")!;
  return { editor, onChange };
}

/** Drop a collapsed caret, the way a click or an arrow key would. */
function caretIn(node: Node, offset = 0) {
  const sel = window.getSelection()!;
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

describe("RichTextComposer list keyboard handling", () => {
  it("nests an item on Tab, keeping the caret in it", () => {
    const { editor, onChange } = renderWithValue(
      "<ul><li>one</li><li>two</li></ul>",
    );
    const items = editor.querySelectorAll("li");
    caretIn(items[1].firstChild!, 3);

    fireEvent.keyDown(editor, { key: "Tab" });

    expect(editor.innerHTML).toBe(
      "<ul><li>one<ul><li>two</li></ul></li></ul>",
    );
    expect(onChange).toHaveBeenLastCalledWith(
      "<ul><li>one<ul><li>two</li></ul></li></ul>",
    );
    // The writer can keep typing where they were, mid-word.
    expect(window.getSelection()?.anchorNode?.textContent).toBe("two");
    expect(window.getSelection()?.anchorOffset).toBe(3);
  });

  it("leaves the first item of a level where it is", () => {
    const { editor } = renderWithValue("<ul><li>one</li><li>two</li></ul>");
    caretIn(editor.querySelectorAll("li")[0].firstChild!, 0);

    fireEvent.keyDown(editor, { key: "Tab" });

    expect(editor.innerHTML).toBe("<ul><li>one</li><li>two</li></ul>");
  });

  it("lifts a top-level item out of the list on Shift+Tab", () => {
    const { editor, onChange } = renderWithValue(
      "<ul><li>one</li><li>two</li></ul>",
    );
    caretIn(editor.querySelectorAll("li")[1].firstChild!, 0);

    fireEvent.keyDown(editor, { key: "Tab", shiftKey: true });

    expect(editor.innerHTML).toBe("<ul><li>one</li></ul><p>two</p>");
    expect(onChange).toHaveBeenLastCalledWith("<ul><li>one</li></ul><p>two</p>");
  });

  it("pops a nested item up one level on Shift+Tab", () => {
    const { editor } = renderWithValue(
      "<ul><li>one<ul><li>deep</li></ul></li></ul>",
    );
    const deep = editor.querySelector("li ul li")!;
    caretIn(deep.firstChild!, 2);

    fireEvent.keyDown(editor, { key: "Tab", shiftKey: true });

    expect(editor.innerHTML).toBe("<ul><li>one</li><li>deep</li></ul>");
  });

  it("ends the list when Enter is pressed on an empty trailing item", () => {
    const { editor, onChange } = renderWithValue(
      "<ul><li>one</li><li><br></li></ul>",
    );
    caretIn(editor.querySelectorAll("li")[1], 0);

    fireEvent.keyDown(editor, { key: "Enter" });

    expect(editor.innerHTML).toBe("<ul><li>one</li></ul><p><br></p>");
    // The fresh paragraph is real content the writer is about to type into, so it
    // is kept in the emitted value rather than trimmed as trailing noise.
    expect(onChange).toHaveBeenLastCalledWith(
      "<ul><li>one</li></ul><p><br></p>",
    );
  });

  it("keeps Enter native on an item that still has content", () => {
    const { editor, onChange } = renderWithValue("<ul><li>one</li></ul>");
    caretIn(editor.querySelector("li")!.firstChild!, 3);

    fireEvent.keyDown(editor, { key: "Enter" });

    // Untouched: the browser inserts the next item itself.
    expect(editor.innerHTML).toBe("<ul><li>one</li></ul>");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("escapes the list on Backspace in an empty item, popping one level first", () => {
    const { editor } = renderWithValue(
      "<ul><li>one<ul><li><br></li></ul></li></ul>",
    );
    caretIn(editor.querySelector("li ul li")!, 0);

    fireEvent.keyDown(editor, { key: "Backspace" });

    expect(editor.innerHTML).toBe("<ul><li>one</li><li><br></li></ul>");
  });

  it("starts a bulleted list from a typed '- ' and drops the marker", () => {
    const { editor } = renderWithValue("<p>-</p>");
    caretIn(editor.querySelector("p")!.firstChild!, 1);

    fireEvent.keyDown(editor, { key: " " });

    expect(document.execCommand).toHaveBeenCalledWith(
      "insertUnorderedList",
      false,
      undefined,
    );
    // The "-" became the list, so it must not linger as text as well.
    expect(editor.textContent).toBe("");
  });

  it("starts a numbered list from a typed '1. '", () => {
    const { editor } = renderWithValue("<p>1.</p>");
    caretIn(editor.querySelector("p")!.firstChild!, 2);

    fireEvent.keyDown(editor, { key: " " });

    expect(document.execCommand).toHaveBeenCalledWith(
      "insertOrderedList",
      false,
      undefined,
    );
    expect(editor.textContent).toBe("");
  });

  it("does not fire the shortcut mid-line", () => {
    const { editor } = renderWithValue("<p>2 x 3 -</p>");
    caretIn(editor.querySelector("p")!.firstChild!, 7);

    fireEvent.keyDown(editor, { key: " " });

    expect(document.execCommand).not.toHaveBeenCalledWith(
      "insertUnorderedList",
      false,
      undefined,
    );
    expect(editor.textContent).toBe("2 x 3 -");
  });
});
