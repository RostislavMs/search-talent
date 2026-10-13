import type { ReactNode } from "react";

/**
 * Section layout: copy on one side, a supporting visual on the other.
 * Below md only the copy shows; the visual joins from md up.
 *
 * `media` takes any node — an illustration, a chart, or an image — so the
 * pattern is reusable outside this page.
 */
export default function MediaSplit({
  media,
  side = "end",
  aspect = "aspect-4/3",
  children,
}: {
  media: ReactNode;
  /** Which side the visual sits on from `lg` up. */
  side?: "start" | "end";
  aspect?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid items-center gap-6 lg:grid-cols-2 lg:gap-10">
      <div className={side === "start" ? "lg:order-2" : undefined}>{children}</div>
      <div
        className={[
          "hidden items-center justify-center rounded-3xl app-panel p-6 sm:p-8 md:flex",
          aspect,
          side === "start" ? "lg:order-1" : "",
        ].join(" ")}
      >
        {media}
      </div>
    </div>
  );
}
