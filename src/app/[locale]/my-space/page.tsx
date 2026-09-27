import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import MySpaceChecklist from "@/components/my-space-checklist";
import MySpaceStats from "@/components/my-space-stats";
import ProfileCompletenessButton from "@/components/profile-completeness-button";
import { buildLoginHref } from "@/lib/auth/redirect";
import { getOnboardingSnapshot } from "@/lib/db/onboarding";
import { getUserStats } from "@/lib/db/stats";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { buildMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { isTemporaryUsername } from "@/lib/username";

async function getLocaleValue(params: Promise<{ locale: string }>) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

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
    pathname: "/my-space",
    title: dictionary.metadata.mySpace.title,
    description: dictionary.metadata.mySpace.description,
    noindex: true,
  });
}

export default async function MySpacePage({
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
    redirect(buildLoginHref(locale, "/my-space"));
  }

  const dictionary = getDictionary(locale);
  const [viewer, userStats, onboarding] = await Promise.all([
    getCurrentViewerRole(),
    getUserStats(user.id),
    getOnboardingSnapshot(),
  ]);
  const usernameHint = onboarding?.checklist.needsUsername
    ? isTemporaryUsername(onboarding.profile.username)
      ? dictionary.mySpace.usernameTemporary
      : dictionary.mySpace.usernameFromEmail
    : null;

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
            {dictionary.mySpace.title}
          </h1>
          <p className="mt-1 text-sm app-muted">
            {dictionary.mySpace.description}
          </p>
        </div>
        {onboarding ? (
          <ProfileCompletenessButton
            completeness={onboarding.completeness}
            locale={locale}
            editHref={`/${locale}/profile/edit`}
          />
        ) : null}
      </div>

      {onboarding ? (
        <div className="mb-8">
          <MySpaceChecklist
            checklist={onboarding.checklist}
            usernameHint={usernameHint}
            dictionary={dictionary}
          />
        </div>
      ) : null}

      <MySpaceStats
        dictionary={dictionary}
        locale={locale}
        userStats={userStats}
        isAdmin={viewer.isAdmin}
      />
    </main>
  );
}
