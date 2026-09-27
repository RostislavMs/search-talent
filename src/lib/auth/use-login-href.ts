"use client";

import { usePathname } from "next/navigation";
import { buildLoginHref } from "@/lib/auth/redirect";
import { getLocaleFromPathname } from "@/lib/i18n/config";

/**
 * `/uk/login?next=<this page>`, so a guest who signs in to comment, vote or
 * save lands back where they were. On the auth screens themselves it is the
 * plain login link (`buildLoginHref` drops auth routes from `next`).
 */
export function useLoginHref() {
  const pathname = usePathname();
  return buildLoginHref(getLocaleFromPathname(pathname), pathname);
}
