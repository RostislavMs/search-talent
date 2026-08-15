import type { CSSProperties } from "react";

/**
 * Inline `--i`, the stagger index every rule in the motion kit reads
 * (`.app-enter`, `.app-cascade`, and the `.app-art` hooks — see globals.css).
 *
 * Scroll-driven animations have no clock to delay against: a row of cards all
 * cross the same scroll position, so ordering cannot come from
 * `animation-delay` and has to travel with the element instead.
 */
export function beat(index: number): CSSProperties {
  return { "--i": index } as CSSProperties;
}
