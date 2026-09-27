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
