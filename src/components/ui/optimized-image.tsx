import Image, { type ImageProps } from "next/image";
import { imageSizes } from "@/lib/supabase/image";

type SizePreset = keyof typeof imageSizes;

type OptimizedImageProps = Omit<ImageProps, "sizes"> & {
  /** Use a named preset or pass a custom sizes string. */
  sizePreset?: SizePreset;
  sizes?: string;
};

// R2 public URLs are already served by Cloudflare CDN with caching and
// modern formats, so running them through Next.js Image Optimizer is
// pure overhead — and on networks where Node.js → r2.dev is slow it
// causes 500 timeouts. Detect and skip the optimizer for those hosts.
function isCdnHostedUrl(src: ImageProps["src"]): boolean {
  if (typeof src !== "string") {
    return false;
  }

  return src.includes(".r2.dev") || src.includes(".r2.cloudflarestorage.com");
}

/**
 * Thin wrapper around Next.js Image that defaults to proper responsive `sizes`
 * based on a preset, so the browser never downloads oversized images.
 *
 * Usage:
 * ```tsx
 * <OptimizedImage src={url} alt="..." fill sizePreset="card" />
 * <OptimizedImage src={url} alt="..." width={80} height={80} sizePreset="avatar" />
 * ```
 */
export default function OptimizedImage({
  sizePreset,
  sizes,
  alt,
  src,
  unoptimized,
  ...props
}: OptimizedImageProps) {
  const resolvedSizes =
    sizes || (sizePreset ? imageSizes[sizePreset] : undefined);
  const resolvedUnoptimized = unoptimized ?? isCdnHostedUrl(src);

  return (
    <Image
      sizes={resolvedSizes}
      alt={alt}
      src={src}
      unoptimized={resolvedUnoptimized}
      {...props}
    />
  );
}
