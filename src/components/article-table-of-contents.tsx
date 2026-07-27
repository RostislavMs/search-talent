"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";

type Heading = {
  id: string;
  text: string;
  /** 2, 3 or 4 — drives the nested indentation of the entry. */
  level: number;
};

type TocGroup = {
  /** The top-level entry (an <h2>, or a stray <h3>/<h4> that precedes the first
   * <h2>). Clicking it still navigates to that section. */
  heading: Heading;
  /** Sub-headings that collapse under this entry. */
  children: Heading[];
};

function slugify(text: string, index: number) {
  const base = text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return base ? `toc-${base}-${index}` : `toc-section-${index}`;
}

/**
 * Builds a sticky table of contents from the headings inside the rendered
 * article body. The article HTML is injected via dangerouslySetInnerHTML and
 * the sanitizer strips id attributes, so we assign deterministic ids on the
 * client and wire up scroll-spy with an IntersectionObserver.
 *
 * Sub-headings (<h3>/<h4>) collapse under their parent <h2>: a chevron toggles
 * each section, and the section holding the currently-read heading opens
 * automatically. This keeps the outline short on long articles rather than
 * listing every heading at once.
 */
export default function ArticleTableOfContents({
  targetId,
  title,
  locale = "uk",
  variant = "sidebar",
}: {
  targetId: string;
  title: string;
  /** Drives the chevron's accessible labels. Defaults to Ukrainian. */
  locale?: string;
  /** "sidebar" is the sticky desktop rail; "mobile" is a collapsed-by-default
   * disclosure rendered inline after the cover image on small screens. */
  variant?: "sidebar" | "mobile";
}) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Manual pins for NON-active sections only. The section the reader is in is
  // always open (scrolling into a collapsed section reveals it — see
  // isGroupOpen); the chevron just lets you peek other sections open or tuck
  // them away. Keeping manual state off the active section is what stops the
  // outline thrashing while still auto-revealing whatever you scroll into.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  // Freezes the scroll-spy while a click-triggered smooth scroll runs, so the
  // outline doesn't flash open/closed as the page races toward the target.
  const programmaticRef = useRef(false);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const container = document.getElementById(targetId);
    if (!container) return;

    let nodes: HTMLElement[] = [];

    const collect = () => {
      nodes = Array.from(
        container.querySelectorAll<HTMLElement>("h2, h3, h4"),
      );
      const collected = nodes.map((node, index) => {
        const text = node.textContent?.trim() || `${index + 1}`;
        if (!node.id) {
          node.id = slugify(text, index);
        }
        // Clear the sticky site header when jumping to a heading.
        node.style.scrollMarginTop = "7rem";
        const level = Number(node.tagName.slice(1)) || 2;
        return { id: node.id, text, level };
      });
      setHeadings(collected);
    };

    // Position-based scroll-spy: the active heading is the last one whose top
    // has scrolled up past the reading line (just below the sticky header).
    // This tracks the reader monotonically, so a section with lots of content
    // keeps its own heading highlighted the whole way through instead of the
    // highlight jumping ahead to the next entry mid-section.
    const readingLine = 130;
    const updateActive = () => {
      // While a click-triggered smooth scroll is in flight the highlight is
      // frozen on its target (see handleClick). Recomputing from scroll position
      // mid-flight is what made sections flash open/closed as the page raced
      // past them.
      if (programmaticRef.current || nodes.length === 0) return;
      let currentId = nodes[0].id;
      for (const node of nodes) {
        if (node.getBoundingClientRect().top <= readingLine) {
          currentId = node.id;
        } else {
          break;
        }
      }
      setActiveId(currentId);
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        updateActive();
        ticking = false;
      });
    };

    // A real user gesture cancels the click-scroll freeze at once, so manual
    // scrolling always drives the highlight even mid-animation.
    const endProgrammatic = () => {
      programmaticRef.current = false;
    };

    // Wait one frame so the sibling article body (injected via
    // dangerouslySetInnerHTML) has painted before we query its headings.
    const raf = requestAnimationFrame(() => {
      collect();
      updateActive();
    });

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("wheel", endProgrammatic, { passive: true });
    window.addEventListener("touchmove", endProgrammatic, { passive: true });
    window.addEventListener("keydown", endProgrammatic);

    return () => {
      cancelAnimationFrame(raf);
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("wheel", endProgrammatic);
      window.removeEventListener("touchmove", endProgrammatic);
      window.removeEventListener("keydown", endProgrammatic);
    };
  }, [targetId]);

  // Group sub-headings under the preceding <h2>. A sub-heading with no parent
  // <h2> before it becomes its own top-level (childless) entry.
  const groups: TocGroup[] = [];
  for (const heading of headings) {
    if (heading.level <= 2 || groups.length === 0) {
      groups.push({ heading, children: [] });
    } else {
      groups[groups.length - 1].children.push(heading);
    }
  }

  // Which top-level section owns the active heading (itself or one of its
  // children) — that section opens by default.
  const activeGroupId =
    groups.find(
      (group) =>
        group.heading.id === activeId ||
        group.children.some((child) => child.id === activeId),
    )?.heading.id ?? null;

  if (headings.length < 2) {
    return null;
  }

  const handleClick = (
    event: MouseEvent<HTMLAnchorElement>,
    id: string,
  ) => {
    event.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;
    // Freeze the highlight on the clicked target for the duration of the smooth
    // scroll so the outline settles straight onto it instead of rippling through
    // every section on the way. The timer is a fallback for when the target
    // can't reach the reading line (e.g. the last, short section), where the
    // arrival can't be observed; a user gesture also releases it early.
    programmaticRef.current = true;
    if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
    releaseTimerRef.current = setTimeout(() => {
      programmaticRef.current = false;
    }, 700);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
    window.history.replaceState(null, "", `#${id}`);
    // Collapse the mobile disclosure once a section is picked (no-op in the
    // sidebar variant, where there is no enclosing <details>).
    event.currentTarget.closest("details")?.removeAttribute("open");
  };

  // Indent sub-headings so the outline hierarchy is visible: H2 sits flush, H3
  // and H4 step further in.
  const indentByLevel: Record<number, string> = {
    2: "pl-4",
    3: "pl-8",
    4: "pl-12",
  };

  // The section being read is always open, so scrolling into a collapsed one
  // always reveals it. Any other section is open only if the reader pinned it
  // open with the chevron. (A stored override never blocks the active section,
  // which was why scrolling in stopped expanding it.)
  const isGroupOpen = (group: TocGroup) =>
    group.children.length > 0 &&
    (group.heading.id === activeGroupId ||
      overrides[group.heading.id] === true);

  const toggleGroup = (group: TocGroup) => {
    const open = isGroupOpen(group);
    setOverrides((prev) => ({ ...prev, [group.heading.id]: !open }));
  };

  const labels =
    locale === "uk"
      ? { expand: "Розгорнути розділ", collapse: "Згорнути розділ" }
      : { expand: "Expand section", collapse: "Collapse section" };

  const renderLink = (heading: Heading, extra = "") => {
    const isActive = heading.id === activeId;
    return (
      <a
        href={`#${heading.id}`}
        onClick={(event) => handleClick(event, heading.id)}
        aria-current={isActive ? "location" : undefined}
        className={[
          "-ml-px block min-w-0 border-l-2 py-1.5 text-sm leading-snug transition",
          extra,
          indentByLevel[heading.level] ?? "pl-4",
          isActive
            ? "border-[color:var(--brand)] font-medium text-[color:var(--foreground)]"
            : "border-transparent app-muted hover:border-[color:var(--border)] hover:text-[color:var(--foreground)]",
        ].join(" ")}
      >
        {heading.text}
      </a>
    );
  };

  const list = (
    <ul className="space-y-1 border-l app-border">
      {groups.map((group) => {
        const hasChildren = group.children.length > 0;
        const open = isGroupOpen(group);
        return (
          <li key={group.heading.id}>
            {hasChildren ? (
              <div className="flex items-start">
                {renderLink(group.heading, "flex-1")}
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  aria-expanded={open}
                  aria-label={open ? labels.collapse : labels.expand}
                  className="shrink-0 cursor-pointer rounded p-1.5 app-muted transition hover:text-[color:var(--foreground)]"
                >
                  <svg
                    aria-hidden
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className={`h-4 w-4 transition-transform ${
                      open ? "rotate-180" : ""
                    }`}
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            ) : (
              renderLink(group.heading)
            )}
            {hasChildren && open ? (
              <ul className="mt-1 space-y-1">
                {group.children.map((child) => (
                  <li key={child.id}>{renderLink(child)}</li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );

  if (variant === "mobile") {
    return (
      <details className="group rounded-panel app-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 text-xs font-semibold uppercase tracking-eyebrow app-soft [&::-webkit-details-marker]:hidden">
          {title}
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4 shrink-0 transition group-open:rotate-180"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </summary>
        <div className="px-5 pb-5">{list}</div>
      </details>
    );
  }

  return (
    <nav
      aria-label={title}
      className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-panel app-card p-5"
    >
      <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
        {title}
      </p>
      <div className="mt-3">{list}</div>
    </nav>
  );
}
