import { redirect } from "next/navigation";
import { createLocalePath, type Locale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";

export async function getCurrentViewerRole() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      user: null,
      isAdmin: false,
    };
  }

  const { data: adminRecord, error: adminError } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    supabase,
    user,
    isAdmin: !adminError && Boolean(adminRecord),
  };
}

export async function requireAdmin(locale: Locale) {
  const context = await getCurrentViewerRole();

  if (!context.user) {
    redirect(createLocalePath(locale, "/login"));
  }

  if (!context.isAdmin) {
    redirect(createLocalePath(locale, "/my-space"));
  }

  return context;
}
