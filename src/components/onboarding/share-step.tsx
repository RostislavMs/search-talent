"use client";

import ProfileSharePanel from "@/components/profile-share-panel";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useDictionary } from "@/lib/i18n/client";
import type { OnboardingStep } from "@/lib/onboarding";

function Note({
  text,
  actionLabel,
  onAction,
}: {
  text: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl app-panel px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-[color:var(--foreground)]">{text}</p>
      <Button variant="secondary" size="sm" onClick={onAction} className="shrink-0">
        {actionLabel}
      </Button>
    </div>
  );
}

export default function OnboardingShareStep({
  profileUrl,
  username,
  usernameIsTemporary,
  hasPublishedProject,
  finishing,
  onShared,
  onGoTo,
  onBack,
  onFinish,
}: {
  profileUrl: string;
  username: string;
  usernameIsTemporary: boolean;
  hasPublishedProject: boolean;
  finishing: boolean;
  onShared: () => void;
  onGoTo: (step: OnboardingStep) => void;
  onBack: () => void;
  onFinish: () => void;
}) {
  const dictionary = useDictionary();
  const t = dictionary.onboarding;
  const copy = t.share;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
          {copy.title}
        </h1>
        <p className="text-sm leading-6 app-muted">{copy.description}</p>
      </div>

      {usernameIsTemporary ? (
        <Note
          text={copy.temporaryNickNote}
          actionLabel={copy.pickNick}
          onAction={() => onGoTo("profile")}
        />
      ) : null}

      {!hasPublishedProject ? (
        <Note
          text={copy.emptyNote}
          actionLabel={copy.addProject}
          onAction={() => onGoTo("project")}
        />
      ) : null}

      <ProfileSharePanel profileUrl={profileUrl} fileSlug={username} onShared={onShared} />

      <div className="flex flex-wrap items-center justify-between gap-2 border-t app-border pt-5">
        <Button variant="ghost" onClick={onBack}>
          {t.back}
        </Button>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/u/${username}`} variant="secondary">
            {copy.openProfile}
          </ButtonLink>
          <Button onClick={onFinish} disabled={finishing}>
            {copy.finish}
          </Button>
        </div>
      </div>
    </div>
  );
}
