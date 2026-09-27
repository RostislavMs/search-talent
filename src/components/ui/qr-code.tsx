"use client";

import { useMemo } from "react";
import { createQrMatrix, qrMatrixToPath } from "@/lib/qr";

// The standard quiet zone is four modules; scanners need it to find the code.
const QUIET_ZONE = 4;
// Rendered at this many pixels per module when downloaded as a PNG.
const PNG_MODULE_SIZE = 12;

// Black on white regardless of the site theme: many scanners cannot read an
// inverted (light-on-dark) code, so these colours are functional, not styling.
const DARK = "#000000";
const LIGHT = "#ffffff";

type QrCodeProps = {
  value: string;
  /** Accessible name, e.g. "QR code for searchtalent.dev/u/olena". */
  label: string;
  className?: string;
};

export default function QrCode({ value, label, className }: QrCodeProps) {
  const { size, path } = useMemo(() => {
    const matrix = createQrMatrix(value);
    return {
      size: matrix.length + QUIET_ZONE * 2,
      path: qrMatrixToPath(matrix, QUIET_ZONE),
    };
  }, [value]);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={size} height={size} fill={LIGHT} />
      <path d={path} fill={DARK} />
    </svg>
  );
}

/**
 * Saves the code as a PNG (more places accept a PNG than an SVG: CV builders,
 * slides, print shops). Drawn straight from the matrix onto a canvas, so the
 * file is sharp at any module size.
 */
export function downloadQrPng(value: string, fileName: string) {
  const matrix = createQrMatrix(value);
  const modules = matrix.length + QUIET_ZONE * 2;
  const canvas = document.createElement("canvas");
  canvas.width = modules * PNG_MODULE_SIZE;
  canvas.height = modules * PNG_MODULE_SIZE;

  const context = canvas.getContext("2d");

  if (!context) {
    return false;
  }

  context.fillStyle = LIGHT;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = DARK;

  matrix.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) {
        context.fillRect(
          (x + QUIET_ZONE) * PNG_MODULE_SIZE,
          (y + QUIET_ZONE) * PNG_MODULE_SIZE,
          PNG_MODULE_SIZE,
          PNG_MODULE_SIZE,
        );
      }
    });
  });

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = fileName;
  link.click();
  return true;
}
