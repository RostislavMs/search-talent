import DOMPurify from "isomorphic-dompurify";

/**
 * README (GitHub-flavoured Markdown) → sanitized HTML.
 *
 * A synced repo's README is stored verbatim in `projects.github_readme` and used
 * to be printed inside a <pre>, so readers got the raw source: `## Tech Stack`,
 * pipe-tables and ``` fences instead of headings, tables and code blocks. This
 * renders it properly.
 *
 * Why not `lib/rich-text`'s `markdownToHtml`: that one targets the *editor's*
 * allowlist — no tables, no fenced code, headings clamped to <h2>–<h4> — which is
 * exactly the markup a README leans on. This module is the README's own dialect
 * (tables, fences, task lists, strikethrough, alerts, inline HTML) with its own
 * allowlist, and it resolves the relative links/images a README writes against
 * the repository root.
 *
 * Heading levels are shifted down by two: the card that renders this owns the
 * <h2>, so the README's `#` becomes an <h3> and the outline below the card stays
 * intact instead of a second <h1>/<h2> appearing mid-page.
 *
 * Everything the parser emits is escaped as it goes, and the whole result is run
 * through DOMPurify at the end — the parser is NOT the security boundary, the
 * sanitizer is (README content is third-party text from a GitHub repo).
 */

export type GithubReadmeContext = {
  /** `owner/repo` — the base for resolving relative links and images. */
  fullName: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Attribute values lifted out of the README's own inline HTML are already
// entity-encoded (`?a=1&amp;b=2`), so a blanket `&` → `&amp;` would double-encode
// them. Only a bare ampersand — one that does not open an entity — is escaped.
function escapeExistingMarkupAttribute(value: string): string {
  return value
    .replace(/&(?!(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#\d{1,7}|#[xX][0-9a-fA-F]{1,6});)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const ABSOLUTE_URL = /^(?:https?:\/\/|mailto:)/i;
const ANY_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/**
 * Turn a README URL into one that works outside the repository.
 *
 * A README is written relative to the repo root, so `docs/api.md` and
 * `assets/logo.png` are dead links on our page. Links resolve against the repo's
 * default branch on github.com (`/blob/HEAD/…`), images against raw.githubusercontent
 * (the only host that serves the file itself), and a bare `#anchor` against the
 * repo page. Anything with an unknown scheme (`javascript:`, `vbscript:`, …)
 * resolves to "" — the sanitizer would drop it anyway, but the caller then omits
 * the attribute entirely rather than emitting a broken one.
 */
export function resolveReadmeUrl(
  raw: string,
  fullName: string,
  kind: "image" | "link",
): string {
  // A destination may be written in angle brackets (`[docs](<my file.md>)`).
  const url = raw.trim().replace(/^<([\s\S]*)>$/, "$1").trim();

  if (!url) {
    return "";
  }
  if (ABSOLUTE_URL.test(url)) {
    return url;
  }
  if (url.startsWith("//")) {
    return `https:${url}`;
  }
  if (kind === "image" && /^data:image\//i.test(url)) {
    return url;
  }
  if (url.startsWith("#")) {
    return `https://github.com/${fullName}${url}`;
  }
  if (ANY_SCHEME.test(url)) {
    return "";
  }

  // Strip the path prefixes that only mean something inside a checkout.
  const path = url.replace(/^\/+/, "").replace(/^(?:\.{1,2}\/)+/, "");

  if (!path) {
    return "";
  }

  return kind === "image"
    ? `https://raw.githubusercontent.com/${fullName}/HEAD/${path}`
    : `https://github.com/${fullName}/blob/HEAD/${path}`;
}

// Rewrite the src/href of the README's own inline HTML (`<img src="logo.png">`,
// the centred header block every second README opens with) the same way the
// Markdown paths are rewritten, so relative assets survive. An opening <a> also
// gets the same link hardening the Markdown path applies — this module owns that
// guarantee rather than leaning on a globally registered DOMPurify hook.
function normalizeInlineHtml(html: string, ctx: GithubReadmeContext): string {
  const withUrls = html.replace(
    /\b(src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    (_match, attr: string, doubleQuoted, singleQuoted, bare) => {
      const value: string = doubleQuoted ?? singleQuoted ?? bare ?? "";
      const resolved = resolveReadmeUrl(
        value,
        ctx.fullName,
        attr.toLowerCase() === "src" ? "image" : "link",
      );
      return resolved
        ? `${attr}="${escapeExistingMarkupAttribute(resolved)}"`
        : `${attr}=""`;
    },
  );

  // The injected pair sits first, so it wins over any target/rel the README wrote
  // (a repeated attribute is ignored by the parser).
  return withUrls.replace(/<a(?=[\s>])/gi, `<a target="_blank" rel="noreferrer nofollow"`);
}

// Private-use sentinels park a finished fragment (a code span, a tag, a built
// link) while the remaining inline rules run, so nothing rewrites its contents
// and no digit-based placeholder can collide with real text.
const CODE_OPEN = String.fromCharCode(0xe010);
const CODE_CLOSE = String.fromCharCode(0xe011);
const RAW_OPEN = String.fromCharCode(0xe012);
const RAW_CLOSE = String.fromCharCode(0xe013);
const CODE_SENTINEL = new RegExp(`${CODE_OPEN}(\\d+)${CODE_CLOSE}`, "g");
const RAW_SENTINEL = new RegExp(`${RAW_OPEN}(\\d+)${RAW_CLOSE}`, "g");
// Restoring is iterative (a fragment can nest one), so it needs a ceiling. Real
// nesting is two levels deep — a linked badge; anything beyond this is malformed.
const MAX_RESTORE_PASSES = 8;

function anchorHtml(href: string, inner: string): string {
  return href
    ? `<a href="${href}" target="_blank" rel="noreferrer nofollow">${inner}</a>`
    : inner;
}

/** Fragments parked behind sentinels during one inline pass. */
type InlineStash = { codes: string[]; raws: string[] };

/**
 * Inline Markdown for a single block of text: code spans, images, links,
 * autolinks, bold / italic / strikethrough, and the README's own inline tags
 * (`<br>`, `<img>`, `<kbd>`, badge markup) which are passed through for the
 * sanitizer to validate. Everything that is not markup gets escaped.
 */
function inlineToHtml(
  text: string,
  ctx: GithubReadmeContext,
  // A link's label runs through this pass again (`[**bold** link](…)`, and the
  // `[![badge](img)](url)` shape every README opens with). The nested pass shares
  // the outer stash: with arrays of its own it would resolve the outer sentinels
  // against an empty list and blank the very image it was wrapping.
  stash?: InlineStash,
): string {
  const isNested = stash !== undefined;
  const { codes, raws } = stash ?? { codes: [], raws: [] };
  const stashRaw = (html: string) => {
    raws.push(html);
    return `${RAW_OPEN}${raws.length - 1}${RAW_CLOSE}`;
  };

  // Code spans first: their contents are literal, so no later rule may see them.
  let out = text.replace(/(`+)(?!`)([\s\S]+?)\1(?!`)/g, (_m, _fence, code: string) => {
    codes.push(code);
    return `${CODE_OPEN}${codes.length - 1}${CODE_CLOSE}`;
  });

  // `<https://example.com>` — an autolink, not a tag, so it is read before the
  // tag rule (whose tag-name shape would never match it anyway).
  out = out.replace(/<((?:https?:\/\/|mailto:)[^\s<>]+)>/gi, (_m, url: string) =>
    stashRaw(anchorHtml(escapeHtml(url), escapeHtml(url))),
  );

  out = out.replace(/<!--[\s\S]*?-->/g, "");
  // A real tag: `<name …>`, `</name>`, `<name/>`. The tag-name requirement keeps
  // prose like `a < b > c` out of it — that stays text and gets escaped below.
  out = out.replace(/<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]*)?\/?>/g, (tag) =>
    stashRaw(normalizeInlineHtml(tag, ctx)),
  );

  out = out.replace(
    /!\[([^\]]*)\]\(\s*(<[^>]*>|[^()\s]+)(?:\s+"[^"]*")?\s*\)/g,
    (_match, alt: string, src: string) => {
      const resolved = resolveReadmeUrl(src, ctx.fullName, "image");
      // A source we will not load (an unknown scheme, an empty target) leaves the
      // alt text behind rather than the raw `![…](…)` syntax.
      if (!resolved) {
        return alt;
      }
      return stashRaw(
        `<img src="${escapeHtml(resolved)}" alt="${escapeHtml(alt)}" loading="lazy">`,
      );
    },
  );

  out = out.replace(
    /\[([^\]]+)\]\(\s*(<[^>]*>|[^()\s]+)(?:\s+"[^"]*")?\s*\)/g,
    (_match, label: string, href: string) => {
      const resolved = resolveReadmeUrl(href, ctx.fullName, "link");
      // A target we will not link to (`javascript:`, …) keeps its label as text
      // instead of leaking the raw `[…](…)` syntax to the reader.
      if (!resolved) {
        return label;
      }
      return stashRaw(
        anchorHtml(escapeHtml(resolved), inlineToHtml(label, ctx, { codes, raws })),
      );
    },
  );

  out = escapeHtml(out);

  out = out
    .replace(/\*\*\*([^*\n]+)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^\w*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[\s(])__([^_\n]+)__/g, "$1<strong>$2</strong>")
    // Italic `_…_` only at a word boundary: snake_case identifiers and file names
    // (`GITHUB_TOKEN`, `my_file_name`) must not turn into emphasis.
    .replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s).,;:!?])/g, "$1<em>$2</em>")
    .replace(/~~([^~\n]+)~~/g, "<del>$1</del>");

  // Bare URLs, the way GitHub autolinks them. Safe to run here: every tag and
  // link built above is parked behind a sentinel, so there is no href to corrupt.
  out = out.replace(
    /(^|[\s(])(https?:\/\/[^\s<>()]*[^\s<>().,;:!?'"])/g,
    (_m, prefix: string, url: string) => `${prefix}${anchorHtml(url, url)}`,
  );

  // A nested (link-label) pass leaves the sentinels in place — the outer pass owns
  // the stash and restores every fragment once, at the end.
  if (isNested) {
    return out;
  }

  // Repeat until no sentinel is left: a restored fragment can hold one of its own
  // (the anchor of `[![badge](img)](url)` wraps the image's sentinel), and a
  // single replace pass never rescans what it just inserted.
  for (
    let pass = 0;
    pass < MAX_RESTORE_PASSES &&
    (out.includes(RAW_OPEN) || out.includes(CODE_OPEN));
    pass += 1
  ) {
    out = out
      .replace(
        CODE_SENTINEL,
        (_m, index: string) => `<code>${escapeHtml(codes[Number(index)] ?? "")}</code>`,
      )
      .replace(RAW_SENTINEL, (_m, index: string) => raws[Number(index)] ?? "");
  }
  return out;
}

const FENCE_PATTERN = /^(`{3,}|~{3,})\s*(.*)$/;
const ATX_HEADING_PATTERN = /^(#{1,6})\s+(.*?)\s*#*$/;
const THEMATIC_BREAK_PATTERN = /^(?:\s*-){3,}\s*$|^(?:\s*\*){3,}\s*$|^(?:\s*_){3,}\s*$/;
const BULLET_ITEM_PATTERN = /^([-*+])\s+(.*)$/;
const ORDERED_ITEM_PATTERN = /^(\d{1,9})[.)]\s+(.*)$/;
const TASK_ITEM_PATTERN = /^\[([ xX])\]\s+(.*)$/;
const ALERT_PATTERN = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i;
const INLINE_HTML_LINE_PATTERN = /^<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s|>|\/|$)/;

// One nesting step is two columns (a tab counts as four), and the styles only
// distinguish a handful of marker levels, so nesting stops at the fourth.
const LIST_NEST_INDENT = 2;
const MAX_LIST_DEPTH = 4;
// Blockquotes hold blocks of their own, which is the one recursive path here.
const MAX_QUOTE_DEPTH = 4;

type ListItem = { tag: "ul" | "ol"; value: number | null; content: string };
type OpenList = { tag: "ul" | "ol"; indent: number; itemOpen: boolean };

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

// `- [ ] todo` / `- [x] done`. There is no checkbox element in the allowlist (an
// interactive input inside read-only content would be a lie), so the state is
// kept as a ballot glyph — the same convention the editor's paste path uses.
function unwrapTaskMarker(content: string): string {
  const task = TASK_ITEM_PATTERN.exec(content);
  if (!task) {
    return content;
  }
  return `${task[1] === " " ? "☐" : "☑"} ${task[2]}`;
}

function matchListItem(line: string): ListItem | null {
  const bullet = BULLET_ITEM_PATTERN.exec(line);
  if (bullet) {
    return { tag: "ul", value: null, content: unwrapTaskMarker(bullet[2]) };
  }
  const ordered = ORDERED_ITEM_PATTERN.exec(line);
  if (!ordered) {
    return null;
  }
  return {
    tag: "ol",
    value: Number(ordered[1]),
    content: unwrapTaskMarker(ordered[2]),
  };
}

// A list that does not start at 1 keeps its own numbering.
function openListTag(item: ListItem): string {
  return item.tag === "ol" && item.value !== null && item.value > 1
    ? `<ol start="${item.value}">`
    : `<${item.tag}>`;
}

function splitTableRow(line: string): string[] {
  let row = line.trim();
  if (row.startsWith("|")) {
    row = row.slice(1);
  }
  if (row.endsWith("|") && !row.endsWith("\\|")) {
    row = row.slice(0, -1);
  }

  const cells: string[] = [];
  let current = "";
  for (let i = 0; i < row.length; i += 1) {
    // An escaped pipe is content, not a column break.
    if (row[i] === "\\" && row[i + 1] === "|") {
      current += "|";
      i += 1;
      continue;
    }
    if (row[i] === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += row[i];
  }
  cells.push(current.trim());
  return cells;
}

type CellAlign = "left" | "center" | "right" | null;

function isTableDelimiterRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("-") || !/^[|\s:-]+$/.test(trimmed)) {
    return false;
  }
  const cells = splitTableRow(trimmed);
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell));
}

function alignOf(cell: string): CellAlign {
  const left = cell.startsWith(":");
  const right = cell.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return null;
}

function cellHtml(
  tag: "th" | "td",
  content: string,
  align: CellAlign,
  ctx: GithubReadmeContext,
): string {
  const attr = align ? ` align="${align}"` : "";
  return `<${tag}${attr}>${inlineToHtml(content, ctx)}</${tag}>`;
}

function blocksToHtml(
  lines: string[],
  ctx: GithubReadmeContext,
  quoteDepth = 0,
): string {
  const html: string[] = [];
  const lists: OpenList[] = [];
  let paragraph: string[] = [];
  let blankSeen = false;
  let index = 0;

  const closeItem = () => {
    const list = lists[lists.length - 1];
    if (list?.itemOpen) {
      html.push("</li>");
      list.itemOpen = false;
    }
  };
  // Closing a sub-list leaves the parent's <li> open on purpose: that item wraps
  // the sub-list, so the next item (or the next pop) closes it.
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
      html.push(`<p>${inlineToHtml(paragraph.join(" "), ctx)}</p>`);
      paragraph = [];
    }
  };
  const flushAll = () => {
    flushParagraph();
    closeLists();
  };

  while (index < lines.length) {
    const rawLine = lines[index];
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      // A blank line does not end a list: "loose" lists (a blank line between
      // every item) are the norm in READMEs, and ending the list here would give
      // each item its own <ol> — every one of them numbered "1.".
      blankSeen = true;
      index += 1;
      continue;
    }
    const afterBlank = blankSeen;
    blankSeen = false;

    // ``` / ~~~ fenced code. Deliberately does not close an open list item, so a
    // fence indented under an item stays inside it.
    const fence = FENCE_PATTERN.exec(line);
    if (fence) {
      flushParagraph();
      const fenceChar = fence[1][0];
      const closing = new RegExp(`^\\${fenceChar}{${fence[1].length},}\\s*$`);
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !closing.test(lines[index].trim())) {
        body.push(lines[index]);
        index += 1;
      }
      // Step over the closing fence (absent at end of file).
      index += 1;
      html.push(`<pre><code>${escapeHtml(body.join("\n"))}</code></pre>`);
      continue;
    }

    if (/^<!--/.test(line)) {
      // An HTML comment carries the badge/anchor bookkeeping READMEs hide from
      // the reader; a multi-line one runs to its terminator.
      flushParagraph();
      while (index < lines.length && !lines[index].includes("-->")) {
        index += 1;
      }
      index += 1;
      continue;
    }

    // The README's own HTML, passed through a line at a time so the Markdown
    // between the tags (the `<details>` blocks READMEs wrap their long sections
    // in) still parses as Markdown. The sanitizer validates the result.
    if (INLINE_HTML_LINE_PATTERN.test(line)) {
      flushAll();
      html.push(normalizeInlineHtml(line, ctx));
      index += 1;
      continue;
    }

    // Setext heading: the underlined title style READMEs open with.
    if (paragraph.length > 0 && /^=+\s*$/.test(line)) {
      const text = paragraph.join(" ");
      paragraph = [];
      html.push(`<h3>${inlineToHtml(text, ctx)}</h3>`);
      index += 1;
      continue;
    }
    if (paragraph.length > 0 && /^-+\s*$/.test(line)) {
      const text = paragraph.join(" ");
      paragraph = [];
      html.push(`<h4>${inlineToHtml(text, ctx)}</h4>`);
      index += 1;
      continue;
    }

    if (THEMATIC_BREAK_PATTERN.test(line)) {
      flushAll();
      html.push("<hr>");
      index += 1;
      continue;
    }

    const heading = ATX_HEADING_PATTERN.exec(line);
    if (heading) {
      flushAll();
      // Shift by two: the card owns the <h2>, so `#` opens at <h3> and the page
      // outline keeps a single top level.
      const level = Math.min(heading[1].length + 2, 6);
      html.push(
        `<h${level}>${inlineToHtml(heading[2].trim(), ctx)}</h${level}>`,
      );
      index += 1;
      continue;
    }

    if (line.startsWith(">")) {
      flushAll();
      const quoted: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        quoted.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      if (quoteDepth >= MAX_QUOTE_DEPTH) {
        html.push(`<blockquote>${inlineToHtml(quoted.join(" "), ctx)}</blockquote>`);
        continue;
      }
      // GitHub alert (`> [!WARNING]`): the marker is a label, not content, so it
      // becomes the quote's heading line instead of literal `[!WARNING]` text.
      const alert = ALERT_PATTERN.exec(quoted[0] ?? "");
      const label = alert
        ? `<p><strong>${alert[1].toUpperCase()}</strong></p>`
        : "";
      const body = blocksToHtml(alert ? quoted.slice(1) : quoted, ctx, quoteDepth + 1);
      html.push(`<blockquote>${label}${body}</blockquote>`);
      continue;
    }

    // Pipe table — the header row is only a table if a delimiter row follows it.
    if (
      line.includes("|") &&
      index + 1 < lines.length &&
      isTableDelimiterRow(lines[index + 1])
    ) {
      flushAll();
      const header = splitTableRow(line);
      const aligns = splitTableRow(lines[index + 1]).map(alignOf);
      index += 2;

      const rows: string[][] = [];
      while (
        index < lines.length &&
        lines[index].trim() &&
        lines[index].includes("|")
      ) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }

      const headHtml = header
        .map((cell, cellIndex) => cellHtml("th", cell, aligns[cellIndex] ?? null, ctx))
        .join("");
      const bodyHtml = rows
        .map((row) => {
          // Pad short rows / drop overflowing cells so every row lines up with
          // the header — a ragged table is what breaks the column layout.
          const cells = Array.from(
            { length: header.length },
            (_unused, cellIndex) => row[cellIndex] ?? "",
          );
          return `<tr>${cells
            .map((cell, cellIndex) =>
              cellHtml("td", cell, aligns[cellIndex] ?? null, ctx),
            )
            .join("")}</tr>`;
        })
        .join("");

      html.push(
        `<table><thead><tr>${headHtml}</tr></thead>${
          bodyHtml ? `<tbody>${bodyHtml}</tbody>` : ""
        }</table>`,
      );
      continue;
    }

    const item = matchListItem(line);
    if (item) {
      flushParagraph();
      const indent = indentWidth(rawLine);
      // Step back out of every level the item is no longer indented into.
      while (lists.length > 1 && indent < lists[lists.length - 1].indent) {
        closeList();
      }
      const current = lists[lists.length - 1];
      const openLevel = () => {
        html.push(openListTag(item));
        lists.push({ tag: item.tag, indent, itemOpen: false });
      };

      if (!current) {
        openLevel();
      } else if (
        current.itemOpen &&
        indent >= current.indent + LIST_NEST_INDENT &&
        lists.length < MAX_LIST_DEPTH
      ) {
        openLevel();
      } else if (current.tag !== item.tag) {
        // Switching between bullets and numbers starts a new list at this level.
        closeList();
        openLevel();
      } else {
        closeItem();
      }

      html.push(`<li>${inlineToHtml(item.content, ctx)}`);
      lists[lists.length - 1].itemOpen = true;
      index += 1;
      continue;
    }

    // Indented (4-column) code block — only where a list is not already using
    // indentation to mean nesting, and only at the start of a block.
    if (
      lists.length === 0 &&
      paragraph.length === 0 &&
      indentWidth(rawLine) >= 4
    ) {
      const body: string[] = [];
      while (
        index < lines.length &&
        (!lines[index].trim() || indentWidth(lines[index]) >= 4)
      ) {
        body.push(lines[index].replace(/^(?: {4}|\t)/, ""));
        index += 1;
      }
      while (body.length > 0 && !body[body.length - 1].trim()) {
        body.pop();
      }
      html.push(`<pre><code>${escapeHtml(body.join("\n"))}</code></pre>`);
      continue;
    }

    // A plain line right below an open item continues that item (Markdown "lazy
    // continuation") instead of cutting the list in two around a paragraph.
    if (lists[lists.length - 1]?.itemOpen && !afterBlank) {
      html.push(` ${inlineToHtml(line, ctx)}`);
      index += 1;
      continue;
    }

    closeLists();
    paragraph.push(line);
    index += 1;
  }

  flushAll();
  return html.join("");
}

const ALLOWED_TAGS = [
  "a",
  "b",
  "blockquote",
  "br",
  "caption",
  "code",
  "dd",
  "del",
  "details",
  "div",
  "dl",
  "dt",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "kbd",
  "li",
  "ol",
  "p",
  "picture",
  "pre",
  "s",
  "samp",
  "source",
  "span",
  "strong",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul",
];

const ALLOWED_ATTR = [
  "align",
  "alt",
  "colspan",
  "height",
  "href",
  "loading",
  "rel",
  "rowspan",
  "src",
  "start",
  "target",
  "title",
  "width",
];

// Only http(s), mailto and inline images survive in href/src; javascript:,
// vbscript:, data:text/html and relative URLs are dropped.
const ALLOWED_URI_REGEXP = /^(?:https?:\/\/|mailto:|data:image\/)/i;

/**
 * Attributes whose value is not a URL. DOMPurify runs ALLOWED_URI_REGEXP over
 * every allowed attribute it does not already know to be URI-safe and drops the
 * ones that fail — without this list, `align="center"`, `colspan="2"` and
 * `loading="lazy"` would all be silently eaten.
 */
const URI_SAFE_ATTR = [
  "align",
  "colspan",
  "height",
  "loading",
  "rel",
  "rowspan",
  "start",
  "target",
  "width",
];

/**
 * Render a stored GitHub README as sanitized HTML, ready for
 * `dangerouslySetInnerHTML`. Returns "" for an empty/blank README.
 */
export function renderGithubReadme(
  markdown: string,
  ctx: GithubReadmeContext,
): string {
  const source = markdown.replace(/^﻿/, "").replace(/\r\n?/g, "\n");

  if (!source.trim()) {
    return "";
  }

  const html = blocksToHtml(source.split("\n"), ctx);

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
    ADD_URI_SAFE_ATTR: URI_SAFE_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
