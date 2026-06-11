import DOMPurify from "isomorphic-dompurify";

const allowedTags = new Set([
  "a",
  "blockquote",
  "br",
  "code",
  "em",
  "figure",
  "figcaption",
  "h3",
  "iframe",
  "img",
  "li",
  "ol",
  "p",
  "strong",
  "ul",
]);

const tagAliases: Record<string, string> = {
  b: "strong",
  i: "em",
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
    return escapeHtml(node.textContent || "");
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

  const content = Array.from(element.childNodes).map(sanitizeNode).join("");

  if (!content && !["figure"].includes(tag)) {
    return "";
  }

  if (tag === "p") {
    const stripped = content
      .replace(/<br\s*\/?>/gi, "")
      .replace(/&nbsp;/gi, "")
      .replace(/\s+/g, "");
    if (!stripped) {
      return "";
    }
  }

  return `<${tag}>${content}</${tag}>`;
}

const ALLOWED_TAGS = [
  "a",
  "blockquote",
  "br",
  "code",
  "em",
  "figure",
  "figcaption",
  "h3",
  "iframe",
  "img",
  "li",
  "mark",
  "ol",
  "p",
  "strong",
  "ul",
];

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
  return DOMPurify.sanitize(html, {
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

  return Array.from(root.childNodes).map(sanitizeNode).join("").trim();
}

export function extractPlainTextFromRichText(value: string) {
  if (!value.trim()) {
    return "";
  }

  // Use the same regex-based approach on server and client so the rendered
  // preview text matches between SSR and hydration. The DOM-based path used
  // `textContent`, which concatenates block-level text without separators
  // (e.g. "<p>foo</p><p>bar</p>" became "foobar"), while the regex path
  // replaces each tag with a space ("foo bar"), causing hydration mismatches.
  const sanitized =
    typeof window === "undefined" ? value : sanitizeRichTextHtml(value);
  return sanitized.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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
