"use client";

import { useDictionary } from "@/lib/i18n/client";

/** Separates the social sign-in row from the email/password form. */
export default function AuthDivider({ className }: { className?: string }) {
  const dictionary = useDictionary();

  return (
    <div
      className={["flex items-center gap-3", className].filter(Boolean).join(" ")}
    >
      <span className="h-px flex-1 bg-[color:var(--border)]" />
      <span className="text-xs app-muted">{dictionary.auth.oauth.divider}</span>
      <span className="h-px flex-1 bg-[color:var(--border)]" />
    </div>
  );
}
