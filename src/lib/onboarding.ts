import { projectKinds, type ProjectKind } from "@/lib/projects";
import { needsOwnUsername } from "@/lib/username";

export const onboardingSteps = ["profile", "project", "share"] as const;

export type OnboardingStep = (typeof onboardingSteps)[number];

/** Skills we suggest picking on the first step. Advice, not a hard limit. */
export const ONBOARDING_SUGGESTED_SKILLS = { min: 3, max: 5 } as const;
/** Upper bound the onboarding endpoint accepts for the skills list. */
export const ONBOARDING_MAX_SKILLS = 30;

export function isOnboardingStep(value: unknown): value is OnboardingStep {
  return typeof value === "string" && onboardingSteps.includes(value as OnboardingStep);
}

/** Accepts a step name or its 1-based number (`?step=2`). */
export function parseOnboardingStep(value: unknown): OnboardingStep | null {
  if (isOnboardingStep(value)) {
    return value;
  }

  if (typeof value === "string" && /^[1-9]$/.test(value)) {
    return onboardingSteps[Number(value) - 1] ?? null;
  }

  return null;
}

export function getOnboardingStepNumber(step: OnboardingStep) {
  return onboardingSteps.indexOf(step) + 1;
}

export function getNextOnboardingStep(step: OnboardingStep): OnboardingStep | null {
  return onboardingSteps[onboardingSteps.indexOf(step) + 1] ?? null;
}

export function getPreviousOnboardingStep(step: OnboardingStep): OnboardingStep | null {
  const index = onboardingSteps.indexOf(step);
  return index > 0 ? onboardingSteps[index - 1] : null;
}

export type OnboardingChecklistInput = {
  username: string | null;
  email: string | null;
  name: string | null;
  categoryId: number | null;
  skillsCount: number;
  publishedProjectsCount: number;
  /** Null when unknown (the onboarding table is not there yet). */
  linkShared: boolean | null;
};

export type OnboardingChecklistItem = {
  key: OnboardingStep;
  done: boolean;
};

export type OnboardingChecklist = {
  items: OnboardingChecklistItem[];
  doneCount: number;
  allDone: boolean;
  /** The nick is temporary or copied from the email — worth its own hint. */
  needsUsername: boolean;
};

/**
 * The newcomer checklist in "My Space" and the onboarding progress: the same
 * three things as the onboarding steps.
 *
 * The profile counts as set up once it has a name, the person's own nick, a
 * direction and at least one skill — enough for the portfolio to say who it
 * belongs to. The rest of the profile is tracked by the completeness meter.
 */
export function getOnboardingChecklist(input: OnboardingChecklistInput): OnboardingChecklist {
  const needsUsername = needsOwnUsername(input.username, input.email);
  const profileDone =
    Boolean(input.name?.trim()) &&
    !needsUsername &&
    input.categoryId !== null &&
    input.skillsCount > 0;

  const items: OnboardingChecklistItem[] = [
    { key: "profile", done: profileDone },
    { key: "project", done: input.publishedProjectsCount > 0 },
    { key: "share", done: input.linkShared === true },
  ];
  const doneCount = items.filter((item) => item.done).length;

  return {
    items,
    doneCount,
    allDone: doneCount === items.length,
    needsUsername,
  };
}

/**
 * Which step the onboarding opens on: the one asked for in the URL, otherwise
 * the first thing still to do (the profile when everything is done, so the
 * page never opens on an empty "all set" state by itself).
 */
export function getInitialOnboardingStep(
  requested: unknown,
  checklist: OnboardingChecklist,
): OnboardingStep {
  const parsed = parseOnboardingStep(requested);

  if (parsed) {
    return parsed;
  }

  return checklist.items.find((item) => !item.done)?.key ?? "profile";
}

/**
 * Project kinds offered on the "first project" step. Code is first in the list
 * and is the one kind with a real import (GitHub, GitLab).
 */
export const ONBOARDING_PROJECT_KINDS: readonly ProjectKind[] = projectKinds;

/**
 * Link into the project wizard with the kind already chosen. `from=onboarding`
 * makes the wizard bring the person back to the share step after publishing.
 * The import panels live on the wizard's second step, so an import starts
 * there.
 */
export function buildOnboardingProjectHref(
  kind: ProjectKind,
  options: { importFirst?: boolean } = {},
) {
  const params = new URLSearchParams({ kind, from: "onboarding" });

  if (options.importFirst) {
    params.set("step", "2");
  }

  return `/projects/new?${params.toString()}`;
}
