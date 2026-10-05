// ---------------------------------------------------------------------------
// Colour maths for author-picked palettes: WCAG 2 contrast, sRGB mixing and an
// HSL constructor. Pure and dependency-free so the profile editor and the
// public profile compute exactly the same numbers.
// ---------------------------------------------------------------------------

type Rgb = [number, number, number];

/** "#abc" / "#aabbcc" → [r, g, b] in 0–255; anything unparsable is black. */
export function parseHexColor(hex: string): Rgb {
  const raw = hex.trim().replace(/^#/, "");
  const value =
    raw.length === 3
      ? raw
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : raw;
  const parsed = /^[0-9a-f]{6}$/i.test(value) ? Number.parseInt(value, 16) : 0;

  return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255];
}

export function toHexColor([r, g, b]: Rgb): string {
  return `#${[r, g, b]
    .map((channel) =>
      Math.round(Math.min(255, Math.max(0, channel)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** `amount` of `to` mixed into `from`, in sRGB (what CSS color-mix does by default). */
export function mixHexColors(from: string, to: string, amount: number): string {
  const a = parseHexColor(from);
  const b = parseHexColor(to);
  const t = Math.min(1, Math.max(0, amount));

  return toHexColor([
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]);
}

/** A translucent `color` laid over an opaque `backdrop`, as the eye sees it. */
export function compositeHexColor(color: string, alpha: number, backdrop: string) {
  return mixHexColors(backdrop, color, alpha);
}

function linearChannel(channel: number) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance, 0 (black) – 1 (white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHexColor(hex).map(linearChannel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1–21. */
export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);

  return (lighter + 0.05) / (darker + 0.05);
}

/** The lowest contrast `color` has against any of `backdrops` (21 when there are none). */
export function minContrast(color: string, backdrops: readonly string[]): number {
  return backdrops.reduce(
    (lowest, backdrop) => Math.min(lowest, contrastRatio(color, backdrop)),
    21,
  );
}

/** hue 0–360, saturation and lightness 0–100. */
export function hslToHex(hue: number, saturation: number, lightness: number): string {
  const h = (((hue % 360) + 360) % 360) / 360;
  const s = Math.min(100, Math.max(0, saturation)) / 100;
  const l = Math.min(100, Math.max(0, lightness)) / 100;

  if (s === 0) {
    return toHexColor([l * 255, l * 255, l * 255]);
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (offset: number) => {
    let t = h + offset;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  return toHexColor([channel(1 / 3) * 255, channel(0) * 255, channel(-1 / 3) * 255]);
}

/**
 * The nearest colour to `color` that `passes`, found by mixing it towards white
 * or black in 5% steps, so the hue survives as long as it can. When no mix
 * passes (the backdrops span light and dark), the mix with the best `score`
 * wins.
 */
export function adjustColorUntil(
  color: string,
  passes: (candidate: string) => boolean,
  score: (candidate: string) => number,
): string {
  if (passes(color)) {
    return color;
  }

  let best = color;
  let bestScore = score(color);

  for (let step = 1; step <= 20; step += 1) {
    const amount = step / 20;
    let passing: { candidate: string; score: number } | null = null;

    for (const target of ["#ffffff", "#000000"]) {
      const candidate = mixHexColors(color, target, amount);
      const candidateScore = score(candidate);
      if (passes(candidate) && (!passing || candidateScore > passing.score)) {
        passing = { candidate, score: candidateScore };
      }
      if (candidateScore > bestScore) {
        best = candidate;
        bestScore = candidateScore;
      }
    }

    if (passing) {
      return passing.candidate;
    }
  }

  return best;
}
