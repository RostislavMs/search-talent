/**
 * The first fallback of every page: the shell streams with it while the page's
 * data loads. It fills the screen so the footer starts below the fold — a short
 * spinner let the footer show on first paint, and the arriving page then pushed
 * it off screen (CLS 0.65 on phones).
 */
export default function LocalizedLoading() {
  return (
    <main
      className="mx-auto flex min-h-svh w-full max-w-[90rem] flex-1 items-center justify-center px-4 py-20"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-[color:var(--border)] border-t-[color:var(--foreground)]"
          aria-hidden="true"
        />
        <span className="sr-only">Loading</span>
      </div>
    </main>
  );
}
