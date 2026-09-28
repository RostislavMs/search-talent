"use client";

import { useCallback, useRef, useState } from "react";
import OnboardingProfileStep, {
  type OnboardingProfileInitial,
} from "@/components/onboarding/profile-step";
import OnboardingProjectStep from "@/components/onboarding/project-step";
import OnboardingShareStep from "@/components/onboarding/share-step";
import ProfileCompletenessButton from "@/components/profile-completeness-button";
import { apiFetch } from "@/lib/api-client";
import type { MetaOption } from "@/lib/db/onboarding";
import type { OpenToOption } from "@/lib/open-to";
import { useDictionary, useLocalizedRouter } from "@/lib/i18n/client";
import {
  getNextOnboardingStep,
  getOnboardingStepNumber,
  getPreviousOnboardingStep,
  onboardingSteps,
  type OnboardingChecklist,
  type OnboardingStep,
} from "@/lib/onboarding";
import type { ProfileCompletenessBreakdown } from "@/lib/profile-completeness";

export type OnboardingFlowProps = {
  initialStep: OnboardingStep;
  checklist: OnboardingChecklist;
  completeness: ProfileCompletenessBreakdown;
  profile: OnboardingProfileInitial;
  meta: { categories: MetaOption[]; skills: MetaOption[] };
  profileUrl: string;
  openTo: { value: OpenToOption[]; updatedAt: string | null };
  codeImportAvailable: boolean;
  hasPublishedProject: boolean;
};

/**
 * Three skippable steps after the first sign-in: who you are, the first
 * project, sharing the link. The step lives in the URL (`?step=`) so the
 * project wizard can send people back to the right place, and "My Space" can
 * link straight to any step.
 */
export default function OnboardingFlow({
  initialStep,
  checklist,
  completeness,
  profile,
  meta,
  profileUrl,
  openTo,
  codeImportAvailable,
  hasPublishedProject,
}: OnboardingFlowProps) {
  const dictionary = useDictionary();
  const t = dictionary.onboarding;
  const router = useLocalizedRouter();
  const [step, setStep] = useState<OnboardingStep>(initialStep);
  const [leaving, setLeaving] = useState(false);
  const sharedRef = useRef(checklist.items.find((item) => item.key === "share")?.done ?? false);

  const goTo = useCallback((next: OnboardingStep) => {
    setStep(next);
    window.history.replaceState(null, "", `?step=${next}`);
    window.scrollTo({ top: 0 });
  }, []);

  const goNext = useCallback(() => {
    const next = getNextOnboardingStep(step);

    if (next) {
      goTo(next);
    }
  }, [goTo, step]);

  const goBack = useCallback(() => {
    const previous = getPreviousOnboardingStep(step);

    if (previous) {
      goTo(previous);
    }
  }, [goTo, step]);

  // Finishing and "finish later" both stop the automatic redirect here after
  // sign-in; what is still undone stays on the checklist in "My Space".
  const leave = useCallback(async () => {
    if (leaving) {
      return;
    }

    setLeaving(true);
    await apiFetch("/api/onboarding", { method: "POST", body: { action: "completed" } });
    router.push("/my-space");
    router.refresh();
  }, [leaving, router]);

  const handleShared = useCallback(() => {
    if (sharedRef.current) {
      return;
    }

    sharedRef.current = true;
    void apiFetch("/api/onboarding", { method: "POST", body: { action: "link_shared" } });
  }, []);

  const stepNumber = getOnboardingStepNumber(step);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm app-muted">
          {t.stepOf
            .replace("{current}", String(stepNumber))
            .replace("{total}", String(onboardingSteps.length))}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ProfileCompletenessButton
            completeness={completeness}
            locale={router.locale}
            editHref={`/${router.locale}/profile/edit`}
          />
          <button
            type="button"
            onClick={leave}
            disabled={leaving}
            className="cursor-pointer rounded-full px-3 py-1.5 text-sm app-muted transition-colors hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)] disabled:opacity-60"
          >
            {t.later}
          </button>
        </div>
      </div>

      <nav aria-label={t.stepOf.replace("{current}", String(stepNumber)).replace("{total}", String(onboardingSteps.length))}>
        <ol className="grid grid-cols-3 gap-2 sm:gap-3">
          {onboardingSteps.map((key) => {
            const done = checklist.items.find((item) => item.key === key)?.done ?? false;
            const current = key === step;

            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => goTo(key)}
                  aria-current={current ? "step" : undefined}
                  className="group flex w-full cursor-pointer flex-col gap-2 text-left"
                >
                  <span
                    className={`h-1 w-full rounded-full transition-colors ${
                      current || done
                        ? "bg-[color:var(--brand)]"
                        : "bg-[color:var(--surface-muted)] group-hover:bg-[color:var(--border)]"
                    }`}
                    aria-hidden="true"
                  />
                  <span
                    className={`text-xs sm:text-sm ${
                      current
                        ? "font-semibold text-[color:var(--foreground)]"
                        : "app-muted group-hover:text-[color:var(--foreground)]"
                    }`}
                  >
                    {done ? <span aria-hidden="true">✓ </span> : null}
                    {t.steps[key]}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <section className="rounded-hero app-card p-5 sm:p-8">
        {step === "profile" ? (
          <OnboardingProfileStep
            initial={profile}
            meta={meta}
            onDone={() => {
              router.refresh();
              goNext();
            }}
            onSkip={goNext}
          />
        ) : null}

        {step === "project" ? (
          <OnboardingProjectStep
            codeImportAvailable={codeImportAvailable}
            hasPublishedProject={hasPublishedProject}
            onBack={goBack}
            onSkip={goNext}
          />
        ) : null}

        {step === "share" ? (
          <OnboardingShareStep
            profileUrl={profileUrl}
            openTo={openTo}
            username={profile.username}
            usernameIsTemporary={profile.usernameIsTemporary}
            hasPublishedProject={hasPublishedProject}
            finishing={leaving}
            onShared={handleShared}
            onGoTo={goTo}
            onBack={goBack}
            onFinish={leave}
          />
        ) : null}
      </section>
    </div>
  );
}
