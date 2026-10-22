"use client";

import { useId, useState, type ReactNode } from "react";

/**
 * A small "ⓘ" info affordance that reveals an explanatory tooltip on hover, on
 * keyboard focus and on tap. Hover and focus are CSS-only; the tap needs a bit
 * of state because iOS does not focus a `<button>` when it is tapped, so on a
 * phone neither CSS trigger ever fires. Theme-aware and accessible: the
 * trigger is a real button wired to the tooltip via aria-describedby. Meant
 * for optional inline help next to a form label, so the label itself stays
 * short.
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
  const [open, setOpen] = useState(false);

  return (
    <span
      data-open={open}
      className={`group relative inline-flex ${className}`}
    >
      {/* The visible circle stays 16px; the ::before extends the hit area to
          24px so a fingertip can find it. */}
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        className="relative inline-flex h-4 w-4 items-center justify-center rounded-full border app-border text-[10px] font-semibold leading-none app-soft transition before:absolute before:-inset-1 before:content-[''] hover:text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
      >
        <span aria-hidden="true">i</span>
      </button>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+0.4rem)] left-1/2 z-30 w-56 -translate-x-1/2 rounded-xl border app-border bg-[color:var(--surface)] p-2.5 text-left text-xs leading-snug font-normal normal-case tracking-normal text-[color:var(--muted-foreground)] opacity-0 shadow-lg transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100 group-data-[open=true]:opacity-100"
      >
        {children}
      </span>
    </span>
  );
}
