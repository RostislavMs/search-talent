import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultLocale, isLocale, type Locale } from "@/lib/i18n/config";

export type EmailRecipient = {
  email: string;
  locale: Locale;
  /** The profile name, else the nick; empty when there is neither. */
  name: string;
  emailConfirmed: boolean;
};

/**
 * Where and how to write to a person: the account email, the language they
 * signed up in and their name. Needs the service key. Null without an email.
 */
export async function loadEmailRecipient(
  admin: SupabaseClient,
  userId: string,
): Promise<EmailRecipient | null> {
  const [{ data: auth }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("profiles").select("name, username").eq("user_id", userId).maybeSingle(),
  ]);

  const email = auth?.user?.email;

  if (!email) {
    return null;
  }

  const rawLocale = auth?.user?.user_metadata?.locale as string | undefined;
  const person = profile as { name: string | null; username: string | null } | null;

  return {
    email,
    locale: rawLocale && isLocale(rawLocale) ? rawLocale : defaultLocale,
    name: person?.name?.trim() || person?.username || "",
    emailConfirmed: Boolean(auth?.user?.email_confirmed_at),
  };
}
