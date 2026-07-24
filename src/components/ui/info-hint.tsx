"use client";

import { useId, type ReactNode } from "react";

/**
 * A small "ⓘ" info affordance that reveals an explanatory tooltip on hover and
 * on keyboard focus. CSS-only (no positioning JS), theme-aware and accessible:
 * the trigger is a real focusable button wired to the tooltip via
 * aria-describedby. Meant for optional inline help next to a form label, so the
 * label itself stays short.
 */
export default function InfoHint({
  label,
  children,
  className = "",
}: {
  /** Accessible name for the trigger, e.g. "Про поле slug". */
  label: string;
  /** Tooltip content. */
  children: ReactNode;
  className?: string;
}) {
  const id = useId();

  return (
    <span className={`group relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border app-border text-[10px] font-semibold leading-none app-soft transition hover:text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
      >
        <span aria-hidden="true">i</span>
      </button>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+0.4rem)] left-1/2 z-30 w-56 -translate-x-1/2 rounded-xl border app-border bg-[color:var(--surface)] p-2.5 text-left text-xs leading-snug font-normal normal-case tracking-normal text-[color:var(--muted-foreground)] opacity-0 shadow-lg transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {children}
      </span>
    </span>
  );
}
