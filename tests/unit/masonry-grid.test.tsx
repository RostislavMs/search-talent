// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";

import MasonryGrid from "@/components/ui/masonry-grid";

/**
 * jsdom has no layout engine, so `offsetHeight` is always 0 and there is no
 * ResizeObserver. Both are stubbed here: heights come from a `data-h` attribute
 * on each card, read through the wrapper the grid puts around it.
 */
let observeCount = 0;

function stubLayout() {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement) {
      const own = this.getAttribute("data-h");
      if (own) return Number(own);
      const child = this.firstElementChild?.getAttribute("data-h");
      return child ? Number(child) : 0;
    },
  });

  observeCount = 0;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {
        observeCount += 1;
      }
      unobserve() {}
      disconnect() {}
    },
  );
}

function restoreLayout() {
  Reflect.deleteProperty(HTMLElement.prototype, "offsetHeight");
  vi.unstubAllGlobals();
}

function Cards({ heights }: { heights: number[] }) {
  return (
    <MasonryGrid className="grid-cols-1 md:grid-cols-3">
      {heights.map((height, index) => (
        <div key={index} data-h={height} data-testid={`card-${index}`}>
          card {index}
        </div>
      ))}
    </MasonryGrid>
  );
}

function wrappers(container: HTMLElement) {
  return Array.from(container.firstElementChild?.children ?? []) as HTMLElement[];
}

describe("MasonryGrid", () => {
  beforeEach(stubLayout);

  afterEach(() => {
    cleanup();
    restoreLayout();
  });

  it("spans each card over its own measured height instead of a shared row", () => {
    const { container } = render(<Cards heights={[400, 176, 248]} />);

    // gap 24 + rowUnit 8 → ceil((h + 24) / 8)
    expect(wrappers(container).map((node) => node.style.gridRowEnd)).toEqual([
      "span 53",
      "span 25",
      "span 34",
    ]);
  });

  it("moves the gutter into the spans once measured", () => {
    const { container } = render(<Cards heights={[400, 176]} />);
    const grid = container.firstElementChild as HTMLElement;

    expect(grid.style.display).toBe("grid");
    // align-items:start is what keeps a card at its content height — the reason
    // a text-only card no longer stretches to the tallest card in its row.
    expect(grid.style.alignItems).toBe("start");
    expect(grid.style.gridAutoRows).toBe("8px");
    expect(grid.style.columnGap).toBe("24px");
    // React writes a unitless 0 for the numeric style value.
    expect(grid.style.rowGap).toBe("0");
  });

  it("keeps DOM order, so reading and crawl order stay row-major", () => {
    const { container } = render(<Cards heights={[400, 176, 248]} />);

    expect(
      wrappers(container).map((node) => node.firstElementChild?.textContent),
    ).toEqual(["card 0", "card 1", "card 2"]);
  });

  it("observes every card so a late cover or reflow re-measures", () => {
    render(<Cards heights={[400, 176, 248]} />);

    expect(observeCount).toBe(3);
  });

  it("falls back to a plain top-aligned grid when heights are unmeasurable", () => {
    // Height 0 = no layout (SSR markup, hidden container). Cards must not all
    // collapse into a single 8px row.
    const { container } = render(<Cards heights={[0, 0]} />);
    const grid = container.firstElementChild as HTMLElement;

    expect(grid.style.gridAutoRows).toBe("auto");
    expect(grid.style.rowGap).toBe("24px");
    expect(grid.style.alignItems).toBe("start");
    expect(wrappers(container).every((node) => !node.style.gridRowEnd)).toBe(true);
  });

  it("renders without a ResizeObserver present", () => {
    vi.stubGlobal("ResizeObserver", undefined);

    const { container } = render(<Cards heights={[400, 176]} />);

    expect(wrappers(container)).toHaveLength(2);
    expect(wrappers(container)[0].style.gridRowEnd).toBe("span 53");
  });
});
