"use client";

import type { ReactNode } from "react";

// Compact like / views / comments chips shared by the article and poll
// interaction bars. Icon + number only, so the whole stats + reactions row fits
// on a single line on mobile. Height matches the md ReactionPicker pill (h-8) so
// they line up when rendered side by side.

const chipBase =
  "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-sm";

export function HeartIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      aria-hidden="true"
    >
      <path
        d="M12 20.7c-.3 0-.5-.1-.7-.3C7.2 16.7 4 13.9 4 10.5 4 8.1 5.9 6.2 8.2 6.2c1.4 0 2.7.7 3.5 1.8h.6c.8-1.1 2.1-1.8 3.5-1.8 2.3 0 4.2 1.9 4.2 4.3 0 3.4-3.2 6.2-7.3 9.9-.2.2-.4.3-.7.3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function CommentIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v7a1.5 1.5 0 0 1-1.5 1.5H9l-4 3.4V13.5H5.5A1.5 1.5 0 0 1 4 12.5v-7Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Non-interactive stat (views, comments): icon + count, no hover. */
export function StatChip({
  icon,
  count,
  label,
}: {
  icon: ReactNode;
  count: number;
  label: string;
}) {
  return (
    <span
      className={`${chipBase} app-border app-panel app-muted`}
      title={label}
      aria-label={`${label}: ${count}`}
    >
      {icon}
      <span className="tabular-nums">{count}</span>
    </span>
  );
}

/** Actionable like toggle: heart icon + count. Hover only here (it's a button). */
export function LikeChip({
  liked,
  count,
  onClick,
  disabled,
  label,
}: {
  liked: boolean;
  count: number;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={liked}
      title={label}
      aria-label={`${label}: ${count}`}
      className={[
        chipBase,
        "cursor-pointer transition-colors",
        liked
          ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--foreground)]"
          : "app-border app-panel text-[color:var(--foreground)] hover:bg-[color:var(--surface-muted)]",
        disabled ? "opacity-60" : "",
      ].join(" ")}
    >
      <HeartIcon filled={liked} />
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
