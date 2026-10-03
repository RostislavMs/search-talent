"use client";

/**
 * The site's on/off switch. Label it with `aria-labelledby` (or
 * `aria-label`) pointing at the visible text next to it.
 */
export default function Switch({
  checked,
  onChange,
  disabled = false,
  labelledBy,
  describedBy,
  label,
  size = "md",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  labelledBy?: string;
  describedBy?: string;
  /** When there is no visible label to point at. */
  label?: string;
  size?: "sm" | "md";
}) {
  const small = size === "sm";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-label={labelledBy ? undefined : label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex shrink-0 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] disabled:cursor-not-allowed disabled:opacity-60",
        small ? "h-6 w-10" : "h-7 w-12",
        checked
          ? "border-transparent bg-[color:var(--brand)]"
          : "app-border bg-[color:var(--surface-muted)] hover:bg-[color:var(--surface)]",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={[
          "inline-block rounded-full bg-white shadow transition-transform",
          small ? "h-4 w-4" : "h-5 w-5",
          checked ? (small ? "translate-x-5" : "translate-x-6") : "translate-x-1",
        ].join(" ")}
      />
    </button>
  );
}
