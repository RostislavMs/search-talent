import type { ReactNode } from "react";
import LocalizedLink from "@/components/ui/localized-link";
import type { Locale } from "@/lib/i18n/config";

/**
 * Frame shared by every auto-promoted discussion page. The page owns nothing of
 * its own — it is the parent content's comment thread at its own URL — so the
 * header names the parent and links straight back to it.
 */
export default function DiscussionPageShell({
  parentHref,
  parentTitle,
  backLabel,
  children,
}: {
  /** Kept so callers stay uniform; the shell itself has no copy to localize. */
  locale: Locale;
  parentHref: string;
  parentTitle: string;
  backLabel: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <LocalizedLink
        href={parentHref}
        className="text-sm app-muted transition-colors hover:text-[color:var(--foreground)]"
      >
        ← {backLabel}
      </LocalizedLink>

      <header className="mt-4 mb-8">
        <h1 className="font-display text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
          <LocalizedLink
            href={parentHref}
            className="transition-colors hover:text-[color:var(--brand)]"
          >
            {parentTitle}
          </LocalizedLink>
        </h1>
      </header>

      {children}
    </main>
  );
}
