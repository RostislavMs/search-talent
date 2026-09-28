import { describe, expect, it } from "vitest";
import { createQrMatrix, createQrSvgMarkup, QR_QUIET_ZONE, qrMatrixToPath } from "@/lib/qr";

describe("createQrSvgMarkup", () => {
  it("draws the code on white with the quiet zone and an escaped label", () => {
    const text = "https://searchtalent.dev/u/olena?utm_source=resume&utm_medium=portfolio";
    const modules = createQrMatrix(text).length + QR_QUIET_ZONE * 2;
    const svg = createQrSvgMarkup(text, { size: 84, label: 'QR "portfolio" <x>' });

    expect(svg).toContain('width="84" height="84"');
    expect(svg).toContain(`viewBox="0 0 ${modules} ${modules}"`);
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toContain('aria-label="QR &quot;portfolio&quot; &lt;x&gt;"');
    expect(svg).not.toContain("<x>");
  });
});

/** The 7×7 finder pattern: dark ring, light ring, dark 3×3 centre. */
function hasFinderAt(matrix: boolean[][], top: number, left: number) {
  for (let row = 0; row < 7; row += 1) {
    for (let col = 0; col < 7; col += 1) {
      const onOuterRing = row === 0 || row === 6 || col === 0 || col === 6;
      const inCentre = row >= 2 && row <= 4 && col >= 2 && col <= 4;
      if (matrix[top + row][left + col] !== (onOuterRing || inCentre)) {
        return false;
      }
    }
  }
  return true;
}

describe("createQrMatrix", () => {
  it("builds a square code with the three finder patterns", () => {
    const matrix = createQrMatrix("https://searchtalent.dev/u/olena.koval");
    const size = matrix.length;

    // Versions grow in steps of four modules from 21.
    expect((size - 17) % 4).toBe(0);
    expect(matrix.every((row) => row.length === size)).toBe(true);
    expect(hasFinderAt(matrix, 0, 0)).toBe(true);
    expect(hasFinderAt(matrix, 0, size - 7)).toBe(true);
    expect(hasFinderAt(matrix, size - 7, 0)).toBe(true);
  });

  it("is deterministic and grows with longer text", () => {
    const short = createQrMatrix("https://searchtalent.dev/u/a");
    expect(createQrMatrix("https://searchtalent.dev/u/a")).toEqual(short);
    expect(createQrMatrix(`https://searchtalent.dev/u/${"x".repeat(120)}`).length).toBeGreaterThan(
      short.length,
    );
  });
});

describe("qrMatrixToPath", () => {
  it("merges horizontal runs and applies the margin", () => {
    const path = qrMatrixToPath(
      [
        [true, true, false],
        [false, true, true],
      ],
      4,
    );
    expect(path).toBe("M4 4h2v1h-2zM5 5h2v1h-2z");
  });

  it("is empty for an all-light matrix", () => {
    expect(qrMatrixToPath([[false, false]], 0)).toBe("");
  });
});
