"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import { ProfileLookSwatch, SiteSwatch } from "@/components/profile-theme-picker";
import { useDictionary } from "@/lib/i18n/client";
import type { ProfilePresentation } from "@/lib/profile-presentation";
import {
  applyProfileStyle,
  createProfileStyleFile,
  parseProfileStyleFile,
  PROFILE_STYLE_FILE_MAX_BYTES,
  PROFILE_STYLE_FILE_NAME,
  type ProfileStyleFileError,
} from "@/lib/profile-style-file";
import { getActiveProfileTemplateId } from "@/lib/profile-templates";
import { checkProfileContrast, getActiveProfileThemeId } from "@/lib/profile-themes";

function downloadText(text: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * "Theme" tab: download the look as a JSON file, or apply one. A file is shown
 * first — a thumbnail and what it sets — and only "Apply" puts it into the
 * editor; saving the profile is still a separate step, and "Undo" brings the
 * previous look back until something else changes.
 */
export default function ProfileStyleFile({
  presentation,
  onChange,
}: {
  presentation: ProfilePresentation;
  onChange: (next: ProfilePresentation) => void;
}) {
  const dictionary = useDictionary();
  const copy = dictionary.profileStyleFile;
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<ProfileStyleFileError | "unreadable" | null>(null);
  const [pending, setPending] = useState<{
    next: ProfilePresentation;
    skipped: number;
  } | null>(null);
  const [undo, setUndo] = useState<{
    before: ProfilePresentation;
    after: ProfilePresentation;
  } | null>(null);
  const canUndo = undo !== null && undo.after === presentation;

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Let the same file be picked again after a fix.
    event.target.value = "";

    if (!file) {
      return;
    }

    setPending(null);
    setUndo(null);

    if (file.size > PROFILE_STYLE_FILE_MAX_BYTES) {
      setError("tooLarge");
      return;
    }

    let text: string;

    try {
      text = await file.text();
    } catch {
      setError("unreadable");
      return;
    }

    const result = parseProfileStyleFile(text);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setError(null);
    setPending({
      next: applyProfileStyle(presentation, result.style),
      skipped: result.skipped,
    });
  };

  const apply = () => {
    if (!pending) {
      return;
    }

    setUndo({ before: presentation, after: pending.next });
    onChange(pending.next);
    setPending(null);
  };

  return (
    <div className="space-y-4 border-t app-border pt-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-2xl">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">{copy.title}</p>
          <p className="mt-1 text-sm leading-6 app-muted">{copy.hint}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => downloadText(createProfileStyleFile(presentation), PROFILE_STYLE_FILE_NAME)}
          >
            {copy.download}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
            {copy.upload}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            aria-label={copy.upload}
            onChange={(event) => void readFile(event)}
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-[color:var(--foreground)]" role="alert">
          {copy.errors[error]}
        </p>
      ) : null}

      {pending ? (
        <StylePreview
          next={pending.next}
          skipped={pending.skipped}
          keepsHeroMedia={
            (presentation.backgroundMode === "image" || presentation.backgroundMode === "video") &&
            Boolean(presentation.backgroundUrl)
          }
          onApply={apply}
          onCancel={() => setPending(null)}
        />
      ) : null}

      {canUndo ? (
        <div className="flex flex-wrap items-center justify-between gap-3" role="status">
          <p className="text-sm app-muted">{copy.applied}</p>
          <Button
            variant="ghost"
            size="sm"
            title={copy.undoHint}
            onClick={() => {
              onChange(undo.before);
              setUndo(null);
            }}
          >
            {copy.undo}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function StylePreview({
  next,
  skipped,
  keepsHeroMedia,
  onApply,
  onCancel,
}: {
  next: ProfilePresentation;
  skipped: number;
  keepsHeroMedia: boolean;
  onApply: () => void;
  onCancel: () => void;
}) {
  const dictionary = useDictionary();
  const copy = dictionary.profileStyleFile;
  const themeId = getActiveProfileThemeId(next);
  const templateId = getActiveProfileTemplateId(next);
  const hardToRead = checkProfileContrast(next).some((check) => !check.passes);
  const facts = [
    themeId === null
      ? copy.ownColours
      : copy.themeLabel.replace(
          "{theme}",
          themeId === "site" ? dictionary.profileThemes.site : dictionary.profileThemes.names[themeId],
        ),
    templateId === null
      ? copy.ownLayout
      : copy.templateLabel.replace("{template}", dictionary.profileTemplates.names[templateId]),
    `${dictionary.profileTemplates.projectLayout}: ${dictionary.profileTemplates.projectLayouts[next.projectLayout]}`,
  ];

  return (
    <div className="space-y-4 rounded-2xl border app-border p-4" aria-live="polite">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="w-full shrink-0 overflow-hidden rounded-xl border app-border sm:w-44">
          {themeId === "site" ? <SiteSwatch /> : <ProfileLookSwatch presentation={next} />}
        </div>
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">{copy.previewTitle}</p>
          <ul className="space-y-1 text-sm app-muted">
            {facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
          {keepsHeroMedia ? <p className="text-sm app-muted">{copy.keepsHeroMedia}</p> : null}
          {skipped > 0 ? (
            <p className="text-sm app-muted">{copy.skipped.replace("{count}", String(skipped))}</p>
          ) : null}
          {hardToRead ? (
            <p className="text-sm font-medium text-[color:var(--foreground)]">{copy.contrastWarning}</p>
          ) : null}
          <p className="text-xs leading-5 app-soft">{copy.previewHint}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onApply}>
          {copy.apply}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {copy.cancel}
        </Button>
      </div>
    </div>
  );
}
