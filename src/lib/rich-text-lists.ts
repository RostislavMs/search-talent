/**
 * List surgery for the contenteditable composer.
 *
 * `document.execCommand("indent" | "outdent")` is the only built-in way to nest
 * a list item, and every browser implements it by dropping the sub-list *beside*
 * the item it belongs to (`<ul><li>a</li><ul>…</ul></ul>`) — markup that is
 * invalid, indents by accident rather than by structure, and loses the item
 * outright when it is lifted back out. These helpers perform the same two
 * operations directly on the DOM, producing the valid `<li><ul>…</ul></li>`
 * shape the normaliser and the styles both expect, so what the writer sees while
 * typing is what gets stored.
 *
 * They are pure DOM functions on purpose: no editor state, no selection work
 * (the caller owns the caret), so each one is unit-testable in jsdom.
 */

// The styles distinguish three marker levels; a fourth is where nesting stops.
export const MAX_LIST_DEPTH = 4;

function isListElement(node: Node | null | undefined): node is HTMLElement {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }
  const tag = (node as HTMLElement).tagName;
  return tag === "UL" || tag === "OL";
}

/** The `<ul>`/`<ol>` an item belongs to, or null when the item is orphaned. */
export function listOfItem(li: HTMLElement): HTMLElement | null {
  const parent = li.parentElement;
  return isListElement(parent) ? parent : null;
}

/** How deep a list sits, counting itself (a top-level list is 1). */
export function listDepth(list: HTMLElement, root?: HTMLElement | null): number {
  let depth = 1;
  let parent = list.parentElement;
  while (parent && parent !== root) {
    if (isListElement(parent)) {
      depth += 1;
    }
    parent = parent.parentElement;
  }
  return depth;
}

/** The items after `li` in its list — they follow it wherever it moves. */
function followingItems(li: HTMLElement): HTMLElement[] {
  const items: HTMLElement[] = [];
  let next = li.nextElementSibling;
  while (next) {
    if (next.tagName === "LI") {
      items.push(next as HTMLElement);
    }
    next = next.nextElementSibling;
  }
  return items;
}

/** Move `items` into a sub-list of `li`, reusing one it already ends with. */
function attachSubList(li: HTMLElement, tagName: string, items: HTMLElement[]) {
  if (items.length === 0) {
    return;
  }
  const last = li.lastElementChild;
  const target =
    isListElement(last) && last.tagName === tagName
      ? last
      : li.appendChild(li.ownerDocument.createElement(tagName.toLowerCase()));
  for (const item of items) {
    target.appendChild(item);
  }
}

/**
 * Nest `li` one level deeper, inside the item above it. Returns false when there
 * is nothing to nest into — the first item of a level is already as shallow as
 * it goes, which is how Markdown and every other editor behave.
 */
export function indentListItem(
  li: HTMLElement,
  root?: HTMLElement | null,
): boolean {
  const list = listOfItem(li);
  if (!list) {
    return false;
  }
  const previous = li.previousElementSibling;
  if (!previous || previous.tagName !== "LI") {
    return false;
  }
  if (listDepth(list, root) >= MAX_LIST_DEPTH) {
    return false;
  }

  // Reuse a sub-list the previous item already carries, so holding Tab builds one
  // sub-list instead of a stack of single-item ones.
  const last = previous.lastElementChild;
  const target =
    isListElement(last) && last.tagName === list.tagName
      ? last
      : previous.appendChild(
          li.ownerDocument.createElement(list.tagName.toLowerCase()),
        );
  target.appendChild(li);
  return true;
}

/**
 * Lift `li` one level out and return the block the caret should land in, or null
 * when nothing moved. A nested item becomes the next sibling of the item it hung
 * under; a top-level item leaves the list entirely as a paragraph, splitting the
 * list in two when it sat in the middle. Items that followed it keep their level
 * either way, so the outline never re-orders itself behind the writer.
 */
export function outdentListItem(li: HTMLElement): HTMLElement | null {
  const list = listOfItem(li);
  if (!list) {
    return null;
  }
  const doc = li.ownerDocument;
  const trailing = followingItems(li);
  const parentItem = list.parentElement;

  if (parentItem && parentItem.tagName === "LI") {
    const grandList = parentItem.parentElement;
    if (!grandList) {
      return null;
    }
    grandList.insertBefore(li, parentItem.nextSibling);
    attachSubList(li, list.tagName, trailing);
    if (!list.querySelector("li")) {
      list.remove();
    }
    return li;
  }

  const parent = list.parentNode;
  if (!parent) {
    return null;
  }

  // Top level: the item's own text becomes a paragraph, and any sub-list it
  // carried follows as a list of its own rather than being crammed into the <p>.
  const paragraph = doc.createElement("p");
  const detached: Node[] = [];
  while (li.firstChild) {
    const child = li.firstChild;
    li.removeChild(child);
    if (isListElement(child)) {
      detached.push(child);
    } else {
      paragraph.appendChild(child);
    }
  }
  if (!paragraph.firstChild) {
    paragraph.appendChild(doc.createElement("br"));
  }
  li.remove();

  let cursor: Node = list;
  const insertAfterCursor = (node: Node) => {
    parent.insertBefore(node, cursor.nextSibling);
    cursor = node;
  };
  insertAfterCursor(paragraph);
  for (const node of detached) {
    insertAfterCursor(node);
  }

  if (trailing.length > 0) {
    const rest = doc.createElement(list.tagName.toLowerCase());
    for (const item of trailing) {
      rest.appendChild(item);
    }
    // The remainder of a numbered list carries on counting instead of restarting
    // at 1: the items that stayed behind did not change position. Counted after
    // the move, so only the items still in the original list are in the total.
    if (list.tagName === "OL") {
      const before = Array.from(list.children).filter(
        (child) => child.tagName === "LI",
      ).length;
      if (before > 0) {
        rest.setAttribute("start", String(before + 1));
      }
    }
    insertAfterCursor(rest);
  }

  if (!list.querySelector("li")) {
    list.remove();
  }
  return paragraph;
}

export type ListShortcut = {
  command: "insertUnorderedList" | "insertOrderedList";
  start: number;
};

/**
 * The Markdown list prefix a writer has just typed at the start of a block, or
 * null. `- ` / `* ` / `+ ` opens a bulleted list and `1. ` / `1) ` a numbered
 * one — the way people actually start a list. Without it the characters stayed
 * literal and the toolbar was the only way in.
 */
export function matchListShortcut(typed: string): ListShortcut | null {
  if (/^[-*+]$/.test(typed)) {
    return { command: "insertUnorderedList", start: 1 };
  }
  const ordered = /^(\d{1,3})[.)]$/.exec(typed);
  if (ordered) {
    return { command: "insertOrderedList", start: Number(ordered[1]) };
  }
  return null;
}
