"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isAuthRoute } from "@/lib/auth-routes";
import { isMessagesScreen } from "@/lib/messages";

export default function SiteFooterSlot({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Sign-in screens fit one viewport; the messages fill it edge to edge.
  if (isAuthRoute(pathname) || isMessagesScreen(pathname)) {
    return null;
  }

  return <>{children}</>;
}
