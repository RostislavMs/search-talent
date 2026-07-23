"use client";

import { type MouseEvent, useSyncExternalStore } from "react";
import {
  allowsCookieCategory,
  cookieConsentUpdatedEvent,
  getCookieConsentFromDocument,
} from "@/lib/cookie-consent";
import { useDictionary } from "@/lib/i18n/client";
import type { Theme } from "@/lib/theme";
import {
  applyThemeToDocument,
  clearThemePreferencePersistence,
  getThemeFromDocument,
  persistThemePreference,
} from "@/lib/theme-client";

type ResolvedTheme = "light" | "dark";

/**
 * Not every browser types `startViewTransition` yet, so widen the Document
 * locally instead of relying on the ambient lib version.
 */
type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => { ready: Promise<void> };
};

function canPersistThemePreference() {
  return allowsCookieCategory(getCookieConsentFromDocument(), "preferences");
}

function subscribeToConsent(callback: () => void) {
  window.addEventListener(cookieConsentUpdatedEvent, callback);
  return () => {
    window.removeEventListener(cookieConsentUpdatedEvent, callback);
  };
}

// The single source of truth for the active theme is the `data-theme` attribute
// on <html>. Observing it (rather than keeping local state seeded from a prop)
// keeps every toggle instance in sync — including the mobile-drawer toggle,
// which remounts each time the menu opens and would otherwise re-seed from a
// stale server prop and appear stuck on one theme.
function subscribeToTheme(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}

export default function ThemeToggle({
  initialTheme,
  initialCanPersist,
}: {
  initialTheme: Theme;
  /**
   * Server-computed value: true when the user has already accepted the
   * "preferences" cookie category. Used as the initial state so the
   * "session-only" indicator doesn't flash on every reload before the
   * client-side check runs.
   */
  initialCanPersist: boolean;
}) {
  const dictionary = useDictionary();
  // Read the live theme from <html data-theme> so the switch always reflects the
  // real, current theme — not a prop captured at mount. SSR/hydration use the
  // server-computed `initialTheme` to avoid a mismatch, then it syncs on mount.
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeFromDocument,
    () => initialTheme,
  );
  const canPersist = useSyncExternalStore(
    subscribeToConsent,
    canPersistThemePreference,
    () => initialCanPersist,
  );

  const isDark = theme === "dark";

  const applyTheme = (next: ResolvedTheme) => {
    // Updating the document attribute triggers the MutationObserver above, which
    // re-renders this (and every other) toggle — no local state needed.
    applyThemeToDocument(next);

    if (canPersist) {
      persistThemePreference(next);
    } else {
      clearThemePreferencePersistence();
    }
  };

  const handleToggle = (event: MouseEvent<HTMLButtonElement>) => {
    const next: ResolvedTheme = isDark ? "light" : "dark";

    const doc = document as DocumentWithViewTransition;
    const startViewTransition = doc.startViewTransition?.bind(doc);

    // No View Transitions support (or reduced motion): swap instantly.
    if (!startViewTransition || prefersReducedMotion()) {
      applyTheme(next);
      return;
    }

    // A circle that spreads from the centre of the toggle across the viewport.
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    const transition = startViewTransition(() => {
      applyTheme(next);
    });

    transition.ready
      .then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 480,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      })
      .catch(() => {
        // The theme has already been applied inside the callback, so a failed
        // clip-path animation only means the reveal was instant.
      });
  };

  const label = `${dictionary.theme.toggleLabel}: ${
    isDark ? dictionary.theme.light : dictionary.theme.dark
  }`;

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={label}
        title={label}
        onClick={handleToggle}
        className="group relative inline-flex w-16 shrink-0 cursor-pointer items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] p-1 transition-colors hover:bg-[color:var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] lg:w-12 lg:p-0.5"
      >
        {/* Faint day/night markers at each end of the track. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-between px-2 text-[color:var(--muted-foreground)] lg:px-1.5"
        >
          <SunIcon className="h-3.5 w-3.5 opacity-50 lg:h-3 lg:w-3" />
          <MoonIcon className="h-3.5 w-3.5 opacity-50 lg:h-3 lg:w-3" />
        </span>

        {/* Rolling knob: slides + spins once as it crosses, swapping its face. */}
        <span
          aria-hidden="true"
          className={[
            "relative z-10 flex size-8 items-center justify-center rounded-full bg-[color:var(--foreground)] text-[color:var(--background)] shadow-sm transition-transform duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none lg:size-6",
            isDark ? "translate-x-[22px] rotate-[360deg] lg:translate-x-[18px]" : "translate-x-0 rotate-0",
          ].join(" ")}
        >
          <SunIcon
            className={[
              "absolute h-4 w-4 transition-opacity duration-200 motion-reduce:transition-none lg:h-3.5 lg:w-3.5",
              isDark ? "opacity-0" : "opacity-100",
            ].join(" ")}
          />
          <MoonIcon
            className={[
              "absolute h-4 w-4 transition-opacity duration-200 motion-reduce:transition-none lg:h-3.5 lg:w-3.5",
              isDark ? "opacity-100" : "opacity-0",
            ].join(" ")}
          />
        </span>
      </button>

      {!canPersist && (
        <span
          className="inline-flex h-5 w-5 shrink-0 cursor-help items-center justify-center rounded-full border border-[color:var(--border)] text-[10px] font-semibold app-muted"
          title={dictionary.cookieConsent.themeSessionOnly}
          aria-label={dictionary.cookieConsent.themeSessionOnly}
          role="img"
        >
          i
        </span>
      )}
    </div>
  );
}
