import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DiscussionList from "@/components/discussion-list";
import { ButtonLink } from "@/components/ui/Button";
import { getDiscussionsListing } from "@/lib/db/discussions";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isPublicModerationStatus } from "@/lib/moderation";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { buildMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getRouteParams(
  params: Promise<{ locale: string; username: string }>,
) {
  const { locale, username } = await params;
  if (!isLocale(locale)) notFound();
  return { locale: locale as Locale, username };
}

async function loadProfile(username: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("user_id, name, username, moderation_status")
    .eq("username", username)
    .maybeSingle();

  return data as {
    user_id: string;
    name: string | null;
    username: string | null;
    moderation_status: string | null;
  } | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; username: string }>;
}): Promise<Metadata> {
  const { locale, username } = await getRouteParams(params);
  const dictionary = getDictionary(locale);

  return buildMetadata({
    locale,
    pathname: `/u/${username}/discussions`,
    title: `${dictionary.discussions.pageTitle} — @${username}`,
    description: dictionary.discussions.pageMetaDescription,
    // Topics are noindex everywhere; a per-author list of them is no different.
    noindex: true,
  });
}

export default async function UserDiscussionsPage({
  params,
}: {
  params: Promise<{ locale: string; username: string }>;
}) {
  const { locale, username } = await getRouteParams(params);
  const [profile, viewer] = await Promise.all([
    loadProfile(username),
    getCurrentViewerRole(),
  ]);

  if (!profile) {
    notFound();
  }

  const isOwner = viewer.user?.id === profile.user_id;

  if (!isOwner && !isPublicModerationStatus(profile.moderation_status)) {
    notFound();
  }

  const dictionary = getDictionary(locale);
  const ui = dictionary.discussions;
  // Drafts are only ever loaded for the signed-in viewer, so an owner sees
  // their unfinished topics here and a visitor never does.
  const listing = await getDiscussionsListing({
    kind: "topic",
    authorUserId: profile.user_id,
  });

  const displayName = profile.name?.trim() || `@${username}`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <section className="rounded-hero app-card p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
          {ui.pageEyebrow}
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-4xl">
              {isOwner ? ui.myTitle : `${ui.pageTitle} — ${displayName}`}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 app-muted sm:text-base">
              {ui.myDescription}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isOwner ? (
              <ButtonLink href="/discussions/new">{ui.startTopic}</ButtonLink>
            ) : null}
            <ButtonLink href="/discussions" variant="secondary">
              {ui.pageTitle}
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="mt-6">
        {listing.items.length > 0 ? (
          <DiscussionList items={listing.items} locale={locale} />
        ) : (
          <p className="rounded-panel app-panel-dashed p-6 text-sm app-muted">
            {ui.myEmpty}
          </p>
        )}
      </section>
    </main>
  );
}
