import OptimizedImage from "@/components/ui/optimized-image";

const SIZE_CLASSES = {
  sm: "h-10 w-10 rounded-xl text-base",
  md: "h-14 w-14 rounded-2xl text-xl",
  lg: "h-20 w-20 rounded-2xl text-3xl sm:h-24 sm:w-24",
} as const;

const SIZE_PX = { sm: 40, md: 56, lg: 96 } as const;

/**
 * A company's logo on a square tile, or its first letter when there is none.
 * Decorative next to the name, so it stays out of the tab order.
 */
export default function CompanyLogo({
  name,
  logoUrl,
  alt,
  size = "md",
  priority = false,
}: {
  name: string;
  logoUrl: string | null;
  alt: string;
  size?: keyof typeof SIZE_CLASSES;
  priority?: boolean;
}) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden border app-border bg-[color:var(--surface-muted)] ${SIZE_CLASSES[size]}`}
    >
      {logoUrl ? (
        <OptimizedImage
          src={logoUrl}
          alt={alt}
          fill
          sizes={`${SIZE_PX[size]}px`}
          priority={priority}
          className="object-contain"
        />
      ) : (
        <span
          aria-hidden="true"
          className="font-display font-medium text-[color:var(--foreground)]"
        >
          {name.trim().slice(0, 1).toUpperCase() || "·"}
        </span>
      )}
    </span>
  );
}
