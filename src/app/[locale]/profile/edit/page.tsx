import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { notFound, redirect } from "next/navigation";
import AvatarUpload from "@/components/avatar-upload";
import CoverUpload from "@/components/cover-upload";
import DeleteAccountSection from "@/components/delete-account-section";
import EmailVerificationButton from "@/components/email-verification-button";
import GithubIntegrationCard from "@/components/github-integration-card";
import { ButtonLink } from "@/components/ui/Button";

const ProfileForm = dynamic(() => import("@/components/profile-form"), {
  loading: () => (
    <div className="animate-pulse space-y-6 py-4">
      <div className="h-10 w-1/3 rounded-xl bg-[color:var(--surface-muted)]" />
      <div className="h-40 rounded-xl bg-[color:var(--surface-muted)]" />
    </div>
  ),
});
import { getMyProfile } from "@/lib/db/profile";
import { createLocalePath, isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

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
    pathname: "/profile/edit",
    title: dictionary.metadata.dashboardProfile.title,
    description: dictionary.metadata.dashboardProfile.description,
    noindex: true,
  });
}

export default async function ProfileEditPage({
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
    redirect(createLocalePath(locale, "/login"));
  }

  const dictionary = getDictionary(locale);
  const profile = await getMyProfile();

  if (!profile) {
    return (
      <main className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6">
        <section className="rounded-hero app-card p-8">
          <h1 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
            {dictionary.dashboardProfile.profileNotFound}
          </h1>
          <div className="mt-6">
            <ButtonLink href="/dashboard" variant="ghost">
              {dictionary.dashboardProfile.backToDashboard}
            </ButtonLink>
          </div>
        </section>
      </main>
    );
  }

  const publicProfileHref = profile.username
    ? `/u/${profile.username}`
    : "/dashboard";
  const fallbackText = (profile.name || profile.username || user.email || "U")
    .slice(0, 1)
    .toUpperCase();

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6">
      <section className="rounded-hero app-card p-8 sm:p-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.dashboardProfile.eyebrow}
            </p>
            <h1 className="font-display mt-3 text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
              {dictionary.dashboardProfile.title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 app-muted">
              {dictionary.dashboardProfile.description}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/dashboard" variant="ghost">
              {dictionary.dashboardProfile.backToDashboard}
            </ButtonLink>
            <ButtonLink href={publicProfileHref} variant="secondary">
              {dictionary.dashboardProfile.viewPublicProfile}
            </ButtonLink>
          </div>
        </div>

        <AvatarUpload
          userId={profile.user_id}
          currentAvatarUrl={profile.avatar_url || null}
          fallbackText={fallbackText}
        />

        <CoverUpload
          userId={profile.user_id}
          currentCoverUrl={profile.cover_url || null}
        />

        <div className="mt-6 flex items-center gap-4">
          <p className="text-sm font-medium text-[color:var(--foreground)]">
            {dictionary.emailVerification.sectionTitle}
          </p>
          <EmailVerificationButton
            initialVerified={profile.email_verified ?? false}
          />
        </div>
      </section>

      <section className="mt-8 rounded-hero app-card p-6 sm:p-8">
        <ProfileForm profile={profile} />
      </section>

      <div className="mt-8">
        <GithubIntegrationCard returnTo="/profile/edit" />
      </div>

      <DeleteAccountSection email={user.email ?? ""} />
    </main>
  );
}
