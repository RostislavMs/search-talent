export default function LocalizedLoading() {
  return (
    <main
      className="mx-auto flex w-full max-w-[90rem] flex-1 items-center justify-center px-4 py-20"
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
