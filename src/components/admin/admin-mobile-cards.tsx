import type { ReactNode } from "react";

// Shared responsive primitives for admin tables. Each admin list renders a
// real <table> on md+ (`hidden md:block`) and a stack of these cards on small
// screens (`md:hidden`) so nothing overflows the viewport horizontally.

export function AdminCardList({ children }: { children: ReactNode }) {
  return <div className="space-y-3 md:hidden">{children}</div>;
}

export function AdminCard({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border app-border p-4">{children}</div>
  );
}

// A compact muted meta line, optionally prefixed with an uppercase label.
export function AdminCardMeta({
  label,
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <p className="text-xs app-muted">
      {label ? (
        <span className="font-semibold uppercase tracking-eyebrow app-soft">
          {label}:{" "}
        </span>
      ) : null}
      {children}
    </p>
  );
}

export function AdminCardActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 pt-1">{children}</div>;
}
