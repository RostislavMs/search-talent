// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";

import CountUp from "@/components/ui/count-up";

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

/**
 * Installs a fake IntersectionObserver and returns a trigger that fires it, so
 * a test can decide exactly when the figure "scrolls into view".
 */
function stubIntersectionObserver() {
  const callbacks: ObserverCallback[] = [];

  class FakeObserver {
    constructor(callback: ObserverCallback) {
      callbacks.push(callback);
    }
    observe() {}
    disconnect() {}
    unobserve() {}
  }

  vi.stubGlobal("IntersectionObserver", FakeObserver);

  return () => {
    for (const callback of callbacks) callback([{ isIntersecting: true }]);
  };
}

/** Puts the element off screen (or on it) for `getBoundingClientRect`. */
function stubViewportPosition({ onScreen }: { onScreen: boolean }) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    top: onScreen ? 100 : 5_000,
    bottom: onScreen ? 200 : 5_100,
    left: 0,
    right: 0,
    width: 0,
    height: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("CountUp", () => {
  it("renders the finished figure before any script runs", () => {
    // The server output is what crawlers and no-JS readers get, so it has to be
    // the real number — never a zero waiting to be animated.
    const { container } = render(<CountUp value={16} />);

    expect(container.textContent).toContain("16");
  });

  it("always exposes the finished figure to assistive tech", () => {
    stubReducedMotion(false);
    stubViewportPosition({ onScreen: false });
    const trigger = stubIntersectionObserver();

    render(<CountUp value={16} suffix="+" />);
    trigger();

    // The visible span is mid-count and aria-hidden; the sr-only copy is not.
    expect(screen.getByText("16+")).toHaveClass("sr-only");
  });

  it("leaves a figure that is already on screen alone", () => {
    // Zeroing a number the reader is looking at means it visibly jumps
    // backwards before it can run, which is worse than not animating.
    stubReducedMotion(false);
    stubViewportPosition({ onScreen: true });
    stubIntersectionObserver();

    const { container } = render(<CountUp value={16} />);

    expect(container.textContent).toContain("16");
    expect(container.textContent).not.toContain("0");
  });

  it("does not count when the reader asked for reduced motion", () => {
    stubReducedMotion(true);
    stubViewportPosition({ onScreen: false });
    const trigger = stubIntersectionObserver();

    const { container } = render(<CountUp value={16} />);
    trigger();

    expect(container.textContent).toContain("16");
  });

  it("starts from zero once an off-screen figure scrolls in", () => {
    stubReducedMotion(false);
    stubViewportPosition({ onScreen: false });
    const trigger = stubIntersectionObserver();

    const { container } = render(<CountUp value={16} />);
    trigger();

    // The count is driven by requestAnimationFrame, which jsdom never runs
    // here, so the figure stays at its starting value — enough to prove the
    // off-screen branch actually engages.
    expect(container.querySelector("[aria-hidden]")?.textContent).toBe("0");
  });
});
