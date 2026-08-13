"use client";

import LocalizedLink from "@/components/ui/localized-link";
import { useDictionary } from "@/lib/i18n/client";

const linkClassName =
  "underline decoration-[color:var(--border)] underline-offset-4 hover:text-[color:var(--foreground)]";

/** Terms/privacy consent line shown inside the auth forms. */
export default function AuthLegalNote({ className }: { className?: string }) {
  const legal = useDictionary().auth.legal;

  return (
    <p
      className={["text-xs leading-5 app-muted", className]
        .filter(Boolean)
        .join(" ")}
    >
      {legal.prefix}{" "}
      <LocalizedLink href="/terms" className={linkClassName}>
        {legal.terms}
      </LocalizedLink>{" "}
      {legal.and}{" "}
      <LocalizedLink href="/privacy" className={linkClassName}>
        {legal.privacy}
      </LocalizedLink>
      .
    </p>
  );
}
