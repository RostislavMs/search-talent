"use client";

// The project-detail hero cover. Shown at its natural (author-chosen) aspect
// ratio so the framing set in the cover editor is never re-cropped, capped by
// max-h-[70vh]. This is a client component only because the download-deterrent
// (`onContextMenu` / non-draggable) needs an event handler — a Server Component
// cannot pass a function to a DOM element.
export default function ProjectCoverHero({
  src,
  alt,
  isProtected,
}: {
  src: string;
  alt: string;
  isProtected: boolean;
}) {
  return (
    <div
      className="flex w-full items-center justify-center"
      onContextMenu={isProtected ? (event) => event.preventDefault() : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={!isProtected}
        className={`block h-auto max-h-[60vh] w-full object-contain ${
          isProtected ? "pointer-events-none select-none" : ""
        }`}
      />
    </div>
  );
}
