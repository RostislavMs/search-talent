"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";
import LocalizedLink from "@/components/ui/localized-link";
import { stripLocaleFromPathname } from "@/lib/i18n/config";

type HeaderNavLink = {
  href: string;
  label: string;
};

type HeaderNavProps = {
  links: HeaderNavLink[];
};

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function HeaderNav({ links }: HeaderNavProps) {
  const pathname = stripLocaleFromPathname(usePathname() || "/");
  const containerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const linkRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const hasMountedRef = useRef(false);

  const activeIndex = links.findIndex((link) =>
    isActivePath(pathname, link.href),
  );

  useIsomorphicLayoutEffect(() => {
    const container = containerRef.current;
    const indicator = indicatorRef.current;
    if (!container || !indicator) return;

    const measure = () => {
      if (activeIndex === -1) return null;
      const activeEl = linkRefs.current[activeIndex];
      if (!activeEl) return null;
      const containerRect = container.getBoundingClientRect();
      const linkRect = activeEl.getBoundingClientRect();
      return {
        left: linkRect.left - containerRect.left,
        width: linkRect.width,
      };
    };

    const writePosition = (pos: { left: number; width: number } | null) => {
      if (!pos) {
        indicator.style.opacity = "0";
        return;
      }
      indicator.style.width = `${pos.width}px`;
      indicator.style.transform = `translate3d(${pos.left}px, 0, 0)`;
      indicator.style.opacity = "1";
    };

    const applyImmediate = () => {
      indicator.classList.remove("header-nav-indicator--animated");
      writePosition(measure());
      // Force reflow so the next class addition doesn't animate
      void indicator.offsetWidth;
      indicator.classList.add("header-nav-indicator--animated");
    };

    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      applyImmediate();
    } else {
      // Animation class already present from the initial mount.
      // Just update style — browser triggers the CSS transition.
      writePosition(measure());
    }

    // ResizeObserver fires immediately on observe start. Skip that first call
    // so it does not stomp the animated update.
    let skipFirstResize = true;
    const handleResize = () => {
      if (skipFirstResize) {
        skipFirstResize = false;
        return;
      }
      applyImmediate();
    };
    const handleWindowResize = () => applyImmediate();
    const ro = new ResizeObserver(handleResize);
    ro.observe(container);
    linkRefs.current.forEach((el) => {
      if (el) ro.observe(el);
    });
    window.addEventListener("resize", handleWindowResize);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [activeIndex, pathname, links.length]);

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center gap-1"
    >
      <span
        ref={indicatorRef}
        aria-hidden="true"
        className="header-nav-indicator pointer-events-none absolute bottom-0 left-0 top-0 rounded-full bg-[color:var(--foreground)] opacity-0"
      />
      {links.map((link, i) => {
        const isActive = i === activeIndex;
        return (
          <LocalizedLink
            key={link.href}
            href={link.href}
            ref={(el) => {
              linkRefs.current[i] = el;
            }}
            className={[
              "relative z-10 rounded-full px-3 py-2 text-sm font-medium transition-colors duration-300",
              isActive
                ? "text-[color:var(--background)]"
                : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
            ].join(" ")}
          >
            {link.label}
          </LocalizedLink>
        );
      })}
    </div>
  );
}
