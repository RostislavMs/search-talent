"use client";

import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes, Ref, ReactNode } from "react";
import { useCurrentLocale } from "@/lib/i18n/client";
import { createLocalePath } from "@/lib/i18n/config";

type LocalizedLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  keyof LinkProps
> &
  LinkProps & {
    children: ReactNode;
    ref?: Ref<HTMLAnchorElement>;
  };

export default function LocalizedLink({
  children,
  href,
  ref,
  ...props
}: LocalizedLinkProps) {
  const locale = useCurrentLocale();
  const localizedHref =
    typeof href === "string" ? createLocalePath(locale, href) : href;

  return (
    <Link href={localizedHref} ref={ref} {...props}>
      {children}
    </Link>
  );
}
