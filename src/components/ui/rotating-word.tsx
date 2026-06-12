"use client";

import { useEffect, useState } from "react";

type RotatingWordProps = {
  /** Words to cycle through. The first word renders on the server (LCP-safe). */
  words: readonly string[];
  className?: string;
};

/**
 * Highlights a single word in place and cross-fades through `words`.
 *
 * Every word is rendered into the DOM (so crawlers index every keyword in the
 * H1), but only the `data-active` word is visible — see the `.rotating-word`
 * rules in globals.css, which stack all words into one grid cell on their own
 * line so width never reflows the headline. Each word carries a trailing space,
 * so even if that stylesheet is stale/missing the words degrade to a readable
 * space-separated list instead of gluing into one run.
 *
 * Non-active words are `aria-hidden`, so screen readers announce only the
 * active phrase while crawlers still see them all. The first word renders during
 * SSR (LCP-safe, no hydration mismatch). Rotation starts after mount and is
 * skipped when the visitor prefers reduced motion — leaving the word static.
 */
export default function RotatingWord({ words, className }: RotatingWordProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (words.length <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const cycle = setInterval(() => {
      setIndex((current) => (current + 1) % words.length);
    }, 3000);

    return () => clearInterval(cycle);
  }, [words]);

  return (
    <span className={["rotating-word", className].filter(Boolean).join(" ")}>
      {words.map((word, wordIndex) => (
        <span
          key={word}
          data-active={wordIndex === index ? "true" : undefined}
          aria-hidden={wordIndex === index ? undefined : true}
        >
          {/* Trailing space: keeps words readable & separated if CSS is absent. */}
          {`${word} `}
        </span>
      ))}
    </span>
  );
}
