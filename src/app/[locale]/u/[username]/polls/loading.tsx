export default function Loading() {
  return (
    <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 sm:py-10">
      <div className="h-44 animate-pulse rounded-hero bg-[color:var(--surface-muted)]" />
      <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-64 animate-pulse rounded-hero bg-[color:var(--surface-muted)]"
          />
        ))}
      </div>
    </main>
  );
}
