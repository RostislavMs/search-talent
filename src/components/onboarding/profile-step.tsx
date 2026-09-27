"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import FormSelect from "@/components/ui/form-select";
import TagSelect from "@/components/ui/tag-select";
import { apiFetch } from "@/lib/api-client";
import type { MetaOption } from "@/lib/db/onboarding";
import { useDictionary } from "@/lib/i18n/client";
import { USERNAME_PATTERN, suggestUsernameFromName } from "@/lib/username";

export type OnboardingProfileInitial = {
  name: string;
  /** The nick the account has right now. */
  username: string;
  usernameIsTemporary: boolean;
  categoryId: number | null;
  skillIds: number[];
};

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

// Wait for a pause in typing before asking the server.
const USERNAME_CHECK_DELAY_MS = 400;

export default function OnboardingProfileStep({
  initial,
  meta,
  onDone,
  onSkip,
}: {
  initial: OnboardingProfileInitial;
  meta: { categories: MetaOption[]; skills: MetaOption[] };
  onDone: () => void;
  onSkip: () => void;
}) {
  const dictionary = useDictionary();
  const t = dictionary.onboarding;
  const copy = t.profile;
  const ids = {
    name: useId(),
    username: useId(),
    usernameStatus: useId(),
    skillsHint: useId(),
  };

  const [name, setName] = useState(initial.name);
  // A temporary nick is not shown as a value: the field starts with a nick
  // made from the name (or empty) and keeps following the name until edited.
  const [username, setUsername] = useState(
    initial.usernameIsTemporary ? (suggestUsernameFromName(initial.name) ?? "") : initial.username,
  );
  const [usernameTouched, setUsernameTouched] = useState(!initial.usernameIsTemporary);
  // The last server answer, tied to the nick it was about. `available: null`
  // means the check failed; saving still validates, so the hint just stays.
  const [check, setCheck] = useState<{ value: string; available: boolean | null } | null>(
    null,
  );
  // Set when saving hits a nick someone took in the meantime.
  const [takenOnSave, setTakenOnSave] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(initial.categoryId);
  const [skillIds, setSkillIds] = useState<number[]>(initial.skillIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedUsername = username.trim().toLowerCase();
  const needsCheck =
    Boolean(trimmedUsername) &&
    trimmedUsername !== initial.username.toLowerCase() &&
    USERNAME_PATTERN.test(trimmedUsername);
  const usernameStatus: UsernameStatus =
    !trimmedUsername || trimmedUsername === initial.username.toLowerCase()
      ? "idle"
      : !USERNAME_PATTERN.test(trimmedUsername)
        ? "invalid"
        : takenOnSave === trimmedUsername
          ? "taken"
          : check?.value === trimmedUsername
            ? check.available === null
              ? "idle"
              : check.available
                ? "available"
                : "taken"
            : "checking";

  useEffect(() => {
    if (!needsCheck) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const result = await apiFetch<{ valid: boolean; available: boolean }>(
        `/api/onboarding/username?value=${encodeURIComponent(trimmedUsername)}`,
        { signal: controller.signal },
      );

      if (!controller.signal.aborted) {
        setCheck({
          value: trimmedUsername,
          available: result.ok ? result.data.valid && result.data.available : null,
        });
      }
    }, USERNAME_CHECK_DELAY_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [needsCheck, trimmedUsername]);

  const handleNameChange = (value: string) => {
    setName(value);

    if (!usernameTouched) {
      setUsername(suggestUsernameFromName(value) ?? "");
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (saving || usernameStatus === "invalid" || usernameStatus === "taken") {
      return;
    }

    setSaving(true);
    setError(null);

    const result = await apiFetch<{ username: string }>("/api/onboarding", {
      method: "PATCH",
      body: {
        name,
        // Leaving the field empty keeps the current nick.
        username: trimmedUsername || initial.username,
        category_id: categoryId,
        skill_ids: skillIds,
      },
    });

    setSaving(false);

    if (!result.ok) {
      if (result.status === 409) {
        setTakenOnSave(trimmedUsername || initial.username);
        return;
      }

      setError(copy.saveFailed);
      return;
    }

    onDone();
  };

  const statusText =
    usernameStatus === "checking"
      ? copy.usernameChecking
      : usernameStatus === "available"
        ? copy.usernameAvailable
        : usernameStatus === "taken"
          ? copy.usernameTaken
          : usernameStatus === "invalid"
            ? copy.usernameInvalid
            : copy.usernameHint;
  const statusIsError = usernameStatus === "taken" || usernameStatus === "invalid";

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
          {copy.title}
        </h1>
        <p className="text-sm leading-6 app-muted">{copy.description}</p>
      </div>

      <div className="space-y-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.name} className="text-sm font-medium text-[color:var(--foreground)]">
            {copy.name}
          </label>
          <input
            id={ids.name}
            type="text"
            value={name}
            onChange={(event) => handleNameChange(event.target.value)}
            placeholder={copy.namePlaceholder}
            autoComplete="name"
            maxLength={120}
            className="app-input"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.username} className="text-sm font-medium text-[color:var(--foreground)]">
            {copy.username}
          </label>
          <div className="flex items-center overflow-hidden rounded-2xl border app-border bg-[color:var(--surface)] focus-within:border-[color:var(--ring)]">
            <span className="select-none pl-3 text-sm app-soft">searchtalent.dev/u/</span>
            <input
              id={ids.username}
              type="text"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                setUsernameTouched(true);
              }}
              placeholder={initial.usernameIsTemporary ? initial.username : undefined}
              autoCapitalize="none"
              autoComplete="username"
              spellCheck={false}
              maxLength={32}
              aria-invalid={statusIsError}
              aria-describedby={ids.usernameStatus}
              className="min-w-0 flex-1 bg-transparent py-3 pr-3 text-[color:var(--foreground)] outline-none"
            />
          </div>
          <p
            id={ids.usernameStatus}
            aria-live="polite"
            className={`text-xs leading-5 ${statusIsError ? "text-red-500" : "app-muted"}`}
          >
            {statusText}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-[color:var(--foreground)]">{copy.direction}</p>
          <FormSelect
            className="w-full"
            triggerClassName="w-full"
            value={categoryId ? String(categoryId) : ""}
            placeholder={copy.directionPlaceholder}
            searchable
            searchPlaceholder={copy.directionSearch}
            noResultsLabel={copy.noResults}
            onChange={(value) => setCategoryId(value ? Number(value) : null)}
            options={meta.categories.map((option) => ({
              value: String(option.id),
              label: option.name,
            }))}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-[color:var(--foreground)]">{copy.skills}</p>
          <p id={ids.skillsHint} className="text-xs leading-5 app-muted">
            {copy.skillsHint}
          </p>
          <TagSelect
            options={meta.skills}
            value={skillIds}
            placeholder={copy.skillsPlaceholder}
            onChange={(values) => setSkillIds(values.map(Number))}
          />
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t app-border pt-5">
        <Button variant="ghost" onClick={onSkip} disabled={saving}>
          {t.skip}
        </Button>
        <Button type="submit" disabled={saving || statusIsError}>
          {saving ? t.saving : t.saveAndNext}
        </Button>
      </div>
    </form>
  );
}
