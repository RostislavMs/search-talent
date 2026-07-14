import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * React-cached lookup of the authenticated user. Wrapping it in `cache()`
 * dedupes the underlying `supabase.auth.getUser()` within a single request,
 * so a page can check auth state (e.g. to pick the right hero CTA) without
 * piling on extra auth-server calls when other server components already
 * resolved the viewer.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
