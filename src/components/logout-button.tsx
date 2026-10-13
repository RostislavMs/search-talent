"use client";

import { Button } from "@/components/ui/Button";
import { useDictionary, useLocalizedHref } from "@/lib/i18n/client";

export default function LogoutButton({ className = "" }: { className?: string }) {
  const dictionary = useDictionary();
  const loginHref = useLocalizedHref("/login");

  const handleLogout = async () => {
    try {
      // Loaded on click: the button sits in the header of every page, and a
      // static import shipped the whole Supabase SDK (~55KB) to every visitor.
      const { createClient } = await import("@/lib/supabase/client");
      await createClient().auth.signOut();
      await fetch("/api/auth/logout", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
      });
    } finally {
      window.location.assign(loginHref);
    }
  };

  return (
    <Button
      onClick={handleLogout}
      variant="secondary"
      size="sm"
      className={className}
    >
      {dictionary.nav.logout}
    </Button>
  );
}
