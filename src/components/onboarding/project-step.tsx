"use client";

import { Button } from "@/components/ui/Button";
import { buttonStyles } from "@/components/ui/button-styles";
import LocalizedLink from "@/components/ui/localized-link";
import { useDictionary } from "@/lib/i18n/client";
import { ONBOARDING_PROJECT_KINDS, buildOnboardingProjectHref } from "@/lib/onboarding";
import { getProjectKindLabel } from "@/lib/projects";

/**
 * The first project: import code, or pick what kind of work it is and land in
 * the regular project wizard with that kind already chosen. The wizard itself
 * is unchanged; after publishing it brings the person back to the share step.
 */
export default function OnboardingProjectStep({
  codeImportAvailable,
  hasPublishedProject,
  onBack,
  onSkip,
}: {
  codeImportAvailable: boolean;
  hasPublishedProject: boolean;
  onBack: () => void;
  onSkip: () => void;
}) {
  const dictionary = useDictionary();
  const t = dictionary.onboarding;
  const copy = t.project;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
          {copy.title}
        </h1>
        <p className="text-sm leading-6 app-muted">{copy.description}</p>
      </div>

      {hasPublishedProject ? (
        <p className="rounded-2xl app-panel px-4 py-3 text-sm text-[color:var(--foreground)]">
          <span aria-hidden="true">✓ </span>
          {copy.alreadyPublished}
        </p>
      ) : null}

      {codeImportAvailable ? (
        <LocalizedLink
          href={buildOnboardingProjectHref("code", { importFirst: true })}
          className="group flex items-center justify-between gap-4 rounded-2xl border app-border bg-[color:var(--surface)] p-4 transition-colors hover:border-[color:var(--foreground)]"
        >
          <span className="space-y-1">
            <span className="block font-medium text-[color:var(--foreground)]">
              {copy.importTitle}
            </span>
            <span className="block text-sm app-muted">{copy.importDescription}</span>
          </span>
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 shrink-0 app-soft transition-transform group-hover:translate-x-0.5 group-hover:text-[color:var(--foreground)]"
            aria-hidden="true"
          >
            <path d="M6 3.5 10.5 8 6 12.5" />
          </svg>
        </LocalizedLink>
      ) : null}

      <div className="space-y-3">
        <div className="space-y-1">
          <h2 className="font-medium text-[color:var(--foreground)]">{copy.manualTitle}</h2>
          <p className="text-sm app-muted">{copy.manualDescription}</p>
        </div>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ONBOARDING_PROJECT_KINDS.map((kind) => (
            <li key={kind}>
              <LocalizedLink
                href={buildOnboardingProjectHref(kind)}
                className={buttonStyles({
                  variant: "secondary",
                  className: "h-full w-full justify-center text-center",
                })}
              >
                {getProjectKindLabel(kind, dictionary)}
              </LocalizedLink>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t app-border pt-5">
        <Button variant="ghost" onClick={onBack}>
          {t.back}
        </Button>
        <Button variant={hasPublishedProject ? "primary" : "ghost"} onClick={onSkip}>
          {hasPublishedProject ? t.next : t.skip}
        </Button>
      </div>
    </div>
  );
}
