import qrcode from "qrcode-generator";

export type QrMatrix = boolean[][];

/**
 * QR modules for a piece of text (a portfolio URL), generated locally with no
 * third-party service. Error correction "M" survives a smudged print while
 * keeping the code small for a typical profile link.
 */
export function createQrMatrix(text: string): QrMatrix {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();

  const size = qr.getModuleCount();
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => qr.isDark(row, col)),
  );
}

/**
 * One SVG path for all dark modules, with horizontal runs merged into single
 * rectangles so the markup stays small. Coordinates are in modules, offset by
 * the quiet-zone `margin`.
 */
export function qrMatrixToPath(matrix: QrMatrix, margin: number) {
  const parts: string[] = [];

  matrix.forEach((row, y) => {
    let x = 0;

    while (x < row.length) {
      if (!row[x]) {
        x += 1;
        continue;
      }

      const start = x;

      while (x < row.length && row[x]) {
        x += 1;
      }

      parts.push(`M${start + margin} ${y + margin}h${x - start}v1h-${x - start}z`);
    }
  });

  return parts.join("");
}

// The standard quiet zone is four modules; scanners need it to find the code.
export const QR_QUIET_ZONE = 4;

/**
 * A standalone SVG string of the code, black on white, for HTML built by hand
 * (the printable résumé). `label` becomes its accessible name and must be
 * plain text.
 */
export function createQrSvgMarkup(text: string, { size, label }: { size: number; label: string }) {
  const matrix = createQrMatrix(text);
  const modules = matrix.length + QR_QUIET_ZONE * 2;
  const safeLabel = label
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${modules} ${modules}" shape-rendering="crispEdges" role="img" aria-label="${safeLabel}">` +
    `<rect width="${modules}" height="${modules}" fill="#ffffff"/>` +
    `<path d="${qrMatrixToPath(matrix, QR_QUIET_ZONE)}" fill="#000000"/>` +
    `</svg>`
  );
}
