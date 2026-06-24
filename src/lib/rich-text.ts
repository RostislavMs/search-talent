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
  "h3",
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
  // Collapse every heading level onto the single supported <h3>, so a heading
  // pasted from elsewhere (e.g. a Markdown preview emits <h1>/<h2>) stays a
  // heading instead of being flattened to plain paragraph text.
  h1: "h3",
  h2: "h3",
  h4: "h3",
  h5: "h3",
  h6: "h3",
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
    if (!content) return "";
    // If content already contains block-level tags, don't wrap in <p>
    if (/<(?:p|h3|ul|ol|li|blockquote|figure|iframe)[\s>]/i.test(content)) {
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
    if (!bodyHtml) {
      bodyHtml = "<p><br></p>";
    }
    // Keep spoilers expanded inside the editor so their body stays editable in
    // contentEditable. The stored/rendered value runs through DOMPurify, which
    // drops the (non-allowlisted) `open` attribute, so readers see it collapsed.
    return `<details open>${summaryHtml}${bodyHtml}</details>`;
  }

  const content = Array.from(element.childNodes).map(sanitizeNode).join("");

  if (!content && !["figure"].includes(tag)) {
    // An empty paragraph is a deliberate blank line — keep it as a clean
    // <p><br></p> instead of dropping it, so spacing the user added survives.
    return tag === "p" ? "<p><br></p>" : "";
  }

  if (tag === "p") {
    const stripped = content
      .replace(/<br\s*\/?>/gi, "")
      .replace(/&nbsp;/gi, "")
      .replace(/\s+/g, "");
    if (!stripped) {
      return "<p><br></p>";
    }
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
  "h3",
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

// Collapse unsupported heading levels onto the single supported <h3>. Mirrors
// the `tagAliases` map used by the DOM-walking editor normaliser so the string
// (server / render / paste) path keeps pasted <h1>/<h2> headings as headings.
function normalizeHeadingLevels(html: string): string {
  return html.replace(/<(\/?)(?:h1|h2|h4|h5|h6)(\b[^>]*)>/gi, "<$1h3$2>");
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
  "h3",
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

  for (const node of nodes) {
    const isElement = node.nodeType === Node.ELEMENT_NODE;
    const tag = isElement ? (node as HTMLElement).tagName.toLowerCase() : "";
    if (isElement && TOP_LEVEL_BLOCKS.has(tag)) {
      flushParagraph();
      html += sanitizeNode(node);
    } else if (isElement && tag === "br") {
      // A <br> directly at the root is a line break between paragraphs, not a
      // soft break inside one.
      if (!flushParagraph()) {
        html += "<p><br></p>";
      }
    } else {
      buffer.push(node);
    }
  }
  flushParagraph();
  return html;
}

// True when the html carries real content — visible text, or a structural /
// media block. A document that is only empty paragraphs collapses to nothing,
// so a freshly-focused-then-abandoned editor stays empty.
function hasMeaningfulContent(html: string): boolean {
  const text = stripZeroWidth(
    html.replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " "),
  ).trim();
  if (text) return true;
  return /<(?:img|iframe|figure|hr|details|ul|ol|blockquote|h3)\b/i.test(html);
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
