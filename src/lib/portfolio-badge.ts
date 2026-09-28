// ---------------------------------------------------------------------------
// The README badge (plan part 6): a small SVG in the shape people know from
// GitHub READMEs — "SearchTalent | 72/100" — linking to the portfolio. Pure, so
// the markup is unit-tested; app/api/badge/[username] serves it.
//
// The text is English only: a README is read by people of any language.
// ---------------------------------------------------------------------------

export const BADGE_LABEL = "SearchTalent";

const HEIGHT = 20;
const PADDING_X = 6;
const FONT_SIZE = 11;
const FONT_FAMILY = "Verdana,Geneva,DejaVu Sans,sans-serif";
const LABEL_COLOR = "#44403c";
const MESSAGE_COLOR = "#c2532e";
const MUTED_COLOR = "#78716c";

// Advance widths of Verdana, in em. The rendered text is stretched to the
// computed width (`textLength`), so a missing font or a rough value only
// changes the letter spacing a little, never breaks the layout.
const WIDTHS: Record<string, number> = {
  " ": 0.352, "/": 0.455, ".": 0.364, "-": 0.431, "_": 0.636, ":": 0.454,
  "0": 0.636, "1": 0.636, "2": 0.636, "3": 0.636, "4": 0.636,
  "5": 0.636, "6": 0.636, "7": 0.636, "8": 0.636, "9": 0.636,
  a: 0.601, b: 0.623, c: 0.521, d: 0.623, e: 0.596, f: 0.352, g: 0.623,
  h: 0.633, i: 0.274, j: 0.344, k: 0.592, l: 0.274, m: 0.973, n: 0.633,
  o: 0.607, p: 0.623, q: 0.623, r: 0.427, s: 0.521, t: 0.394, u: 0.633,
  v: 0.592, w: 0.818, x: 0.592, y: 0.592, z: 0.525,
  A: 0.684, B: 0.686, C: 0.698, D: 0.771, E: 0.632, F: 0.575, G: 0.775,
  H: 0.751, I: 0.421, J: 0.455, K: 0.693, L: 0.557, M: 0.843, N: 0.748,
  O: 0.787, P: 0.603, Q: 0.787, R: 0.695, S: 0.684, T: 0.616, U: 0.732,
  V: 0.684, W: 0.989, X: 0.685, Y: 0.615, Z: 0.685,
};
const DEFAULT_WIDTH = 0.62;

export function measureBadgeText(text: string): number {
  const em = [...text].reduce((sum, char) => sum + (WIDTHS[char] ?? DEFAULT_WIDTH), 0);
  return Math.round(em * FONT_SIZE * 10) / 10;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** What the right half says: the score, or just "portfolio" before one exists. */
export function getBadgeMessage(rating: number | null | undefined): string {
  if (typeof rating !== "number" || !Number.isFinite(rating)) {
    return "portfolio";
  }
  return `${Math.max(0, Math.min(100, Math.round(rating)))}/100`;
}

export function renderBadgeSvg({
  message,
  muted = false,
}: {
  message: string;
  /** Grey instead of the brand colour: the "not found" badge. */
  muted?: boolean;
}): string {
  const labelText = measureBadgeText(BADGE_LABEL);
  const messageText = measureBadgeText(message);
  const labelWidth = Math.round(labelText + PADDING_X * 2);
  const messageWidth = Math.round(messageText + PADDING_X * 2);
  const width = labelWidth + messageWidth;
  const title = escapeXml(`${BADGE_LABEL}: ${message}`);
  const safeMessage = escapeXml(message);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${HEIGHT}" viewBox="0 0 ${width} ${HEIGHT}" role="img" aria-label="${title}">`,
    `<title>${title}</title>`,
    `<clipPath id="r"><rect width="${width}" height="${HEIGHT}" rx="3" fill="#fff"/></clipPath>`,
    `<g clip-path="url(#r)">`,
    `<rect width="${labelWidth}" height="${HEIGHT}" fill="${LABEL_COLOR}"/>`,
    `<rect x="${labelWidth}" width="${messageWidth}" height="${HEIGHT}" fill="${muted ? MUTED_COLOR : MESSAGE_COLOR}"/>`,
    `</g>`,
    `<g fill="#fff" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="${FONT_SIZE}" text-rendering="geometricPrecision">`,
    `<text x="${labelWidth / 2}" y="14" textLength="${labelText}" lengthAdjust="spacingAndGlyphs">${BADGE_LABEL}</text>`,
    `<text x="${labelWidth + messageWidth / 2}" y="14" textLength="${messageText}" lengthAdjust="spacingAndGlyphs">${safeMessage}</text>`,
    `</g>`,
    `</svg>`,
  ].join("");
}

/** Markdown for a README: the badge, linking to the portfolio. */
export function buildBadgeMarkdown({
  badgeUrl,
  portfolioUrl,
}: {
  badgeUrl: string;
  portfolioUrl: string;
}): string {
  return `[![${BADGE_LABEL} portfolio](${badgeUrl})](${portfolioUrl})`;
}
