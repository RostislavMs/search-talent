"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type UnsavedChangesGuard = {
  isWarningOpen: boolean;
  confirmLeave: () => void;
  cancelLeave: () => void;
};

/**
 * Warns the user before they navigate away with unsaved form changes.
 *
 * - Hooks the native `beforeunload` event so the browser shows its own warning
 *   when the tab is closed, refreshed, or sent to an external URL.
 * - Intercepts left-clicks on internal `<a>` elements (including Next.js
 *   `<Link>`) in the capture phase, opens a custom confirm dialog rendered by
 *   the consumer, and only navigates after the user confirms.
 *
 * The caller controls `isDirty` (true when there are unsaved changes) and
 * resets it before programmatic navigation triggered by a successful save —
 * otherwise the guard would also fire for that internal `router.push`.
 */
export function useUnsavedChangesGuard(isDirty: boolean): UnsavedChangesGuard {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const isDirtyRef = useRef(isDirty);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const handleClick = (event: MouseEvent) => {
      if (!isDirtyRef.current) return;
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const eventTarget = event.target as Element | null;
      if (!eventTarget) return;
      const anchor = eventTarget.closest(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const rawHref = anchor.getAttribute("href");
      if (!rawHref) return;
      if (
        rawHref.startsWith("#") ||
        rawHref.startsWith("mailto:") ||
        rawHref.startsWith("tel:") ||
        rawHref.startsWith("javascript:")
      ) {
        return;
      }

      const resolved = new URL(anchor.href, window.location.href);
      if (resolved.origin !== window.location.origin) {
        // External link — let the browser handle it (beforeunload still fires).
        return;
      }

      // Stay on the same in-page hash? Ignore.
      if (
        resolved.pathname === window.location.pathname &&
        resolved.search === window.location.search &&
        resolved.hash &&
        resolved.hash !== window.location.hash
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setPendingHref(resolved.pathname + resolved.search + resolved.hash);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  const confirmLeave = useCallback(() => {
    const href = pendingHref;
    if (!href) return;
    // Disable the guard so the upcoming router.push doesn't trigger a second
    // dialog if a stray click sneaks through.
    isDirtyRef.current = false;
    setPendingHref(null);
    router.push(href);
  }, [pendingHref, router]);

  const cancelLeave = useCallback(() => {
    setPendingHref(null);
  }, []);

  return {
    isWarningOpen: pendingHref !== null,
    confirmLeave,
    cancelLeave,
  };
}
