"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isAuthRoute } from "@/lib/auth-routes";

export default function SiteFooterSlot({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (isAuthRoute(pathname)) {
    return null;
  }

  return <>{children}</>;
}
