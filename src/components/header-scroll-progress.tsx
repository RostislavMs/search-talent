"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { stripLocaleFromPathname } from "@/lib/i18n/config";

// Routes whose content grows or paginates as you scroll (infinite feeds and
// discovery browsers). A scroll-progress fill there is meaningless and even
// misleading — the document height keeps changing — so the indicator is skipped.
// Detail pages under these sections (e.g. /articles/[slug], /news/[slug],
// /projects/[slug]) are finite, so they keep it as a reading-progress cue.
const INFINITE_SCROLL_EXACT = new Set([
  "/articles",
  "/polls",
  "/news",
  "/projects",
]);
const INFINITE_SCROLL_PREFIXES = ["/talents", "/projects/tag", "/projects/type"];

function usesInfiniteScroll(pathname: string) {
  if (INFINITE_SCROLL_EXACT.has(pathname)) return true;
  return INFINITE_SCROLL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

// Reading-progress indicator for the sticky header. Following the Plerdy
// reference, the whole header fills from left to right as the page scrolls —
// not a thin line. The fill is a faint, theme-aware neutral wash (foreground at
// low opacity) rather than a brand colour, so it reads as a subtle cue instead
// of an accent. Mobile only (lg:hidden); the desktop header stays plain. The
// fill renders behind the header content (-z-10) so the logo and nav stay
// crisp. Updates are throttled to one transform write per animation frame.
export default function HeaderScrollProgress() {
  const pathname = stripLocaleFromPathname(usePathname() || "/");
  const disabled = usesInfiniteScroll(pathname);
  const fillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disabled) return;
    const fill = fillRef.current;
    if (!fill) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      const progress =
        scrollable > 0
          ? Math.min(1, Math.max(0, window.scrollY / scrollable))
          : 0;
      fill.style.transform = `scaleX(${progress})`;
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [disabled]);

  if (disabled) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden lg:hidden"
    >
      {/* Driven entirely through the inline `transform` (set in the effect). We
          intentionally avoid Tailwind's `scale-x-*` utilities: in Tailwind v4
          those compile to the standalone `scale` CSS property, which composes
          with — and would zero out — an inline `transform: scaleX()`, leaving
          the fill permanently invisible. `transform-origin` via a class is safe
          since it never conflicts with the transform value. */}
      <div
        ref={fillRef}
        style={{ transform: "scaleX(0)" }}
        className="h-full w-full origin-left bg-[color:var(--foreground)]/10"
      />
    </div>
  );
}
