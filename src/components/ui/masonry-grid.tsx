"use client";

import {
  Children,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Pinterest-style card grid: every card keeps its own natural height and the
 * next one is pulled up into whichever column frees up first, instead of every
 * card in a row being stretched to the tallest one. A feed where some items
 * carry a cover image and some don't (article listings) otherwise leaves a tall
 * void under every text-only card.
 *
 * How it works: the grid gets tiny implicit rows (`rowUnit`) and each item is
 * given a `grid-row: span N` sized to its measured height, so CSS grid's
 * forward-only auto-placement produces the staggered layout. DOM order is
 * untouched — reading order, tab order and what crawlers see stay row-major.
 *
 * `align-items: start` is what makes it safe: every item is content-height, so
 * measuring it can never feed back into its own span, and a child with `h-full`
 * resolves to `auto` rather than stretching.
 *
 * Before measurement (SSR HTML, no-JS, first paint) it renders as a plain grid
 * of top-aligned, content-height cards — ragged bottoms, but never a stretched
 * card with an empty half. Spans are applied in a layout effect, so the switch
 * lands before the browser paints and revealing more cards never flashes.
 */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export default function MasonryGrid({
  children,
  className = "",
  gap = 24,
  rowUnit = 8,
}: {
  children: ReactNode;
  /**
   * Column setup only (e.g. `md:grid-cols-2 xl:grid-cols-3`). `display: grid`
   * and both gaps are set inline, so Tailwind `grid`/`gap-*` classes here would
   * be overridden — pass spacing through `gap` instead.
   */
  className?: string;
  /** Gutter in px, applied between columns and (via the spans) between rows. */
  gap?: number;
  /** Implicit row height in px — the granularity of the vertical gutter. */
  rowUnit?: number;
}) {
  const items = Children.toArray(children);
  const nodesRef = useRef<Array<HTMLDivElement | null>>([]);
  const [spans, setSpans] = useState<number[]>([]);

  useIsomorphicLayoutEffect(() => {
    const count = items.length;
    if (count === 0) {
      setSpans((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    // A zero height means the card can't be measured (a layout-less test
    // environment, or the grid is inside something hidden) — reported as span 0
    // so the whole grid stays on the plain fallback rather than collapsing every
    // card into one 8px row.
    const measure = () => {
      const next = nodesRef.current
        .slice(0, count)
        .map((node) =>
          node && node.offsetHeight > 0
            ? Math.ceil((node.offsetHeight + gap) / rowUnit)
            : 0,
        );
      setSpans((prev) =>
        prev.length === next.length && prev.every((value, i) => value === next[i])
          ? prev
          : next,
      );
    };

    // Re-measure on anything that changes a card's height: column count at a
    // breakpoint, a font swap, a late-loading cover, revealed batches.
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    if (observer) {
      for (const node of nodesRef.current.slice(0, count)) {
        if (node) observer.observe(node);
      }
    }

    // Synchronous first pass so the masonry layout is in place before paint.
    measure();

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [items.length, gap, rowUnit]);

  const measured =
    spans.length === items.length && spans.every((span) => span > 0);

  return (
    <div
      className={className}
      style={{
        display: "grid",
        alignItems: "start",
        columnGap: gap,
        // Once spans are known the gutter lives inside them, so the row gap has
        // to go or every card would sit a full gap lower than it should.
        rowGap: measured ? 0 : gap,
        gridAutoRows: measured ? `${rowUnit}px` : "auto",
      }}
    >
      {items.map((child, index) => (
        <div
          key={(child as { key?: string | null }).key ?? index}
          ref={(node) => {
            nodesRef.current[index] = node;
          }}
          style={measured ? { gridRowEnd: `span ${spans[index]}` } : undefined}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
