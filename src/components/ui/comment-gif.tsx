"use client";

type CommentGifProps = {
  url: string;
  /** Optional accessible label; falls back to a generic alt. */
  alt?: string;
  className?: string;
};

/**
 * Renders a GIF attached to a comment. Uses a plain <img> on purpose: the
 * source is a third-party animated GIF on the provider CDN, so next/image
 * optimization would strip the animation and require per-host remotePatterns.
 * CSP `img-src https:` already permits the remote source.
 */
export default function CommentGif({ url, alt, className }: CommentGifProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt || "GIF"}
      loading="lazy"
      className={
        className ??
        "mt-2 block max-h-56 w-auto max-w-full rounded-xl border app-border sm:max-h-72"
      }
    />
  );
}
