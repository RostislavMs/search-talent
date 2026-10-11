import OptimizedImage from "@/components/ui/optimized-image";
import { initialOf } from "@/lib/messages";

const SIZES = {
  sm: { box: "h-8 w-8 text-xs", px: 32 },
  md: { box: "h-11 w-11 text-sm", px: 44 },
} as const;

/**
 * A person's photo (round) or a company's logo (rounded square) in the
 * messages, or the first letter. Decorative: the name is always next to it.
 */
export default function MessagingAvatar({
  label,
  imageUrl,
  isCompany = false,
  size = "md",
}: {
  label: string;
  imageUrl: string | null;
  isCompany?: boolean;
  size?: keyof typeof SIZES;
}) {
  const preset = SIZES[size];

  return (
    <span
      aria-hidden="true"
      className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-[color:var(--surface-muted)] font-semibold text-[color:var(--foreground)] ${preset.box} ${
        isCompany ? "rounded-xl border app-border" : "rounded-full"
      }`}
    >
      {imageUrl ? (
        <OptimizedImage
          src={imageUrl}
          alt=""
          fill
          sizes={`${preset.px}px`}
          className={isCompany ? "object-contain" : "object-cover"}
        />
      ) : (
        <span>{initialOf(label)}</span>
      )}
    </span>
  );
}
