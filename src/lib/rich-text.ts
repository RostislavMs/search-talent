import DOMPurify from "isomorphic-dompurify";
import { MENTION_REGEX } from "@/lib/constants/mentions";

export { extractPlainTextFromRichText } from "@/lib/rich-text-plain";

const allowedTags = new Set([
  "a",
  "blockquote",
  "br",
  "code",
  "details",
  "em",
  "figure",
  "figcaption",
  "h2",
  "h3",
  "h4",
  "hr",
  "iframe",
  "img",
  "li",
  "ol",
  "p",
  "strong",
  "summary",
  "ul",
]);

const tagAliases: Record<string, string> = {
  b: "strong",
  i: "em",
  // The body supports a three-level heading outline: <h2> (top section, one
  // step below the page <h1> title), <h3> and <h4>. Levels outside that range —
  // pasted from a Markdown preview or a rendered page — are clamped onto the
  // nearest supported level instead of being flattened to plain paragraph text:
  // <h1> demotes to <h2>, and <h5>/<h6> promote to the deepest level, <h4>.
  h1: "h2",
  h5: "h4",
  h6: "h4",
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Zero-width space the composer seeds into an empty inline <code> so the caret
// has somewhere to live. Stripped on normalise so it never reaches stored
// content and empty code spans collapse to nothing.
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);

function stripZeroWidth(value: string) {
  return value.split(ZERO_WIDTH_SPACE).join("");
}

// Text blocks where a trailing <br> is browser filler, not content.
const TEXT_BLOCK_TAGS = new Set([
  "p",
  "h2",
  "h3",
  "h4",
  "blockquote",
  "li",
  "summary",
  "figcaption",
]);

// Remove a trailing <br> (with any whitespace/&nbsp; around it) that
// contentEditable leaves at the end of a block — e.g. <h2>Title<br></h2> or
// <li>item<br></li>. Left in place it renders as a spurious empty line after the
// block once the editor blurs and re-normalises. A lone <br> (a genuinely empty
// line) is preserved: the caller's empty-block handling turns it into a clean
// <p><br></p>.
function stripTrailingBr(content: string): string {
  const withoutTrailing = content.replace(
    /(?:\s|&nbsp;|<br\s*\/?>)+$/gi,
    (match) => (/<br/i.test(match) ? "" : match),
  );
  return withoutTrailing.trim().length > 0 ? withoutTrailing : content;
}

// True when a block's inner HTML carries no real content — only <br>, &nbsp; and
// whitespace. Such a block is either a blank line the user typed or noise the
// browser dropped in; the caller decides which based on whether a <br> is present.
function htmlIsBlank(content: string): boolean {
  return (
    content
      .replace(/<br\s*\/?>/gi, "")
      .replace(/&nbsp;/gi, "")
      .replace(/\s+/g, "") === ""
  );
}

function normalizePlainTextToHtml(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

// Private-use sentinels wrap protected inline-code spans while the emphasis /
// link rules run, so their contents are never touched and can't collide with
// real text (unlike a digit-based placeholder). Removed again on restore.
const CODE_SENTINEL_OPEN = String.fromCharCode(0xe000);
const CODE_SENTINEL_CLOSE = String.fromCharCode(0xe001);

/**
 * Inline Markdown → HTML for a single line/segment: `code`, **bold**, *italic*
 * and [text](url) links. Code spans are stashed first so the emphasis rules skip
 * their contents; everything else is escaped before the (trusted) tags we emit
 * are added. Output is always re-sanitised by the caller.
 */
export function inlineMarkdownToHtml(text: string): string {
  const codes: string[] = [];
  let out = text.replace(/`([^`]+)`/g, (_m, code: string) => {
    codes.push(code);
    return `${CODE_SENTINEL_OPEN}${codes.length - 1}${CODE_SENTINEL_CLOSE}`;
  });
  out = escapeHtml(out);
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_m, label: string, url: string) => `<a href="${url}">${label}</a>`,
  );
  out = out.replace(
    new RegExp(`${CODE_SENTINEL_OPEN}(\\d+)${CODE_SENTINEL_CLOSE}`, "g"),
    (_m, i: string) => `<code>${escapeHtml(codes[Number(i)] ?? "")}</code>`,
  );
  return out;
}

// List markers the plain-text paste path understands. Bullets cover both the
// ASCII ones people type and the typographic glyphs Google Docs / Word put on the
// clipboard; ordered items cover `1.`, `1)`, `a.` and `IV.` — word processors
// number their sub-levels with letters and roman numerals, and pasting one of
// those outlines used to glue every sub-item into the item above it.
const BULLET_ITEM_PATTERN = /^([-*+•●○◦▪■·])\s+(.*)$/;
const ORDERED_ITEM_PATTERN = /^(\d{1,9}|[A-Za-z]{1,7})[.)]\s+(.*)$/;
// GitHub-style task markers. The editor has no checkbox node, so the state is
// kept as a ballot glyph instead of leaking literal "[ ]" brackets into the body.
const TASK_ITEM_PATTERN = /^\[([ xX])\]\s+(.*)$/;

// One nesting step in Markdown is two spaces (a tab counts as four columns).
// A shallower difference is treated as the same level, so a list indented by one
// stray space does not silently become a sub-list.
const LIST_NEST_INDENT = 2;
// Deeper nesting than this is almost always runaway whitespace, and the styles
// only distinguish three marker levels — so the fourth is where nesting stops.
const MAX_LIST_DEPTH = 4;

/**
 * A parsed list line. `marker` identifies the *style* of the marker, not just the
 * kind of list: two items at the same indentation whose styles differ sit at
 * different depths, which is the only way a word processor expresses nesting once
 * its markup is reduced to plain text (`1.` → `a.` → `i.`).
 */
type MarkdownListItem = {
  tag: "ul" | "ol";
  marker: string;
  /** The ordinal the marker spells out (`4.` → 4, `b.` → 2, `iv.` → 4). */
  value: number | null;
  content: string;
};

type OpenList = {
  tag: "ul" | "ol";
  marker: string;
  indent: number;
  /** Ordinal of this level's most recent item; disambiguates `i.`/`v.`/`x.`. */
  value: number;
  itemOpen: boolean;
};

// `- [ ] todo` / `- [x] done` → a readable glyph, since there is no checkbox node.
function unwrapTaskMarker(content: string): string {
  const task = TASK_ITEM_PATTERN.exec(content);
  if (!task) {
    return content;
  }
  return `${task[1] === " " ? "☐" : "☑"} ${task[2]}`;
}

const ROMAN_PATTERN = /^m{0,3}(?:cm|cd|d?c{0,3})(?:xc|xl|l?x{0,3})(?:ix|iv|v?i{0,3})$/;
const ROMAN_DIGITS: Record<string, number> = {
  i: 1,
  v: 5,
  x: 10,
  l: 50,
  c: 100,
  d: 500,
  m: 1000,
};

/** The value of a well-formed roman numeral, or null when it is not one. */
function romanValue(token: string): number | null {
  const lower = token.toLowerCase();
  if (!lower || !ROMAN_PATTERN.test(lower)) {
    return null;
  }
  let total = 0;
  for (let i = 0; i < lower.length; i += 1) {
    const current = ROMAN_DIGITS[lower[i]];
    const next = ROMAN_DIGITS[lower[i + 1]] ?? 0;
    total += current < next ? -current : current;
  }
  return total || null;
}

/** `a` → 1, `z` → 26. Only single letters carry an alphabetic position. */
function alphaValue(token: string): number | null {
  if (token.length !== 1) {
    return null;
  }
  const position = token.toLowerCase().charCodeAt(0) - 96;
  return position >= 1 && position <= 26 ? position : null;
}

function matchMarkdownListItem(
  line: string,
  open: OpenList[],
): MarkdownListItem | null {
  const bullet = BULLET_ITEM_PATTERN.exec(line);
  if (bullet) {
    // ASCII bullets all share one style, so Markdown's "switching - for * is
    // still the same level" holds. The typographic glyphs only ever come from a
    // word processor, where a different glyph does mean a different depth.
    const glyph = bullet[1];
    return {
      tag: "ul",
      marker: "-*+".includes(glyph) ? "bullet" : `bullet:${glyph}`,
      value: null,
      content: unwrapTaskMarker(bullet[2]),
    };
  }

  const ordered = ORDERED_ITEM_PATTERN.exec(line);
  if (!ordered) {
    return null;
  }
  const token = ordered[1];
  const content = unwrapTaskMarker(ordered[2]);
  const item = (marker: string, value: number): MarkdownListItem => ({
    tag: "ol",
    marker,
    value,
    content,
  });

  if (/^\d+$/.test(token)) {
    return item("decimal", Number(token));
  }

  const cased = token === token.toUpperCase() ? "upper" : "lower";
  const roman = romanValue(token);
  const alpha = alphaValue(token);

  if (alpha === null) {
    // A multi-letter token is a list marker only if it is a roman numeral —
    // otherwise a sentence like "Ok. Next thing" would open a list.
    return roman === null ? null : item(`roman-${cased}`, roman);
  }
  if (roman === null) {
    return item(`alpha-${cased}`, alpha);
  }

  // A single letter that is also a roman digit (i, v, x, l, c, d, m). Continue
  // whichever open level it comes next in — that is what tells `c.` after `ii.`
  // (back to the letter level) from `i.` after `b.` (a new roman sub-level).
  const alphaMarker = `alpha-${cased}`;
  const romanMarker = `roman-${cased}`;
  const continues = (marker: string, value: number) =>
    open.some((level) => level.marker === marker && level.value + 1 === value);

  if (continues(alphaMarker, alpha)) {
    return item(alphaMarker, alpha);
  }
  if (continues(romanMarker, roman)) {
    return item(romanMarker, roman);
  }
  for (let i = open.length - 1; i >= 0; i -= 1) {
    if (open[i].tag === "ol") {
      // Under a letter level, a stray `i.` opens the roman level below it.
      return open[i].marker === alphaMarker
        ? item(romanMarker, roman)
        : item(alphaMarker, alpha);
    }
  }
  // Nothing open to judge by: a list that starts at `i` is roman far more often
  // than it is the ninth letter.
  return roman === 1 ? item(romanMarker, roman) : item(alphaMarker, alpha);
}

// Leading whitespace in columns — Markdown's signal for nesting.
function indentWidth(line: string): number {
  let width = 0;
  for (const char of line) {
    if (char === " ") {
      width += 1;
    } else if (char === "\t") {
      width += 4;
    } else {
      break;
    }
  }
  return width;
}

// A list that does not start at 1 keeps its first number, so `3.` pasted mid-list
// carries on counting instead of resetting to "1.".
function openListTag(item: MarkdownListItem): string {
  return item.tag === "ol" && item.value !== null && item.value > 1
    ? `<ol start="${item.value}">`
    : `<${item.tag}>`;
}

// The deepest open level using this marker style, or -1. A marker that reappears
// is a step back out to its own level, not a new one.
function findOpenLevel(open: OpenList[], marker: string): number {
  for (let i = open.length - 1; i >= 0; i -= 1) {
    if (open[i].marker === marker) {
      return i;
    }
  }
  return -1;
}

/**
 * Block-level Markdown → HTML for pasted plain-text drafts. Covers only what the
 * editor supports — headings (clamped to the <h2>–<h4> outline), blockquotes, bullet / ordered
 * lists (nested by indentation), horizontal rules and blank-line paragraphs — plus inline marks.
 * Raw HTML lines (e.g. the <details> spoiler blocks the drafts use) pass through untouched.
 * This is NOT a security boundary: the result must be run through
 * sanitizeRichTextHtml / normalizeRichTextForEditor before it reaches any DOM.
 */
export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const html: string[] = [];
  // Open lists, outermost first. `itemOpen` tracks whether the level's current
  // <li> is still awaiting its closing tag — that is what lets a sub-list or a
  // continuation line land *inside* the item it belongs to.
  const lists: OpenList[] = [];
  let paragraph: string[] = [];
  let quote: string[] = [];
  let blankSeen = false;

  const closeItem = () => {
    const list = lists[lists.length - 1];
    if (list?.itemOpen) {
      html.push("</li>");
      list.itemOpen = false;
    }
  };
  // Closing a sub-list deliberately leaves the parent's <li> open: that item
  // wraps the sub-list, so it is closed by the next item (or the next pop).
  const closeList = () => {
    closeItem();
    const list = lists.pop();
    if (list) {
      html.push(`</${list.tag}>`);
    }
  };
  const closeLists = () => {
    while (lists.length > 0) {
      closeList();
    }
  };
  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inlineMarkdownToHtml(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      html.push(
        `<blockquote>${inlineMarkdownToHtml(quote.join(" "))}</blockquote>`,
      );
      quote = [];
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushQuote();
    closeLists();
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushParagraph();
      flushQuote();
      // A blank line does NOT end a list. "Loose" lists — an empty line between
      // every item — are what assistants, docs and most Markdown editors emit;
      // ending the list here gave every item its own <ol>, so each one restarted
      // at "1." with a block gap between them. Only a non-list block below
      // (prose, heading, quote, rule) actually closes the list.
      blankSeen = true;
      continue;
    }
    const afterBlank = blankSeen;
    blankSeen = false;

    // Raw HTML line (spoilers, etc.) — emit verbatim, let the sanitiser validate.
    if (/^<\/?[a-z][a-z0-9]*(\s|>|\/|$)/i.test(trimmed)) {
      flushAll();
      html.push(trimmed);
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushAll();
      html.push("<hr>");
      continue;
    }
    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushAll();
      // Map the Markdown level onto the body's supported outline (<h2>–<h4>):
      // `#`/`##` open a section as <h2>, `###` → <h3>, and `####`+ → <h4>.
      const level = Math.min(Math.max(heading[1].length, 2), 4);
      html.push(`<h${level}>${inlineMarkdownToHtml(heading[2].trim())}</h${level}>`);
      continue;
    }
    const bq = trimmed.match(/^>\s?(.*)$/);
    if (bq) {
      flushParagraph();
      closeLists();
      quote.push(bq[1]);
      continue;
    }
    // A non-quote line ends any open blockquote.
    flushQuote();

    const item = matchMarkdownListItem(trimmed, lists);
    if (item) {
      flushParagraph();
      const indent = indentWidth(rawLine);
      // Step back out of every level the item is no longer indented into.
      while (lists.length > 1 && indent < lists[lists.length - 1].indent) {
        closeList();
      }
      const current = lists[lists.length - 1];
      const canNest = lists.length < MAX_LIST_DEPTH;
      const openLevel = () => {
        html.push(openListTag(item));
        lists.push({
          tag: item.tag,
          marker: item.marker,
          indent,
          value: 0,
          itemOpen: false,
        });
      };

      if (!current) {
        openLevel();
      } else if (
        current.itemOpen &&
        indent >= current.indent + LIST_NEST_INDENT &&
        canNest
      ) {
        // Indentation is the explicit signal, so it decides on its own.
        openLevel();
      } else if (current.tag !== item.tag) {
        // Switching between bullets and numbers starts a new list at this level.
        closeList();
        openLevel();
      } else if (current.marker !== item.marker) {
        // Same kind of list, different marker style. Word processors express
        // depth that way (1. → a. → i.) and their plain-text flavour often has
        // no indentation left to go by, so the style is what is left to read.
        const shallower = findOpenLevel(lists, item.marker);
        if (shallower >= 0) {
          while (lists.length > shallower + 1) {
            closeList();
          }
          closeItem();
        } else if (current.itemOpen && canNest) {
          openLevel();
        } else {
          closeList();
          openLevel();
        }
      } else {
        closeItem();
      }

      html.push(`<li>${inlineMarkdownToHtml(item.content)}`);
      const level = lists[lists.length - 1];
      level.itemOpen = true;
      level.value = item.value ?? level.value + 1;
      continue;
    }

    // A plain line directly below an open item continues that item (Markdown
    // "lazy continuation") instead of cutting the list in two around a paragraph.
    if (lists[lists.length - 1]?.itemOpen && !afterBlank) {
      html.push(` ${inlineMarkdownToHtml(trimmed)}`);
      continue;
    }

    // Plain prose — accumulate into the current paragraph.
    closeLists();
    paragraph.push(trimmed);
  }

  flushAll();
  return html.join("");
}

/**
 * Whether pasted plain text carries actual Markdown SYNTAX (heading / list /
 * quote / rule / inline marks / a raw HTML block), as opposed to just prose. The
 * paste handler treats this as the strong signal that the text is a Markdown
 * source to rebuild — and prefers it over any text/html on the clipboard, because
 * editors and "source" previews put literal `## …` on BOTH the plain-text and the
 * HTML flavour, and only the plain text is cleanly parseable. Deliberately does
 * NOT fire on "just multiple paragraphs": rendered sources (real <h1>/<h2> tags)
 * carry no syntax markers, so they fall through to the HTML path instead.
 */
export function hasMarkdownSyntax(text: string): boolean {
  return (
    /(^|\n)\s{0,3}#{1,6}\s/.test(text) || // heading
    /(^|\n)\s{0,3}[-*+]\s/.test(text) || // bullet list
    /(^|\n)[ \t]{0,12}[•●○◦▪■·]\s/.test(text) || // word-processor bullet list
    /(^|\n)\s{0,3}\d+\.\s/.test(text) || // ordered list
    /(^|\n)\s{0,3}>\s/.test(text) || // blockquote
    /(^|\n)\s{0,3}(-{3,}|\*{3,}|_{3,})\s*(\n|$)/.test(text) || // rule
    /<(?:details|summary|h[1-6]|ul|ol|blockquote)\b/i.test(text) || // raw HTML block
    /\*\*[^*\n]+\*\*/.test(text) || // bold
    /`[^`\n]+`/.test(text) || // inline code
    /\[[^\]\n]+\]\([^)\s]+\)/.test(text) // link
  );
}

/**
 * Pull the meaningful markup out of a clipboard `text/html` payload. When you
 * copy from a rendered source (e.g. a Markdown preview) the browser wraps the
 * selection in a full <html>…</html> shell — Chrome/Edge also add
 * <!--StartFragment-->…<!--EndFragment--> markers plus a <style>/<head> block
 * from the source. We slice out the fragment and drop that noise so the
 * sanitiser sees just the copied blocks (real <h1>/<h2> headings, lists, …),
 * which then normalise to the editor's allowlist instead of being flattened to
 * plain text by the browser's default contentEditable paste.
 */
export function extractClipboardHtmlFragment(html: string): string {
  const marked = html.match(
    /<!--\s*StartFragment\s*-->([\s\S]*?)<!--\s*EndFragment\s*-->/i,
  );
  const fragment = marked ? marked[1] : html;
  return [
    /<!--[\s\S]*?-->/g,
    /<head[\s\S]*?<\/head>/gi,
    /<style[\s\S]*?<\/style>/gi,
    /<\/?(?:html|body|meta|title|link)\b[^>]*>/gi,
  ]
    .reduce(stripUntilStable, fragment)
    .trim();
}

// Apply a removal pattern repeatedly until the string stops changing. A single
// pass is not enough because overlapping/nested markup (e.g. `<!--<!-- -->-->`
// or `<sty<style>…</sty</style>le>`) can reassemble a fresh `<!--`/`<style` once
// the inner match is cut out — so we loop until a pass removes nothing.
function stripUntilStable(input: string, pattern: RegExp): string {
  let current = input;
  let previous: string;
  do {
    previous = current;
    current = current.replace(pattern, "");
  } while (current !== previous);
  return current;
}

/**
 * Whether a clipboard HTML fragment carries block-level structure worth
 * normalising ourselves (headings, lists, rules, or more than one paragraph).
 * A small inline fragment (a styled word or two) returns false so the editor
 * keeps the browser's default paste and never wraps it in its own paragraph.
 */
export function htmlFragmentHasBlocks(fragment: string): boolean {
  if (htmlFragmentHasStructuralBlocks(fragment)) {
    return true;
  }
  return (fragment.match(/<p[\s>]/gi)?.length ?? 0) > 1;
}

/**
 * Whether a clipboard HTML fragment carries real *structural* tags — headings,
 * lists, quotes, rules — as opposed to a styled rendering of Markdown source
 * text. This is what decides which clipboard flavour the editor rebuilds from:
 *
 *  - A copy from Google Docs, Word, a chat answer or any rendered page has real
 *    <ol>/<li> nesting plus inline emphasis, and the plain-text flavour of the
 *    same selection has lost both (a sub-item's `a.` marker is just text there).
 *    The HTML has to win, or nested lists arrive flattened.
 *  - A copy of Markdown *source* (a .md file, a code editor, a "raw" view) puts
 *    literal `## …` / `1. …` on both flavours, but its HTML is only coloured
 *    <span>/<div> soup with none of these tags — so it takes the Markdown path.
 */
export function htmlFragmentHasStructuralBlocks(fragment: string): boolean {
  return /<(?:h[1-6]|ul|ol|blockquote|hr|pre|table|details)\b/i.test(fragment);
}

const youtubeEmbedPattern = /^https:\/\/www\.youtube(?:-nocookie)?\.com\/embed\/[\w-]+$/;

// Inline emphasis a word processor expresses with CSS instead of tags: Docs and
// Word emit <span style="font-weight:700"> / <span style="font-style:italic">
// where a rendered page would use <strong>/<em>, so without this every bold and
// italic word is lost the moment such a document is pasted in.
function inlineEmphasisTags(element: HTMLElement): string[] {
  const tags: string[] = [];
  const weight = element.style.fontWeight;
  if (weight === "bold" || weight === "bolder" || Number(weight) >= 600) {
    tags.push("strong");
  }
  const style = element.style.fontStyle;
  if (style === "italic" || style === "oblique") {
    tags.push("em");
  }
  return tags;
}

function wrapWith(tags: string[], content: string): string {
  return tags.reduce((inner, tag) => `<${tag}>${inner}</${tag}>`, content);
}

// Google Docs wraps a whole copied selection in
// `<b style="font-weight:normal" id="docs-internal-guid-…">`. The inline style is
// the truth there, not the tag — otherwise a pasted Docs document arrives with
// every word in bold.
function emphasisIsCancelled(element: HTMLElement, tag: string): boolean {
  if (tag === "strong") {
    const weight = element.style.fontWeight;
    return !!weight && (weight === "normal" || Number(weight) < 600);
  }
  if (tag === "em") {
    return element.style.fontStyle === "normal";
  }
  return false;
}

// An <ol start> worth keeping: a whole number above 1 (1 is the default) and
// small enough to be a real list position rather than junk from a paste.
function normalizeListStart(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const start = Number.parseInt(value, 10);
  return Number.isFinite(start) && start > 1 && start <= 1_000_000 ? start : null;
}

// Docs and Word wrap each item's text in a paragraph of its own. That paragraph
// is unwrapped when it is the item's only one, so a pasted list reads as a list of
// lines rather than of stacked paragraphs — while an item that genuinely holds
// several paragraphs keeps them.
function sanitizeListItem(li: HTMLElement): string {
  const paragraphs = Array.from(li.children).filter(
    (child) => child.tagName.toLowerCase() === "p",
  );
  const lone = paragraphs.length === 1 ? paragraphs[0] : null;
  const parts = Array.from(li.childNodes).map((child) =>
    child === lone
      ? Array.from(child.childNodes).map(sanitizeNode).join("")
      : sanitizeNode(child),
  );
  return stripTrailingBr(parts.join(""));
}

/**
 * Lists get their own pass because both sources of list markup are structurally
 * broken in the same way: `document.execCommand("indent")` and pasted HTML put a
 * sub-list *next to* the item it belongs to (`<ul><li>a</li><ul>…</ul></ul>`)
 * instead of inside it, and browsers leave loose text between items after edits.
 * Everything that is not an <li> is folded into the item above it, so the stored
 * markup is always a valid `<li><ul>…</ul></li>` tree that renders at the right
 * depth. An <ol start> survives, so a list that carries on counting keeps its
 * numbers.
 */
function sanitizeList(element: HTMLElement, tag: "ul" | "ol"): string {
  const items: string[] = [];

  const appendToLastItem = (html: string) => {
    if (!html) {
      return;
    }
    if (items.length === 0) {
      items.push(html);
    } else {
      items[items.length - 1] += html;
    }
  };

  for (const child of Array.from(element.childNodes)) {
    // Formatting whitespace between items is not content; appended to an item it
    // would show up as a stray space (or, before the first item, as a bullet).
    if (child.nodeType === Node.TEXT_NODE && !(child.textContent ?? "").trim()) {
      continue;
    }
    if (
      child.nodeType === Node.ELEMENT_NODE &&
      (child as HTMLElement).tagName.toLowerCase() === "li"
    ) {
      const inner = sanitizeListItem(child as HTMLElement);
      // A truly empty item is leftover noise; `<li><br></li>` is an item the
      // writer is typing into, and stripTrailingBr keeps that <br> in place.
      if (inner) {
        items.push(inner);
      }
      continue;
    }
    appendToLastItem(sanitizeNode(child));
  }

  if (items.length === 0) {
    return "";
  }

  const start = tag === "ol" ? normalizeListStart(element.getAttribute("start")) : null;
  const opening = start ? `<ol start="${start}">` : `<${tag}>`;
  return `${opening}${items.map((item) => `<li>${item}</li>`).join("")}</${tag}>`;
}

// Fuse runs of adjacent same-type lists into one. The browser opens a brand-new
// list every time the toolbar is used on a neighbouring paragraph, and pasted
// "loose" Markdown arrives the same way — and an <ol> that follows an <ol>
// restarts at "1." and adds its own block margin, which is exactly how a pasted
// numbered list ended up reading as "1. 1. 1." with a gap between the items.
// A list with an explicit `start` is a deliberate restart, so it is left alone.
function mergeAdjacentLists(html: string): string {
  return html.replace(/<\/ul>\s*<ul>/g, "").replace(/<\/ol>\s*<ol>/g, "");
}

function sanitizeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeHtml(stripZeroWidth(node.textContent || ""));
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node as HTMLElement;
  let tag = element.tagName.toLowerCase();

  // Convert browser-generated aliases to semantic tags
  if (tag in tagAliases) {
    tag = tagAliases[tag];
  }

  // Convert styled <span> to semantic tags
  if (tag === "span") {
    const content = Array.from(element.childNodes).map(sanitizeNode).join("");
    if (!content) {
      return "";
    }
    const emphasised = wrapWith(inlineEmphasisTags(element), content);
    return element.style.backgroundColor ? `<mark>${emphasised}</mark>` : emphasised;
  }

  // A <b>/<i> whose inline style cancels the emphasis is a wrapper, not a mark.
  if (emphasisIsCancelled(element, tag)) {
    return Array.from(element.childNodes).map(sanitizeNode).join("");
  }

  // Convert <div> to <p> (browsers sometimes insert divs)
  // Only wrap in <p> if the div contains only inline content
  if (tag === "div") {
    const content = Array.from(element.childNodes).map(sanitizeNode).join("");
    // An empty <div> (or one holding only a filler <br>) is browser noise from
    // focus/click — drop it so it never becomes a stray blank line. A deliberate
    // blank line is a <p><br></p>, handled in the paragraph branch below.
    if (htmlIsBlank(content)) return "";
    // If content already contains block-level tags, don't wrap in <p>
    if (/<(?:p|h2|ul|ol|li|blockquote|figure|iframe)[\s>]/i.test(content)) {
      return content;
    }
    return `<p>${content}</p>`;
  }

  if (!allowedTags.has(tag)) {
    return Array.from(element.childNodes).map(sanitizeNode).join("");
  }

  if (tag === "br") {
    return "<br>";
  }

  if (tag === "hr") {
    return "<hr>";
  }

  if (tag === "img") {
    const src = element.getAttribute("src");
    const alt = element.getAttribute("alt") || "";

    if (!src) {
      return "";
    }

    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">`;
  }

  if (tag === "iframe") {
    const src = element.getAttribute("src") || "";

    if (!youtubeEmbedPattern.test(src)) {
      return "";
    }

    return `<iframe src="${escapeHtml(src)}" frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>`;
  }

  if (tag === "a") {
    const href = element.getAttribute("href");

    if (!href || !/^https?:\/\//i.test(href)) {
      return Array.from(element.childNodes).map(sanitizeNode).join("");
    }

    const content = Array.from(element.childNodes).map(sanitizeNode).join("");
    return `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${content}</a>`;
  }

  if (tag === "details") {
    let summaryHtml = "";
    let bodyHtml = "";
    for (const child of Array.from(element.childNodes)) {
      const isSummary =
        child.nodeType === Node.ELEMENT_NODE &&
        (child as HTMLElement).tagName.toLowerCase() === "summary";
      const out = sanitizeNode(child);
      if (isSummary) {
        summaryHtml += out;
      } else {
        bodyHtml += out;
      }
    }
    if (!summaryHtml && !bodyHtml) {
      return "";
    }
    // A spoiler must always keep a title and at least one body line: the editor
    // relies on both surviving normalisation so the caret has somewhere to land
    // and the block can't be silently hollowed out into an uneditable shell.
    if (!summaryHtml) {
      summaryHtml = "<summary></summary>";
    }
    bodyHtml = stripTrailingBr(bodyHtml);
    if (!bodyHtml) {
      bodyHtml = "<p><br></p>";
    }
    // Keep spoilers expanded inside the editor so their body stays editable in
    // contentEditable. The stored/rendered value runs through DOMPurify, which
    // drops the (non-allowlisted) `open` attribute, so readers see it collapsed.
    return `<details open>${summaryHtml}${bodyHtml}</details>`;
  }

  if (tag === "ul" || tag === "ol") {
    return sanitizeList(element, tag);
  }

  let content = Array.from(element.childNodes).map(sanitizeNode).join("");

  // Drop the trailing filler <br> browsers append inside an edited block so it
  // doesn't survive normalisation as an empty line after the heading / item.
  if (TEXT_BLOCK_TAGS.has(tag)) {
    content = stripTrailingBr(content);
  }

  if (tag === "p") {
    // Only a <p><br></p> — what pressing Enter on an empty line produces — is a
    // deliberate blank line worth keeping. Any other empty-ish paragraph (truly
    // empty, only &nbsp;/whitespace) is noise the browser leaves behind on
    // focus/click, so drop it; otherwise clicking in and out of the editor keeps
    // sprinkling blank lines between the blocks.
    if (htmlIsBlank(content)) {
      return /<br\s*\/?>/i.test(content) ? "<p><br></p>" : "";
    }
    return `<p>${content}</p>`;
  }

  if (!content && !["figure"].includes(tag)) {
    return "";
  }

  return `<${tag}>${content}</${tag}>`;
}

const ALLOWED_TAGS = [
  "a",
  "blockquote",
  "br",
  "code",
  "details",
  "em",
  "figure",
  "figcaption",
  "h2",
  "h3",
  "h4",
  "hr",
  "iframe",
  "img",
  "li",
  "mark",
  "ol",
  "p",
  "strong",
  "summary",
  "ul",
];

// Clamp heading levels onto the body's supported <h2>–<h4> outline. Mirrors the
// `tagAliases` map used by the DOM-walking editor normaliser so the string
// (server / render / paste) path keeps pasted headings as headings: <h1>
// demotes to <h2> (the body's top section level, one step under the page <h1>),
// and <h5>/<h6> promote to the deepest supported level, <h4>. <h2>–<h4> pass
// through untouched.
function normalizeHeadingLevels(html: string): string {
  return html
    .replace(/<(\/?)h1(\b[^>]*)>/gi, "<$1h2$2>")
    .replace(/<(\/?)(?:h5|h6)(\b[^>]*)>/gi, "<$1h4$2>");
}

const ALLOWED_ATTR = [
  "href",
  "src",
  "alt",
  "target",
  "rel",
  "frameborder",
  "allowfullscreen",
  "allow",
  // <ol start>: a numbered list that continues an earlier one keeps its numbers
  // instead of resetting to 1. Inert everywhere else, so a global allow is fine.
  "start",
];

// Only http(s) links and inline image data URLs survive; javascript:, vbscript:,
// data:text/html, mailto:, tel: and relative URLs are stripped from href/src.
const ALLOWED_URI_REGEXP = /^(?:https?:\/\/|data:image\/)/i;

let domPurifyHooksReady = false;

function ensureDomPurifyHooks() {
  if (domPurifyHooksReady) {
    return;
  }

  // Keep only YouTube embed iframes; drop every other iframe entirely. DOMPurify
  // already removes scripts, inline event handlers and dangerous URL schemes.
  DOMPurify.addHook("uponSanitizeElement", (node, data) => {
    if (data.tagName !== "iframe") {
      return;
    }
    const element = node as Element;
    const src = element.getAttribute?.("src") ?? "";
    if (!youtubeEmbedPattern.test(src)) {
      element.parentNode?.removeChild(element);
    }
  });

  // Force safe link behaviour on any surviving anchor that still has an href.
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    const element = node as Element;
    if (element.tagName === "A" && element.getAttribute("href")) {
      element.setAttribute("target", "_blank");
      element.setAttribute("rel", "noreferrer");
    }
    // `start` is allowed for the sake of <ol> alone, and only as a list position:
    // it is exempt from the URL check (ADD_URI_SAFE_ATTR), so its value is
    // validated here instead — and dropped from every other element.
    if (element.hasAttribute?.("start")) {
      const start =
        element.tagName === "OL"
          ? normalizeListStart(element.getAttribute("start"))
          : null;
      if (start) {
        element.setAttribute("start", String(start));
      } else {
        element.removeAttribute("start");
      }
    }
  });

  domPurifyHooksReady = true;
}

/**
 * Hardened HTML sanitizer for stored and rendered rich text. Backed by DOMPurify so it
 * behaves identically at write-time, during SSR and on the client — closing the bypasses
 * the previous hand-rolled regex pass allowed (e.g. `<img/src=x/onerror=…>` and unquoted
 * `href=javascript:`). The allowlist mirrors the tags the editor can produce.
 */
function sanitizeWithDomPurify(html: string): string {
  ensureDomPurifyHooks();
  const clean = DOMPurify.sanitize(normalizeHeadingLevels(html), {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
    // Every allowed attribute whose value is not a URL has to be listed here:
    // DOMPurify runs ALLOWED_URI_REGEXP over any attribute that is not URI-safe
    // and drops the ones that fail, which is what silently ate <ol start="4">.
    // The value itself is validated in the afterSanitizeAttributes hook.
    ADD_URI_SAFE_ATTR: ["start"],
    ALLOW_DATA_ATTR: false,
  });
  // Runs on the stored/rendered path too, so bodies saved before the editor
  // learned to merge lists (one <ol> per item, every item numbered "1.") read
  // correctly without a content migration.
  return mergeAdjacentLists(clean);
}

export function sanitizeRichTextHtml(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  // Pure plain text (no markup) gets paragraph formatting; identical on server & client.
  if (!/[<>&]/.test(trimmed)) {
    return normalizePlainTextToHtml(trimmed);
  }

  return sanitizeWithDomPurify(trimmed);
}

// Elements whose text content must be left alone when linkifying mentions:
// an <a> would nest anchors, and code/pre carry literal text (a decorator or a
// shell handle is not a mention).
const MENTION_SKIP_TAGS = new Set(["a", "code", "pre"]);

/**
 * Turns `@username` tokens in already-sanitized rich text into profile links.
 *
 * Mentions are stored as plain text inside the body — the editor has no mention
 * node — so the notification pipeline sees them (`persistMentionsFromText`) but
 * the reader got dead text. This runs at render time, over the sanitized HTML,
 * so no stored content changes and no migration is needed.
 *
 * Splits on tags rather than parsing: DOMPurify has already normalized the
 * markup, and a DOM round-trip here would pull jsdom into every server render.
 * Text inside `<a>`, `<code>` and `<pre>` is skipped, so links keep their label
 * and code samples keep `@decorator` verbatim.
 *
 * `profileHrefPrefix` should carry the active locale (e.g. `/uk/u/`) so the link
 * does not bounce through the locale redirect. The username charset is fixed by
 * `MENTION_REGEX` (letters, digits, dot, underscore, dash), so it needs no
 * escaping to be safe in an attribute or in text.
 */
export function linkifyMentionsInHtml(
  html: string,
  profileHrefPrefix: string,
): string {
  if (!html || !html.includes("@")) {
    return html;
  }

  const parts = html.split(/(<[^>]*>)/);
  let skipDepth = 0;

  return parts
    .map((part) => {
      if (part.startsWith("<")) {
        const match = /^<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)/.exec(part);
        const tag = match?.[2]?.toLowerCase();

        if (tag && MENTION_SKIP_TAGS.has(tag)) {
          if (match?.[1] === "/") {
            skipDepth = Math.max(0, skipDepth - 1);
          } else if (!/\/\s*>$/.test(part)) {
            skipDepth += 1;
          }
        }

        return part;
      }

      if (skipDepth > 0 || !part.includes("@")) {
        return part;
      }

      return part.replace(
        MENTION_REGEX,
        (_full, username: string) =>
          `<a href="${profileHrefPrefix}${username}" data-link-preview="" class="rich-text-mention">@${username}</a>`,
      );
    })
    .join("");
}

// Top-level block elements the editor produces. Anything else at the root is
// inline content that must be wrapped in a paragraph for consistent spacing.
const TOP_LEVEL_BLOCKS = new Set([
  "p",
  // <div> isn't in the allowlist, but browsers emit it for lines; sanitizeNode
  // turns it into a <p>, so treat it as a block separator rather than buffering
  // it as inline (which would nest paragraphs).
  "div",
  // All heading levels count as blocks: the editor produces <h2>, but pasted or
  // legacy content may carry other levels. sanitizeNode aliases them onto <h2>,
  // but this check runs on the raw tag, so it must recognise every level or a
  // pasted <h1>/<h3> would be buffered as inline and wrapped in a stray <p>.
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "ul",
  "ol",
  "figure",
  "details",
  "hr",
]);

// Put a stray top-level <li> back into a list so it keeps its marker instead of
// being wrapped in a paragraph. The item is cloned, so the live editor DOM the
// normaliser reads is never mutated behind the writer's back.
function wrapOrphanListItem(li: HTMLElement): HTMLElement {
  const list = li.ownerDocument.createElement("ul");
  list.appendChild(li.cloneNode(true));
  return list;
}

// Rebuild the root into a clean block structure. Each run of inline nodes (and
// the lines a stray top-level <br> splits them into) becomes its own <p>, so
// every line carries the same paragraph spacing instead of a mix of bare text,
// <div> and <br> — that mix is what produced the uneven gaps between lines.
// Empty lines are preserved as <p><br></p>.
function normalizeTopLevelNodes(nodes: Node[]): string {
  // Drop trailing filler <br> (and blank text) at the root: contentEditable
  // leaves a bare <br> after the last block, which would otherwise become a
  // spurious empty <p><br></p> line every time the editor blurs. A deliberate
  // blank line the user typed is a <p><br></p> block, so it is untouched here.
  const roots = [...nodes];
  while (roots.length > 0) {
    const last = roots[roots.length - 1];
    const isBr =
      last.nodeType === Node.ELEMENT_NODE &&
      (last as HTMLElement).tagName.toLowerCase() === "br";
    const isBlankText =
      last.nodeType === Node.TEXT_NODE && !(last.textContent ?? "").trim();
    if (isBr || isBlankText) {
      roots.pop();
    } else {
      break;
    }
  }

  let html = "";
  let buffer: Node[] = [];

  const flushParagraph = (): boolean => {
    if (buffer.length === 0) return false;
    const inner = buffer.map(sanitizeNode).join("");
    buffer = [];
    const meaningful = inner
      .replace(/<br\s*\/?>/gi, "")
      .replace(/&nbsp;/gi, "")
      .replace(/\s+/g, "");
    if (!meaningful) {
      return false;
    }
    // An inline *wrapper* can sanitise down to block markup — Google Docs puts
    // the whole copied selection inside one <b style="font-weight:normal">, so
    // the run holds the entire document. Wrapping that in a paragraph would nest
    // blocks inside a <p>, which the HTML parser then tears apart again.
    if (/<(?:p|h[2-4]|ul|ol|li|blockquote|figure|iframe|hr|details)[\s>]/i.test(inner)) {
      html += inner;
      return true;
    }
    html += `<p>${inner}</p>`;
    return true;
  };

  for (const node of roots) {
    const isElement = node.nodeType === Node.ELEMENT_NODE;
    const tag = isElement ? (node as HTMLElement).tagName.toLowerCase() : "";
    if (isElement && TOP_LEVEL_BLOCKS.has(tag)) {
      flushParagraph();
      html += sanitizeNode(node);
    } else if (isElement && tag === "li") {
      // An <li> that lost its list — copied from inside one, or left behind by a
      // browser edit. Give it a list of its own; the merge pass then fuses a run
      // of them back into a single list.
      flushParagraph();
      html += sanitizeNode(
        wrapOrphanListItem(node as HTMLElement),
      );
    } else if (isElement && tag === "br") {
      // A <br> between inline runs terminates the paragraph they belong to
      // (flushed here). A bare <br> sitting between block elements is browser
      // filler from focus/click — drop it instead of turning it into a blank
      // line, so only real <p><br></p> paragraphs carry blank-line spacing.
      flushParagraph();
    } else {
      buffer.push(node);
    }
  }
  flushParagraph();
  return html;
}

// True when the already-sanitised html carries real content. We only strip
// fully-empty paragraphs (<p><br></p>, <p>&nbsp;</p>, …); if anything else
// remains — visible text, media or a structural block — the document has
// content. A page of nothing but empty paragraphs collapses to "", so a
// freshly-focused-then-abandoned editor stays empty.
//
// NOTE: this is intentionally NOT an HTML-stripping sanitiser. The value never
// reaches an HTML sink — it is only measured for length to decide emptiness —
// so leaving non-empty-paragraph markup intact is correct, not a bypass.
function hasMeaningfulContent(html: string): boolean {
  const withoutEmptyParagraphs = html.replace(
    /<p>(?:<br\s*\/?>|&nbsp;|\s)*<\/p>/gi,
    "",
  );
  return withoutEmptyParagraphs.trim().length > 0;
}

/**
 * Editor-only normaliser for the contenteditable composer. Browsers emit non-semantic
 * markup (<div>, <b>, styled <span>); this rebuilds it into the semantic allowlist
 * (<p>, <strong>, <mark>, …) for a clean WYSIWYG value. Runs on the client only; if ever
 * invoked on the server it defers to the hardened DOMPurify sanitizer above.
 */
export function normalizeRichTextForEditor(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (!/[<>&]/.test(trimmed)) {
    return normalizePlainTextToHtml(trimmed);
  }

  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return sanitizeWithDomPurify(trimmed);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${trimmed}</div>`, "text/html");
  const root = doc.body.firstElementChild;

  if (!root) {
    return "";
  }

  const result = mergeAdjacentLists(
    normalizeTopLevelNodes(Array.from(root.childNodes)),
  ).trim();
  return hasMeaningfulContent(result) ? result : "";
}

/**
 * Rebuild a paste from whichever clipboard flavour carries the most structure,
 * as editor-ready HTML — or "" to leave the paste to the browser (a styled word,
 * a bare URL: anything that would only be harmed by being turned into blocks).
 *
 * The order is the whole point:
 *  1. HTML with real structural tags (<ol>/<ul>/<h2>/…) wins. That is a copy from
 *     Docs, Word, a chat answer or a rendered page, where the markup holds the
 *     list nesting and the inline emphasis — the plain-text flavour of the same
 *     selection has already lost both (a sub-item's `a.` marker is only text).
 *  2. Then Markdown source text. A .md file, a code editor or a "raw" view puts
 *     literal `## …` on BOTH flavours, but its HTML is only coloured <span>/<div>
 *     soup with no structural tags, so the text is what parses cleanly.
 *  3. Then HTML with weaker structure (several paragraphs).
 */
export function richTextFromClipboard(html: string, text: string): string {
  const fragment = html?.trim() ? extractClipboardHtmlFragment(html) : "";

  if (fragment && htmlFragmentHasStructuralBlocks(fragment)) {
    return normalizeRichTextForEditor(fragment);
  }
  if (text?.trim() && hasMarkdownSyntax(text)) {
    return normalizeRichTextForEditor(markdownToHtml(text));
  }
  if (fragment && htmlFragmentHasBlocks(fragment)) {
    return normalizeRichTextForEditor(fragment);
  }
  return "";
}

const youtubeUrlPatterns = [
  /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/,
];

export function extractYouTubeVideoId(url: string): string | null {
  for (const pattern of youtubeUrlPatterns) {
    const match = url.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

// The first structural problem in a body's <h2>–<h4> heading outline:
//  - "first": the body opens below <h2> (e.g. it starts with an <h3>), so the
//    section hierarchy has no top level to hang off the page <h1>.
//  - "skip": a heading dives more than one level deeper than the previous one
//    (e.g. <h2> straight to <h4>, skipping <h3>), which breaks the outline and
//    hurts accessibility / SEO. Jumping back up any number of levels is fine.
export type HeadingOrderIssue =
  | { kind: "first"; level: number; text: string }
  | { kind: "skip"; from: number; to: number; text: string };

/**
 * Inspect the heading outline of stored rich-text body HTML and return the first
 * ordering problem, or null when the outline is clean (or has no headings). Used
 * to warn authors before they save/publish an article with a broken hierarchy.
 */
export function findHeadingOrderIssue(html: string): HeadingOrderIssue | null {
  const headings: { level: number; text: string }[] = [];
  const pattern = /<h([2-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    // Strip inner tags until the string stops changing — a single pass can leave
    // a `<tag` behind when markup is nested/reconstructed (e.g. `<b<i>>`), which
    // is the "incomplete multi-character sanitization" pattern. The text is only
    // used to build a plain toast message, but stripping to a fixpoint keeps it
    // clean regardless of the input.
    const text = stripUntilStable(match[2], /<[^>]*>/g)
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    headings.push({ level: Number(match[1]), text });
  }

  if (headings.length === 0) {
    return null;
  }

  if (headings[0].level !== 2) {
    return { kind: "first", level: headings[0].level, text: headings[0].text };
  }

  let previous = headings[0].level;
  for (let i = 1; i < headings.length; i += 1) {
    const { level, text } = headings[i];
    if (level > previous + 1) {
      return { kind: "skip", from: previous, to: level, text };
    }
    previous = level;
  }

  return null;
}
