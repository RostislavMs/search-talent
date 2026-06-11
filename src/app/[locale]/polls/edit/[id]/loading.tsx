export default function Loading() {
  return (
    <main className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="h-[28rem] animate-pulse rounded-panel bg-[color:var(--surface-muted)]" />
        <div className="h-96 animate-pulse rounded-panel bg-[color:var(--surface-muted)]" />
      </div>
    </main>
  );
}
