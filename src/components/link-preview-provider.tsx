"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import LinkPreviewCard, {
  LinkPreviewSkeleton,
} from "@/components/link-preview-card";
import { apiFetch } from "@/lib/api-client";
import {
  getLocaleFromPathname,
  stripLocaleFromPathname,
  type Locale,
} from "@/lib/i18n/config";
import {
  linkPreviewCacheKey,
  parseLinkPreviewHref,
  type LinkPreview,
} from "@/lib/link-preview";

/**
 * Hover previews for internal links.
 *
 * Mounted once in the app shell and driven by delegated document listeners
 * rather than per-link React components — article bodies are injected as HTML
 * (`RichTextRenderer` uses `dangerouslySetInnerHTML`), so their anchors are not
 * React elements and could not carry handlers of their own.
 *
 * Opt-in, never global: a link previews only when it carries
 * `data-link-preview` (see `ui/mention-text`) or sits inside a
 * `data-link-preview-scope` container (see `rich-text-renderer`). Cards in a
 * grid already show everything a preview would, so blanketing every anchor on
 * the site would be noise.
 *
 * The panel is informational and rendered with `pointer-events: none`, so it
 * can never swallow the click that belongs to the link underneath.
 */

export type LinkPreviewLabels = {
  loading: string;
};

/** Must match `w-80` on the card — the positioner needs the width up front. */
const CARD_WIDTH = 320;
/** Distance between the link and the panel. */
const GAP = 10;
/** Keep the panel off the very edge of the window. */
const VIEWPORT_MARGIN = 12;
/**
 * Room a card wants before we place it below the link. Cards vary in height
 * (a 16:9 cover adds ~180px), so this is a flip threshold, not a measurement —
 * the panel also gets a `max-height` for the space actually available.
 */
const ESTIMATED_HEIGHT = 240;
const MIN_PANEL_HEIGHT = 140;

/**
 * Touch devices get no previews at all. Filtering on `pointerType` covers the
 * hover path, but not focus: Chrome on Android focuses a link when it is tapped,
 * so a card would flash over the content on the way to the next page. Phrased as
 * an opt-out on a positively detected touch device, so an environment that
 * cannot answer the query keeps the feature rather than silently losing it.
 */
const TOUCH_ONLY_QUERY = "(hover: none)";

/** Long enough that skimming a paragraph of links opens nothing. */
const OPEN_DELAY_MS = 320;
/** Short grace period so a wobbling cursor does not flicker the card. */
const CLOSE_DELAY_MS = 140;
/** Keyboard users asked for the card explicitly by focusing the link. */
const FOCUS_OPEN_DELAY_MS = 120;

/**
 * Resolved previews live for the whole session: they are public, cheap, and
 * re-hovering the same @mention in a comment thread is the common case. `null`
 * (a miss) is cached too, so a broken link is not re-requested on every hover.
 */
const previewCache = new Map<string, LinkPreview | null>();
const inflightRequests = new Map<string, Promise<LinkPreview | null>>();

/**
 * Ceiling on the session cache. Reaching it takes hundreds of distinct links in
 * one session, so dropping everything is simpler than tracking recency and
 * costs at most one refetch per link afterwards.
 */
const CACHE_LIMIT = 250;

type PanelState = {
  cacheKey: string;
  status: "loading" | "ready";
  preview: LinkPreview | null;
};

type PanelPosition = {
  left: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
};

function loadPreview(
  href: string,
  locale: Locale,
  cacheKey: string,
): Promise<LinkPreview | null> {
  const inflight = inflightRequests.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const request = apiFetch<{ preview: LinkPreview | null }>(
    `/api/link-preview?href=${encodeURIComponent(href)}&locale=${locale}`,
  )
    .then((result) => (result.ok ? result.data.preview ?? null : null))
    .catch(() => null)
    .then((preview) => {
      if (previewCache.size >= CACHE_LIMIT) {
        previewCache.clear();
      }
      previewCache.set(cacheKey, preview);
      return preview;
    })
    .finally(() => {
      inflightRequests.delete(cacheKey);
    });

  inflightRequests.set(cacheKey, request);
  return request;
}

/**
 * Walks up from the event target to the nearest anchor and decides whether it
 * opted into previews. `data-link-preview="off"` wins over an enclosing scope,
 * so a container can opt in wholesale and still exclude single links.
 */
function findPreviewAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) {
    return null;
  }

  const anchor = target.closest("a[href]");

  if (!(anchor instanceof HTMLAnchorElement)) {
    return null;
  }

  if (anchor.dataset.linkPreview === "off") {
    return null;
  }

  const optedIn =
    anchor.hasAttribute("data-link-preview") ||
    Boolean(anchor.closest("[data-link-preview-scope]"));

  return optedIn ? anchor : null;
}

function hostOf(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Hosts that count as "this site" besides the one currently being served.
 *
 * Authored bodies store internal links absolute — the rich-text sanitizer keeps
 * only `http(s)://` hrefs — and they were written against the canonical domain.
 * That domain *is* the page's own origin in production, but not behind a `www.`
 * alias, on a preview deployment, or on a dev server pointed at production
 * data; there every in-article internal link would look external and silently
 * lose its card.
 *
 * `NEXT_PUBLIC_APP_URL` is the app's declared canonical origin (the same one
 * `getSiteUrl()` uses for canonicals, sitemaps and OG URLs).
 * `NEXT_PUBLIC_INTERNAL_LINK_HOSTS` is a comma-separated escape hatch for the
 * rest: a former domain, or the production host while developing locally.
 */
const SITE_HOSTS = new Set(
  [
    hostOf(process.env.NEXT_PUBLIC_APP_URL),
    ...(process.env.NEXT_PUBLIC_INTERNAL_LINK_HOSTS ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase()),
  ].filter((host): host is string => Boolean(host)),
);

/**
 * The site-relative path an anchor points at, or `null` when it leaves the site.
 *
 * Read off the resolved anchor properties rather than the raw attribute: an
 * `<a>` resolves its href against the document, so this covers relative hrefs
 * and absolute ones alike.
 *
 * The host is the trust boundary — a card describing our `/u/ada` above a link
 * that actually leads somewhere else would be a lie — so only the page's own
 * origin and the declared site hosts qualify. `mailto:`/`javascript:` hrefs
 * have an empty hostname and a non-http protocol, so they never pass.
 *
 * Query and fragment are dropped: no previewable route varies by them, and a
 * canonical path keeps the request cacheable.
 */
function internalPath(anchor: HTMLAnchorElement): string | null {
  const isHttp = anchor.protocol === "https:" || anchor.protocol === "http:";
  const isOwnSite =
    anchor.origin === window.location.origin ||
    (isHttp && SITE_HOSTS.has(anchor.hostname.toLowerCase()));

  return isOwnSite ? anchor.pathname : null;
}

/**
 * The rect to anchor against. An inline link wrapped across two lines has one
 * client rect per line; `getBoundingClientRect()` would span both and place
 * the card away from the cursor, so prefer the line the pointer is actually on.
 */
function anchorRect(anchor: HTMLAnchorElement, pointerY: number | null): DOMRect {
  const rects = Array.from(anchor.getClientRects());

  if (rects.length === 0) {
    return anchor.getBoundingClientRect();
  }

  if (pointerY !== null) {
    const hovered = rects.find(
      (rect) => pointerY >= rect.top && pointerY <= rect.bottom,
    );
    if (hovered) {
      return hovered;
    }
  }

  return rects[0]!;
}

/**
 * Places the panel in viewport coordinates, flipping above the link when there
 * is more room up there. Same reasoning as `useAnchoredDropdown`, but that hook
 * matches the panel width to its trigger — a hover card has a fixed width and
 * an inline trigger a few characters wide, so it needs its own maths.
 */
function computePosition(rect: DOMRect): PanelPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const spaceBelow = viewportHeight - rect.bottom - GAP - VIEWPORT_MARGIN;
  const spaceAbove = rect.top - GAP - VIEWPORT_MARGIN;
  const openUp = spaceBelow < ESTIMATED_HEIGHT && spaceAbove > spaceBelow;
  const available = Math.max(openUp ? spaceAbove : spaceBelow, MIN_PANEL_HEIGHT);

  const left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(rect.left, viewportWidth - CARD_WIDTH - VIEWPORT_MARGIN),
  );

  return {
    left,
    maxHeight: Math.min(available, viewportHeight - 2 * VIEWPORT_MARGIN),
    ...(openUp
      ? { bottom: viewportHeight - rect.top + GAP }
      : { top: rect.bottom + GAP }),
  };
}

export default function LinkPreviewProvider({
  labels,
}: {
  labels: LinkPreviewLabels;
}) {
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [position, setPosition] = useState<PanelPosition | null>(null);

  /** The anchor the visible panel belongs to. */
  const anchorElementRef = useRef<HTMLAnchorElement | null>(null);
  /** The anchor an open timer is counting down for, before it commits. */
  const pendingAnchorRef = useRef<HTMLAnchorElement | null>(null);
  const pointerYRef = useRef<number | null>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    pendingAnchorRef.current = null;
  }, []);

  const close = useCallback(() => {
    clearTimers();
    anchorElementRef.current = null;
    pointerYRef.current = null;
    setPanel(null);
    setPosition(null);
  }, [clearTimers]);

  useEffect(() => {
    // `matches` stays live, so this needs no listener of its own — a tablet
    // that gains a mouse starts previewing without a remount.
    const touchOnly = window.matchMedia?.(TOUCH_ONLY_QUERY) ?? null;
    const isTouchDevice = () => Boolean(touchOnly?.matches);

    const reposition = () => {
      const anchor = anchorElementRef.current;

      // Nothing on screen: scrolling must not disturb a pending open timer.
      if (!anchor) {
        return;
      }

      if (!anchor.isConnected) {
        close();
        return;
      }

      const rect = anchorRect(anchor, pointerYRef.current);

      // The link scrolled out of sight — a card floating next to nothing is
      // worse than no card.
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        close();
        return;
      }

      setPosition(computePosition(rect));
    };

    const open = (anchor: HTMLAnchorElement, pointerY: number | null) => {
      const href = internalPath(anchor);
      const target = parseLinkPreviewHref(href);

      if (!href || !target) {
        return;
      }

      // `window.location` rather than `usePathname()`: the listeners are
      // attached once and must always see the current URL, and Next's router
      // keeps `location` in step with client-side navigation anyway.
      const currentPath = window.location.pathname;

      // Never preview the page the reader is already on.
      if (
        stripLocaleFromPathname(anchor.pathname) ===
        stripLocaleFromPathname(currentPath)
      ) {
        return;
      }

      const locale: Locale =
        target.locale ?? getLocaleFromPathname(currentPath);
      const cacheKey = linkPreviewCacheKey(target, locale);

      if (previewCache.has(cacheKey)) {
        const cached = previewCache.get(cacheKey) ?? null;

        // A cached miss stays silent: no card, no flash of a skeleton.
        if (!cached) {
          close();
          return;
        }

        anchorElementRef.current = anchor;
        pointerYRef.current = pointerY;
        setPanel({ cacheKey, status: "ready", preview: cached });
        setPosition(computePosition(anchorRect(anchor, pointerY)));
        return;
      }

      anchorElementRef.current = anchor;
      pointerYRef.current = pointerY;

      setPanel({ cacheKey, status: "loading", preview: null });
      setPosition(computePosition(anchorRect(anchor, pointerY)));

      void loadPreview(href, locale, cacheKey).then((preview) => {
        // The reader may have moved on to another link while we waited.
        if (anchorElementRef.current !== anchor) {
          return;
        }

        if (!preview) {
          close();
          return;
        }

        setPanel({ cacheKey, status: "ready", preview });
        setPosition(computePosition(anchorRect(anchor, pointerYRef.current)));
      });
    };

    const cancelPendingClose = () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };

    const scheduleOpen = (
      anchor: HTMLAnchorElement,
      pointerY: number | null,
      delay: number,
    ) => {
      // `pointerover` re-fires for every child element the cursor enters, so a
      // link containing <strong>/<code> would restart the timer on every step
      // and never open. Both refs together mean "already showing or already
      // counting down for this exact link" — the only work left is to call off
      // a close scheduled by a cursor that wobbled out and back.
      if (
        anchorElementRef.current === anchor ||
        pendingAnchorRef.current === anchor
      ) {
        cancelPendingClose();
        return;
      }

      clearTimers();

      // Moving straight from one previewable link to the next: drop the visible
      // card immediately instead of leaving it pinned to the link just left.
      if (anchorElementRef.current) {
        close();
      }

      pendingAnchorRef.current = anchor;
      openTimerRef.current = setTimeout(() => {
        openTimerRef.current = null;
        pendingAnchorRef.current = null;
        open(anchor, pointerY);
      }, delay);
    };

    const scheduleClose = () => {
      if (openTimerRef.current) {
        clearTimeout(openTimerRef.current);
        openTimerRef.current = null;
        pendingAnchorRef.current = null;
      }
      if (closeTimerRef.current) {
        return;
      }

      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null;
        close();
      }, CLOSE_DELAY_MS);
    };

    const handlePointerOver = (event: PointerEvent) => {
      // Touch taps navigate; a card would flash and cover the content. Pen and
      // mouse both have a real hover state.
      if (
        isTouchDevice() ||
        (event.pointerType !== "mouse" && event.pointerType !== "pen")
      ) {
        return;
      }

      const anchor = findPreviewAnchor(event.target);

      if (!anchor) {
        return;
      }

      scheduleOpen(anchor, event.clientY, OPEN_DELAY_MS);
    };

    const handlePointerOut = (event: PointerEvent) => {
      // A link the cursor left before the open delay elapsed must be called
      // off too, otherwise its card pops up next to a cursor already gone.
      const anchor = anchorElementRef.current ?? pendingAnchorRef.current;

      if (!anchor) {
        return;
      }

      // Not our link — some other element on the page lost the pointer.
      if (event.target instanceof Node && !anchor.contains(event.target)) {
        return;
      }

      // Moving between the anchor's own children is not a departure.
      const next = event.relatedTarget;
      if (next instanceof Node && anchor.contains(next)) {
        return;
      }

      scheduleClose();
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (isTouchDevice()) {
        return;
      }

      const anchor = findPreviewAnchor(event.target);

      if (!anchor) {
        close();
        return;
      }

      scheduleOpen(anchor, null, FOCUS_OPEN_DELAY_MS);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // Escape dismisses; Enter follows the link, and the card must not outlive
      // the page it describes. (Tab moves focus, which `focusin` handles.)
      if (event.key === "Escape" || event.key === "Enter") {
        close();
      }
    };

    document.addEventListener("pointerover", handlePointerOver, true);
    document.addEventListener("pointerout", handlePointerOut, true);
    document.addEventListener("pointerdown", close, true);
    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("keydown", handleKeyDown, true);
    // Capture phase: scrolling any ancestor (a sticky sidebar, a modal body)
    // has to re-anchor the panel, not just the window.
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);

    return () => {
      document.removeEventListener("pointerover", handlePointerOver, true);
      document.removeEventListener("pointerout", handlePointerOut, true);
      document.removeEventListener("pointerdown", close, true);
      document.removeEventListener("focusin", handleFocusIn, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      clearTimers();
    };
  }, [clearTimers, close]);

  // No portal on the server, and none on the first client render either: the
  // panel exists only after a pointer or focus event, both of which are
  // client-only, so hydration always starts from "nothing rendered".
  if (!panel || !position) {
    return null;
  }

  return createPortal(
    <div
      // Informational only — the link underneath owns every interaction.
      aria-hidden="true"
      className="link-preview-panel"
      style={{
        left: position.left,
        maxHeight: position.maxHeight,
        ...(position.top !== undefined ? { top: position.top } : {}),
        ...(position.bottom !== undefined ? { bottom: position.bottom } : {}),
      }}
    >
      {panel.status === "ready" && panel.preview ? (
        <LinkPreviewCard preview={panel.preview} />
      ) : (
        <LinkPreviewSkeleton label={labels.loading} />
      )}
    </div>,
    document.body,
  );
}
