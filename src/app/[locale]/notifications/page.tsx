import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  hydrateNotificationActors,
  listNotifications,
  markNotificationsAsRead,
} from "@/lib/db/notifications";
import { buildLoginHref } from "@/lib/auth/redirect";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import NotificationsList from "@/components/notifications-list";
import LocalizedLink from "@/components/ui/localized-link";
import { NOTIFICATION_SETTINGS_PATH } from "@/lib/messages";
import CoAuthorInvitations from "@/components/co-author-invitations";
import CompanyInvitations from "@/components/company-invitations";

async function getLocaleValue(params: Promise<{ locale: string }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = await getLocaleValue(params);
  const dictionary = getDictionary(locale);

  return buildMetadata({
    locale,
    pathname: "/notifications",
    title: dictionary.notifications.pageTitle,
    description: dictionary.notifications.pageDescription,
    noindex: true,
  });
}

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await getLocaleValue(params);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildLoginHref(locale, "/notifications"));
  }

  const dictionary = getDictionary(locale);

  const initial = await listNotifications(supabase, {
    recipientUserId: user.id,
  });
  const hydrated = await hydrateNotificationActors(supabase, initial);

  // Mark them as read once viewed on the dedicated page. We do not
  // throw on failure — the list is still rendered.
  await markNotificationsAsRead(supabase, {
    recipientUserId: user.id,
    all: true,
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
            {dictionary.notifications.pageTitle}
          </h1>
          <p className="mt-1 text-sm app-muted">
            {dictionary.notifications.pageDescription}
          </p>
        </div>
        <LocalizedLink
          href={NOTIFICATION_SETTINGS_PATH}
          className="rounded-full px-3 py-1.5 text-sm font-medium app-soft transition-colors hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]"
        >
          {dictionary.emailSettings.openLink}
        </LocalizedLink>
      </header>

      <CoAuthorInvitations locale={locale} />
      <CompanyInvitations />

      <NotificationsList
        locale={locale}
        initialItems={hydrated}
        emptyLabel={dictionary.notifications.empty}
      />
    </main>
  );
}
