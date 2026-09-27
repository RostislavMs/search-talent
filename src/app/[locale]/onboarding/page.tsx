import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import OnboardingFlow from "@/components/onboarding/onboarding-flow";
import { buildLoginHref } from "@/lib/auth/redirect";
import { getOnboardingSnapshot, getProfileMeta } from "@/lib/db/onboarding";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isProviderConfigured } from "@/lib/integrations/provider-registry";
import { getInitialOnboardingStep } from "@/lib/onboarding";
import { buildMetadata, getSiteUrl } from "@/lib/seo";
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
    pathname: "/onboarding",
    title: dictionary.metadata.onboarding.title,
    description: dictionary.metadata.onboarding.description,
    noindex: true,
  });
}

/** The display name Google or GitHub gave us, offered when the profile has none. */
function getProviderName(metadata: Record<string, unknown> | undefined) {
  const value = metadata?.full_name ?? metadata?.name;
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : null;
}

export default async function OnboardingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ step?: string | string[] }>;
}) {
  const locale = await getLocaleValue(params);
  const { step } = await searchParams;
  const snapshot = await getOnboardingSnapshot();

  if (!snapshot) {
    redirect(buildLoginHref(locale, "/onboarding"));
  }

  const supabase = await createClient();
  const meta = await getProfileMeta(supabase);
  const { profile, checklist, completeness, publishedProjectsCount, user } = snapshot;
  const username = profile.username ?? "";
  // The code import is offered only when at least one provider can actually
  // connect; without OAuth keys the wizard hides the import panels anyway.
  const codeImportAvailable =
    Boolean(process.env.GITHUB_OAUTH_CLIENT_ID && process.env.GITHUB_OAUTH_CLIENT_SECRET) ||
    isProviderConfigured("gitlab");

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <OnboardingFlow
        initialStep={getInitialOnboardingStep(typeof step === "string" ? step : null, checklist)}
        checklist={checklist}
        completeness={completeness}
        profile={{
          name: profile.name || getProviderName(user.user_metadata) || "",
          username,
          usernameIsTemporary: isTemporaryUsername(username),
          categoryId: profile.category_id,
          skillIds: profile.skill_ids,
        }}
        meta={meta}
        profileUrl={new URL(`/u/${username}`, getSiteUrl()).toString()}
        codeImportAvailable={codeImportAvailable}
        hasPublishedProject={publishedProjectsCount > 0}
      />
    </main>
  );
}
