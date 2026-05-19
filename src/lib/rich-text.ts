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

  return `<${tag}>${content}</${tag}>`;
}

const allowedServerTagPattern = new RegExp(
  `</?(?:${[
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
  ].join("|")})(?:\\s[^<>]*)?>`,
  "gi",
);

const youtubeIframeSrcPattern =
  /src\s*=\s*("https:\/\/www\.youtube(?:-nocookie)?\.com\/embed\/[\w-]+"|'https:\/\/www\.youtube(?:-nocookie)?\.com\/embed\/[\w-]+')/i;

/**
 * Server-safe HTML sanitizer used during SSR or when DOMParser is unavailable.
 * Strips dangerous constructs (scripts, event handlers, javascript: URLs, unsafe
 * iframes, data: URLs) and removes any tag outside the allowlist. The client
 * sanitizer (sanitizeNode) runs the more rigorous pass after hydration.
 */
function sanitizeOnServer(value: string): string {
  let html = value;

  // Drop scripts/styles entirely (with content).
  html = html.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    "",
  );
  html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

  // Strip inline event handlers (onclick, onerror, etc.).
  html = html.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "");
  html = html.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");
  html = html.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "");

  // Neutralise javascript:/vbscript:/data: URLs (allow data:image/* for inline imgs).
  html = html.replace(/\b(?:href|src|formaction|action)\s*=\s*"javascript:[^"]*"/gi, "");
  html = html.replace(/\b(?:href|src|formaction|action)\s*=\s*'javascript:[^']*'/gi, "");
  html = html.replace(/\b(?:href|src|formaction|action)\s*=\s*"vbscript:[^"]*"/gi, "");
  html = html.replace(/\b(?:href|src|formaction|action)\s*=\s*"data:(?!image\/)[^"]*"/gi, "");

  // Allow only youtube embed iframes.
  html = html.replace(/<iframe\b([^>]*)>/gi, (match, attrs) =>
    youtubeIframeSrcPattern.test(attrs) ? match : "",
  );
  html = html.replace(/<\/iframe>/gi, (match) => match);

  // Remove any tag not in the server allowlist (keeps inner text).
  html = html.replace(/<\/?([a-zA-Z][\w-]*)(?:\s[^<>]*)?>/g, (match) =>
    allowedServerTagPattern.test(match) ? match : "",
  );
  allowedServerTagPattern.lastIndex = 0;

  return html.trim();
}

export function sanitizeRichTextHtml(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (typeof window === "undefined") {
    return sanitizeOnServer(trimmed);
  }

  if (!/[<>&]/.test(trimmed)) {
    return normalizePlainTextToHtml(trimmed);
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

  if (typeof window === "undefined") {
    return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(sanitizeRichTextHtml(value), "text/html");
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
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
