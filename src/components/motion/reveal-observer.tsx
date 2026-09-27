"use client";

import { useEffect } from "react";

// Long and gentle on purpose. `cubic-bezier(0.16, 1, 0.3, 1)` is an expo-out
// curve: most of the distance is covered in the first third and the rest is a
// long settle, so the element never appears to start or stop abruptly. Paired
// with a short travel it reads as drifting into place rather than sliding.
const EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const DURATION_MS = 900;
/** A row of cards crosses the fold together, so order comes from a delay. */
const STAGGER_MS = 100;
/** Cards are the page's featured motion, so they travel further than shells. */
const CASCADE_TRAVEL = "26px";
const SECTION_TRAVEL = "20px";

function isCascadeChild(element: HTMLElement) {
  return element.parentElement?.classList.contains("app-cascade") ?? false;
}

/**
 * Movement only — deliberately no opacity or blur. A fade leaves every
 * not-yet-scrolled section at partial opacity, and contrast is computed against
 * the *blended* colour: axe read --brand-strong as #e19c4c (2.25:1) on the About
 * page, turning a passing page into 8 contrast failures. Transform is also
 * compositor-only, so it stays cheap.
 */
function reveal(element: HTMLElement) {
  const cascade = isCascadeChild(element);
  const style = getComputedStyle(element);
  const travel =
    style.getPropertyValue("--app-travel").trim() ||
    (cascade ? CASCADE_TRAVEL : SECTION_TRAVEL);
  // `--i` orders a cascade: set per child with `beat()` in lib/motion, or by
  // the `.app-cascade--auto` nth-child rules in globals.css.
  const index = cascade ? Number.parseFloat(style.getPropertyValue("--i")) || 0 : 0;

  element.animate(
    [{ transform: `translateY(${travel})` }, { transform: "none" }],
    {
      duration: DURATION_MS,
      easing: EASING,
      delay: index * STAGGER_MS,
      // Hold the start position through the stagger delay, then let go: once
      // it has landed the element is back to its own styles, so nothing keeps
      // a transform pinned on it (hover lifts use `translate`, which composes
      // either way).
      fill: "backwards",
    },
  );
}

/**
 * Drives the `.app-reveal` / `.app-cascade` entrances.
 *
 * These used to run on a pure CSS scroll timeline (`animation-timeline: view()`),
 * which was appealing — zero JS, fully server-rendered — but it cannot produce a
 * reveal the eye actually reads. A scroll-linked animation advances with the
 * scroll position, so while the wheel is moving the page at 1px per pixel the
 * element moves at 1.1px: an ~11% difference against everything around it.
 * Measured on the homepage it was 0.05–0.11px of travel per pixel of scroll, and
 * it registered as "the section is slightly springy", not as an entrance.
 *
 * A reveal reads when it runs on its own clock: the element enters, *then*
 * animates over ~900ms regardless of how fast the reader is scrolling. That
 * needs an entry trigger, which is this file — one observer for the whole
 * document rather than a client boundary per section.
 *
 * The animation runs through the Web Animations API and never touches the
 * element's attributes. It used to flip `data-reveal="in"` for a CSS rule to
 * pick up, but sections below the hero stream in behind Suspense and were often
 * marked before React hydrated them — a hydration mismatch on every card.
 *
 * Degradation is the reason there is no "before" state in CSS: an unrevealed
 * element is styled exactly like a finished one, and the movement only exists
 * while the animation runs. If this component never runs — JS disabled, a
 * hydration error, an old browser — every section is simply present and in
 * place. Nothing to un-hide, so nothing can get stuck invisible.
 */
export default function RevealObserver() {
  useEffect(() => {
    if (
      typeof IntersectionObserver === "undefined" ||
      typeof Element.prototype.animate !== "function"
    ) {
      return;
    }

    // With no motion wanted there is no reason to observe anything at all.
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (reducedMotion.matches) {
      return;
    }

    const handled = new WeakSet<Element>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          reveal(entry.target as HTMLElement);
          // One-shot. Re-animating on every pass turns a page into a flicker
          // reel when the reader scrolls back up.
          observer.unobserve(entry.target);
        }
      },
      {
        // Fire a little before the element's leading edge clears the fold, so
        // the movement happens while it is genuinely on screen rather than in
        // the bottom sliver where it goes unnoticed.
        rootMargin: "0px 0px -12% 0px",
        threshold: 0,
      },
    );

    // The kit classes are the hooks, so nothing in the markup needs a paired
    // attribute; the WeakSet keeps already-handled elements out on every rescan.
    const scan = () => {
      for (const node of document.querySelectorAll<HTMLElement>(
        ".app-reveal, .app-cascade > *",
      )) {
        if (handled.has(node)) {
          continue;
        }
        handled.add(node);
        observer.observe(node);
      }
    };

    scan();

    // Sections below the hero stream in behind Suspense, and the leaderboard
    // swaps its cards when the all-time/month toggle flips, so the set of
    // targets is not fixed at mount.
    const mutations = new MutationObserver(scan);

    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, []);

  return null;
}
