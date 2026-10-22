export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonStylesOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

/**
 * Press feedback for anything tapped or clicked: a 3% squeeze while held, so
 * the control answers the finger before the page does. Shared by
 * `buttonStyles` and by the hand-built controls (header triggers, chips) that
 * do not use it. Not for list rows or menu items — they highlight instead.
 */
export const pressable =
  "transition-[color,background-color,border-color,box-shadow,scale] duration-150 ease-out active:scale-[0.97]";

/** Unread counter pinned to the corner of an icon button (bell, messages). */
export const countBadge =
  "absolute -top-1 -right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-semibold tabular-nums text-white";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[color:var(--brand)] text-[color:var(--brand-foreground)] shadow-sm hover:bg-[color:var(--brand-strong)] focus-visible:ring-[color:var(--brand-ring)]",
  secondary:
    "border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--foreground)] hover:bg-[color:var(--surface-muted)] focus-visible:ring-[color:var(--ring)]",
  ghost:
    "text-[color:var(--muted-foreground)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)] focus-visible:ring-[color:var(--ring)]",
  danger:
    "bg-rose-600 text-white shadow-sm hover:bg-rose-700 focus-visible:ring-rose-600",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-2 text-sm",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3 text-base",
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  className = "",
}: ButtonStylesOptions = {}) {
  return [
    // tabular-nums: a count inside a button (likes, votes) changes in place
    // and would otherwise jog the button's width on every click.
    `inline-flex cursor-pointer items-center justify-center rounded-full font-medium tabular-nums ${pressable} focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-60`,
    variantClasses[variant],
    sizeClasses[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");
}
