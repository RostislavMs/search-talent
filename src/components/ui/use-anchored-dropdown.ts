"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";

/**
 * `useLayoutEffect` has no effect during server rendering and React warns
 * about it, but the positioning genuinely has to run before paint on the
 * client or the panel flashes at a stale position. Pick per environment.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Positions a dropdown panel against its trigger in viewport coordinates.
 *
 * The selects used to render their panel as `position: absolute` inside the
 * trigger's wrapper, which broke in two ways once a control sat low on the
 * page or inside a scrollable sidebar:
 *
 *  - A fixed `max-height` took no account of the space actually left below the
 *    trigger, so the panel ran past the bottom of the window and its last
 *    options were unreachable without scrolling the whole page.
 *  - An absolutely-positioned panel is clipped by any ancestor with
 *    `overflow: auto` — which is exactly what the filter sidebars need in
 *    order to scroll independently.
 *
 * Anchoring to the viewport (`position: fixed`) fixes both: the panel escapes
 * every ancestor's clipping, is capped to the room genuinely available, and
 * flips above the trigger when there is more space up there.
 */

/** Gap between the trigger and the panel. */
const GAP = 8;
/** Keep the panel off the very edge of the window. */
const VIEWPORT_MARGIN = 12;
/** The panel's natural height cap when there is plenty of room. */
const DESIRED_MAX_HEIGHT = 288;
/** Never collapse to an unusable sliver. */
const MIN_HEIGHT = 140;

export type AnchoredDropdownStyle = {
  position: "fixed";
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
};

export function useAnchoredDropdown(
  triggerRef: React.RefObject<HTMLElement | null>,
  isOpen: boolean,
): AnchoredDropdownStyle | undefined {
  const [style, setStyle] = useState<AnchoredDropdownStyle>();

  const reposition = useCallback(() => {
    const trigger = triggerRef.current;

    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const spaceBelow = viewportHeight - rect.bottom - GAP - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - GAP - VIEWPORT_MARGIN;

    // Prefer opening downward; flip only when below is cramped *and* above is
    // genuinely roomier, so the panel does not jitter between sides.
    const openUp = spaceBelow < DESIRED_MAX_HEIGHT && spaceAbove > spaceBelow;
    const available = openUp ? spaceAbove : spaceBelow;

    const maxHeight = Math.min(
      Math.max(Math.min(DESIRED_MAX_HEIGHT, available), MIN_HEIGHT),
      viewportHeight - 2 * VIEWPORT_MARGIN,
    );

    // Keep the panel inside the window horizontally even when the trigger sits
    // hard against an edge.
    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(rect.left, viewportWidth - rect.width - VIEWPORT_MARGIN),
    );

    setStyle({
      position: "fixed",
      left,
      width: rect.width,
      maxHeight,
      ...(openUp
        ? { bottom: viewportHeight - rect.top + GAP }
        : { top: rect.bottom + GAP }),
    });
  }, [triggerRef]);

  // Before paint, so the panel never flashes at a stale position.
  useIsomorphicLayoutEffect(() => {
    if (isOpen) {
      reposition();
    }
  }, [isOpen, reposition]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // Capture phase so scrolling *any* ancestor (a sidebar, a modal body)
    // re-anchors the panel, not just the window.
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);

    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [isOpen, reposition]);

  return isOpen ? style : undefined;
}
