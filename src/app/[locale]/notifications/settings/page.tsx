import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import EmailSettingsForm from "@/components/email-settings-form";
import LocalizedLink from "@/components/ui/localized-link";
import { buildLoginHref } from "@/lib/auth/redirect";
import { getNotificationPreferences } from "@/lib/db/email-preferences";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { NOTIFICATION_SETTINGS_PATH } from "@/lib/messages";
import { buildMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function resolveLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const copy = getDictionary(locale).emailSettings.meta;

  return buildMetadata({
    locale,
    pathname: NOTIFICATION_SETTINGS_PATH,
    title: copy.title,
    description: copy.description,
    noindex: true,
  });
}

/** Which emails the person gets: messages, followers, and a way to the job alerts. */
export default async function EmailSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildLoginHref(locale, NOTIFICATION_SETTINGS_PATH));
  }

  const copy = getDictionary(locale).emailSettings;
  const preferences = await getNotificationPreferences(supabase);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <LocalizedLink
        href="/notifications"
        className="text-sm app-muted transition-colors hover:text-[color:var(--foreground)]"
      >
        ← {copy.back}
      </LocalizedLink>
      <header className="mt-4 mb-8">
        <h1 className="font-display text-3xl font-medium tracking-tight text-[color:var(--foreground)]">{copy.title}</h1>
        <p className="mt-1 text-sm app-muted">{copy.description}</p>
      </header>
      <EmailSettingsForm initialPreferences={preferences} />
    </main>
  );
}
