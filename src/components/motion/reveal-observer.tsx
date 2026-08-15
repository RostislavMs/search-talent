"use client";

import { useEffect } from "react";

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
 * animates over ~600ms regardless of how fast the reader is scrolling. That
 * needs an entry trigger, which is this file — one observer for the whole
 * document rather than a client boundary per section.
 *
 * Degradation is the reason the CSS holds no "before" state: an unrevealed
 * element is styled exactly like a finished one, and the animation is only
 * attached once `data-reveal="in"` lands. If this component never runs — JS
 * disabled, hydration error, an old browser — every section is simply present
 * and in place. Nothing to un-hide, so nothing can get stuck invisible.
 */
export default function RevealObserver() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    // Honoured here as well as in CSS: with no motion wanted there is no reason
    // to observe anything or to touch the DOM at all.
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (reducedMotion.matches) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          const target = entry.target as HTMLElement;
          target.dataset.reveal = "in";
          // One-shot. Re-animating on every pass turns a page into a flicker
          // reel when the reader scrolls back up.
          observer.unobserve(target);
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

    // The existing kit classes are the hooks, so nothing in the markup needs a
    // paired `data-` attribute; `:not([data-reveal])` keeps already-handled
    // elements out on every rescan.
    const scan = () => {
      for (const node of document.querySelectorAll<HTMLElement>(
        ".app-reveal:not([data-reveal]), .app-cascade > *:not([data-reveal])",
      )) {
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
