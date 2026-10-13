import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import MessagingSettingsForm from "@/components/messaging-settings-form";
import LocalizedLink from "@/components/ui/localized-link";
import { buildLoginHref } from "@/lib/auth/redirect";
import { getMessagingSettings, listMessageBlocks } from "@/lib/db/messages";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { MESSAGES_PATH, MESSAGES_SETTINGS_PATH } from "@/lib/messages";
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
  const copy = getDictionary(locale).messages;

  return buildMetadata({
    locale,
    pathname: MESSAGES_SETTINGS_PATH,
    title: copy.meta.settingsTitle,
    description: copy.settingsPage.description,
    noindex: true,
  });
}

export default async function MessagesSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildLoginHref(locale, MESSAGES_SETTINGS_PATH));
  }

  const copy = getDictionary(locale).messages.settingsPage;
  const [settings, blocks] = await Promise.all([getMessagingSettings(supabase), listMessageBlocks(supabase)]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <LocalizedLink
        href={MESSAGES_PATH}
        className="text-sm app-muted transition-colors hover:text-[color:var(--foreground)]"
      >
        ← {copy.back}
      </LocalizedLink>
      <header className="mt-4 mb-8">
        <h1 className="font-display text-3xl font-medium tracking-tight text-[color:var(--foreground)]">{copy.title}</h1>
      </header>
      <MessagingSettingsForm initialSettings={settings} initialBlocks={blocks} />
    </main>
  );
}
