// Project descriptions and narrative fields are authored in plain-text
// textareas, but some values arrive wrapped in HTML (`<p>…</p>`, `<br>`) from
// pasted content or older data. Rendering those verbatim shows the literal
// tags. `toPlainText` strips the handful of formatting tags that actually
// appear — deliberately narrow so genuine text like "a < b" is left intact
// (a broad `/<[^>]*>/` regex would eat it).
const BLOCK_BOUNDARY = /<\/(?:p|div|li|h[1-6]|blockquote)>/gi;
const LINE_BREAK = /<br\s*\/?>/gi;
const FORMATTING_TAG =
  /<\/?(?:p|div|span|strong|em|b|i|u|s|ul|ol|li|a|h[1-6]|blockquote|figure|figcaption)(?:\s[^>]*)?>/gi;

export function toPlainText(input: string | null | undefined): string {
  if (!input) {
    return "";
  }

  return input
    .replace(BLOCK_BOUNDARY, " ")
    .replace(LINE_BREAK, " ")
    .replace(FORMATTING_TAG, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Same as `toPlainText`, but keeps the author's paragraphs: block ends and
 * `<br>` become line breaks, runs of spaces collapse, and at most one empty
 * line survives between paragraphs. Render it with `whitespace-pre-line`.
 */
export function toPlainTextWithBreaks(input: string | null | undefined): string {
  if (!input) {
    return "";
  }

  return input
    .replace(/\r\n?/g, "\n")
    .replace(BLOCK_BOUNDARY, "\n")
    .replace(LINE_BREAK, "\n")
    .replace(FORMATTING_TAG, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
