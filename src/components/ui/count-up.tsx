"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 1100;

type CountUpProps = {
  /** The real figure. Rendered as-is on the server. */
  value: number;
  /** Appended to the figure, inside the animated span (e.g. "+", "%"). */
  suffix?: string;
  className?: string;
};

/**
 * A figure that counts up the first time it scrolls into view.
 *
 * The finished value is what renders on the server, so the number is in the
 * HTML for crawlers and for anyone without JS, and the digits run inside a
 * `tabular-nums` span so the width never moves.
 *
 * It deliberately only animates figures that are *off screen* at mount: a
 * number already being read would have to jump back to zero before it could
 * run, which is worse than not animating at all. Reduced motion skips it
 * outright, and the assistive-tech copy is always the final value — a screen
 * reader should never be handed a half-finished count.
 */
export default function CountUp({ value, suffix = "", className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [displayed, setDisplayed] = useState(value);

  useEffect(() => {
    const node = ref.current;

    if (!node) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const box = node.getBoundingClientRect();
    const alreadyOnScreen = box.top < window.innerHeight && box.bottom > 0;

    if (alreadyOnScreen) return;

    setDisplayed(0);

    let frame = 0;
    let startedAt = 0;

    const run = (now: number) => {
      startedAt ||= now;

      const progress = Math.min(1, (now - startedAt) / DURATION_MS);
      // Ease-out cubic: quick off the mark, then slow enough at the end that
      // the last digits are legible rather than a blur.
      const eased = 1 - (1 - progress) ** 3;

      setDisplayed(Math.round(value * eased));

      if (progress < 1) {
        frame = requestAnimationFrame(run);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;

        observer.disconnect();
        frame = requestAnimationFrame(run);
      },
      { threshold: 0.4 },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return (
    <span ref={ref} className={className}>
      <span aria-hidden="true" className="tabular-nums">
        {displayed}
        {suffix}
      </span>
      <span className="sr-only">
        {value}
        {suffix}
      </span>
    </span>
  );
}
