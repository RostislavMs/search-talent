import type { ReactNode } from "react";

/**
 * Hands an inline-SVG illustration a timeline to animate against.
 *
 * The drawings themselves only declare *what* moves (the `data-draw` /
 * `data-flow` / `data-sweep` hooks documented in globals.css); this wrapper is
 * what decides *when*, because a named view timeline has to be declared on an
 * element the SVG's own children can look up through.
 *
 * `load` is for art that is already on screen when the page opens — a scroll
 * timeline would report it as fully covered and skip straight to the finished
 * drawing, so the hero would never appear to draw at all.
 */
export default function Art({
  children,
  on = "scroll",
}: {
  children: ReactNode;
  /** Which clock drives the drawing. */
  on?: "scroll" | "load";
}) {
  return (
    <div
      className={`app-art flex h-full w-full items-center justify-center ${
        on === "load" ? "app-art--load" : "app-art--scroll"
      }`}
    >
      {children}
    </div>
  );
}
