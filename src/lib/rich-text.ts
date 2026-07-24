import DOMPurify from "isomorphic-dompurify";

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

/**
 * Block-level Markdown → HTML for pasted plain-text drafts. Covers only what the
 * editor supports — headings (clamped to the <h2>–<h4> outline), blockquotes, bullet / ordered
 * lists, horizontal rules and blank-line paragraphs — plus inline marks. Raw HTML
 * lines (e.g. the <details> spoiler blocks the drafts use) pass through untouched.
 * This is NOT a security boundary: the result must be run through
 * sanitizeRichTextHtml / normalizeRichTextForEditor before it reaches any DOM.
 */
export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const html: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let paragraph: string[] = [];
  let quote: string[] = [];

  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
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
    closeList();
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushAll();
      continue;
    }
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
      closeList();
      quote.push(bq[1]);
      continue;
    }
    // A non-quote line ends any open blockquote.
    flushQuote();
    const ul = trimmed.match(/^[-*+]\s+(.*)$/);
    if (ul) {
      flushParagraph();
      if (listType !== "ul") {
        closeList();
        html.push("<ul>");
        listType = "ul";
      }
      html.push(`<li>${inlineMarkdownToHtml(ul[1])}</li>`);
      continue;
    }
    const ol = trimmed.match(/^\d+\.\s+(.*)$/);
    if (ol) {
      flushParagraph();
      if (listType !== "ol") {
        closeList();
        html.push("<ol>");
        listType = "ol";
      }
      html.push(`<li>${inlineMarkdownToHtml(ol[1])}</li>`);
      continue;
    }
    // Plain prose — accumulate into the current paragraph.
    closeList();
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
  if (/<(?:h[1-6]|ul|ol|blockquote|hr|pre|table|details)\b/i.test(fragment)) {
    return true;
  }
  return (fragment.match(/<p[\s>]/gi)?.length ?? 0) > 1;
}

const youtubeEmbedPattern = /^https:\/\/www\.youtube(?:-nocookie)?\.com\/embed\/[\w-]+$/;

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
    const bg = element.style.backgroundColor;
    if (bg) {
      const content = Array.from(element.childNodes).map(sanitizeNode).join("");
      return content ? `<mark>${content}</mark>` : "";
    }
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
  return DOMPurify.sanitize(normalizeHeadingLevels(html), {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
    ALLOW_DATA_ATTR: false,
  });
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
    if (meaningful) {
      html += `<p>${inner}</p>`;
      return true;
    }
    return false;
  };

  for (const node of roots) {
    const isElement = node.nodeType === Node.ELEMENT_NODE;
    const tag = isElement ? (node as HTMLElement).tagName.toLowerCase() : "";
    if (isElement && TOP_LEVEL_BLOCKS.has(tag)) {
      flushParagraph();
      html += sanitizeNode(node);
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

  const result = normalizeTopLevelNodes(Array.from(root.childNodes)).trim();
  return hasMeaningfulContent(result) ? result : "";
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
