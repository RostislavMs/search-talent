export default function Loading() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="rounded-hero app-card p-6 sm:p-8">
        <div className="h-10 w-3/4 animate-pulse rounded-xl bg-[color:var(--surface-muted)]" />
        <div className="mt-5 h-5 w-1/2 animate-pulse rounded-lg bg-[color:var(--surface-muted)]" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-12 animate-pulse rounded-2xl bg-[color:var(--surface-muted)]"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
