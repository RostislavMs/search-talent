import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { notFound, redirect } from "next/navigation";
import AvatarUpload from "@/components/avatar-upload";
import EmailVerificationButton from "@/components/email-verification-button";
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
      <main className="mx-auto max-w-[90rem] px-0 py-4 sm:px-6 sm:py-12">
        <section className="rounded-none app-card p-4 sm:rounded-hero sm:p-8">
          <h1 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
            {dictionary.dashboardProfile.profileNotFound}
          </h1>
        </section>
      </main>
    );
  }

  const publicProfileHref = profile.username
    ? `/u/${profile.username}`
    : "/my-space";
  const fallbackText = (profile.name || profile.username || user.email || "U")
    .slice(0, 1)
    .toUpperCase();

  return (
    <main className="mx-auto max-w-[90rem] px-0 py-4 sm:px-6 sm:py-10">
      <section className="rounded-none app-card p-4 sm:rounded-hero sm:p-6">
        <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.dashboardProfile.eyebrow}
            </p>
            <h1 className="font-display mt-2 text-xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-2xl">
              {dictionary.dashboardProfile.title}
            </h1>
            <p className="mt-2 hidden max-w-2xl text-sm leading-6 app-muted sm:block">
              {dictionary.dashboardProfile.description}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <ButtonLink href={publicProfileHref} variant="secondary">
              {dictionary.dashboardProfile.viewPublicProfile}
            </ButtonLink>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-4">
          <AvatarUpload
            userId={profile.user_id}
            currentAvatarUrl={profile.avatar_url || null}
            fallbackText={fallbackText}
          />

          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-[color:var(--foreground)]">
              {dictionary.emailVerification.sectionTitle}
            </p>
            <EmailVerificationButton
              initialVerified={profile.email_verified ?? false}
            />
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-none app-card p-4 sm:mt-8 sm:rounded-hero sm:p-8">
        <ProfileForm profile={profile} email={user.email ?? ""} />
      </section>
    </main>
  );
}
