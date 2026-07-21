"use client";

import { useEffect, useState, type MouseEvent } from "react";

type Heading = {
  id: string;
  text: string;
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
 */
export default function ArticleTableOfContents({
  targetId,
  title,
  variant = "sidebar",
}: {
  targetId: string;
  title: string;
  /** "sidebar" is the sticky desktop rail; "mobile" is a collapsed-by-default
   * disclosure rendered inline after the cover image on small screens. */
  variant?: "sidebar" | "mobile";
}) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    let observer: IntersectionObserver | null = null;

    // Wait one frame so the sibling article body (injected via
    // dangerouslySetInnerHTML) has painted before we query its headings.
    const raf = requestAnimationFrame(() => {
      const container = document.getElementById(targetId);
      if (!container) return;

      const nodes = Array.from(container.querySelectorAll<HTMLElement>("h2"));
      const collected = nodes.map((node, index) => {
        const text = node.textContent?.trim() || `${index + 1}`;
        if (!node.id) {
          node.id = slugify(text, index);
        }
        // Clear the sticky site header when jumping to a heading.
        node.style.scrollMarginTop = "7rem";
        return { id: node.id, text };
      });

      setHeadings(collected);
      if (collected.length === 0) return;

      observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort(
              (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
            );
          if (visible[0]) {
            setActiveId(visible[0].target.id);
          }
        },
        { rootMargin: "-96px 0px -65% 0px", threshold: 0 },
      );

      nodes.forEach((node) => observer?.observe(node));
    });

    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [targetId]);

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
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
    window.history.replaceState(null, "", `#${id}`);
    // Collapse the mobile disclosure once a section is picked (no-op in the
    // sidebar variant, where there is no enclosing <details>).
    event.currentTarget.closest("details")?.removeAttribute("open");
  };

  const items = headings.map((heading) => {
    const isActive = heading.id === activeId;
    return (
      <li key={heading.id}>
        <a
          href={`#${heading.id}`}
          onClick={(event) => handleClick(event, heading.id)}
          aria-current={isActive ? "location" : undefined}
          className={[
            "-ml-px block border-l-2 py-1.5 pl-4 text-sm leading-snug transition",
            isActive
              ? "border-[color:var(--brand)] font-medium text-[color:var(--foreground)]"
              : "border-transparent app-muted hover:border-[color:var(--border)] hover:text-[color:var(--foreground)]",
          ].join(" ")}
        >
          {heading.text}
        </a>
      </li>
    );
  });

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
        <ul className="space-y-1 border-l app-border px-5 pb-5">{items}</ul>
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
      <ul className="mt-3 space-y-1 border-l app-border">{items}</ul>
    </nav>
  );
}
