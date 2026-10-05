"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useDictionary } from "@/lib/i18n/client";
import {
  profileProjectLayouts,
  type ProfilePresentation,
  type ProfileProjectLayout,
} from "@/lib/profile-presentation";
import {
  applyProfileTemplate,
  getActiveProfileTemplateId,
  getProfileTemplate,
  profileTemplates,
  templateBringsThemeByDefault,
  type ProfileTemplateId,
} from "@/lib/profile-templates";

/**
 * The three templates as cards: a sketch of the layout, the name and who it
 * suits. Shared by the editor and the onboarding. Picking the selected card
 * again clears the choice (only where `onClear` is given).
 */
export function ProfileTemplateOptions({
  value,
  suggestedId = null,
  onSelect,
  onClear,
}: {
  value: ProfileTemplateId | null;
  suggestedId?: ProfileTemplateId | null;
  onSelect: (id: ProfileTemplateId) => void;
  onClear?: () => void;
}) {
  const dictionary = useDictionary();
  const copy = dictionary.profileTemplates;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {profileTemplates.map((template) => {
        const active = value === template.id;

        return (
          <button
            key={template.id}
            type="button"
            aria-pressed={active}
            onClick={() => (active && onClear ? onClear() : onSelect(template.id))}
            className={`group flex cursor-pointer flex-col overflow-hidden rounded-2xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] ${
              active
                ? "border-[color:var(--brand)] ring-1 ring-[color:var(--brand)]"
                : "app-border hover:border-[color:var(--foreground)]/30"
            }`}
          >
            <TemplateSketch id={template.id} />
            <span className="flex flex-1 flex-col gap-1 bg-[color:var(--surface)] px-3 py-2.5">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-[color:var(--foreground)]">
                  {copy.names[template.id]}
                </span>
                {active ? (
                  <span aria-hidden="true" className="text-xs font-semibold text-[color:var(--brand-ink)]">
                    ✓
                  </span>
                ) : null}
              </span>
              <span className="text-xs leading-5 app-muted">{copy.descriptions[template.id]}</span>
              <span className="text-xs leading-5 app-soft">
                {copy.themeLabel.replace(
                  "{theme}",
                  dictionary.profileThemes.names[template.themeId],
                )}
              </span>
              {suggestedId === template.id ? (
                <span className="mt-auto pt-1 text-xs font-medium text-[color:var(--brand-ink)]">
                  {copy.suggested}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * "Blocks" tab: templates, plus the project card look on its own. A template
 * brings its theme only while the author hasn't mixed their own colours, and
 * the previous layout is kept for one "Undo" until something else changes.
 */
export default function ProfileTemplatePicker({
  presentation,
  onChange,
}: {
  presentation: ProfilePresentation;
  onChange: (next: ProfilePresentation) => void;
}) {
  const copy = useDictionary().profileTemplates;
  const withThemeId = useId();
  const [undo, setUndo] = useState<{
    before: ProfilePresentation;
    after: ProfilePresentation;
  } | null>(null);
  const [withTheme, setWithTheme] = useState(() => templateBringsThemeByDefault(presentation));
  const activeId = getActiveProfileTemplateId(presentation);
  const canUndo = undo !== null && undo.after === presentation;

  const apply = (next: ProfilePresentation) => {
    setUndo({ before: presentation, after: next });
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">{copy.title}</p>
          <p className="mt-1 text-sm leading-6 app-muted">{copy.hint}</p>
        </div>
        {canUndo ? (
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
        ) : null}
      </div>

      <ProfileTemplateOptions
        value={activeId}
        onSelect={(id) =>
          apply(applyProfileTemplate(presentation, getProfileTemplate(id), { withTheme }))
        }
      />

      <div className="flex items-start gap-2">
        <input
          id={withThemeId}
          type="checkbox"
          checked={withTheme}
          onChange={(event) => setWithTheme(event.target.checked)}
          className="mt-1 h-4 w-4 cursor-pointer accent-[color:var(--brand)]"
        />
        <label htmlFor={withThemeId} className="cursor-pointer text-sm leading-6">
          <span className="text-[color:var(--foreground)]">{copy.withTheme}</span>
          <span className="block text-xs leading-5 app-muted">{copy.withThemeHint}</span>
        </label>
      </div>

      <ProjectLayoutSwitch
        value={presentation.projectLayout}
        onChange={(projectLayout) => onChange({ ...presentation, projectLayout })}
      />
    </div>
  );
}

function ProjectLayoutSwitch({
  value,
  onChange,
}: {
  value: ProfileProjectLayout;
  onChange: (value: ProfileProjectLayout) => void;
}) {
  const copy = useDictionary().profileTemplates;

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-eyebrow app-soft">
        {copy.projectLayout}
      </p>
      <div className="flex flex-wrap gap-2">
        {profileProjectLayouts.map((layout) => (
          <Button
            key={layout}
            variant={value === layout ? "primary" : "secondary"}
            size="sm"
            aria-pressed={value === layout}
            onClick={() => onChange(layout)}
          >
            {copy.projectLayouts[layout]}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** A tiny drawing of the layout: hero strip, then the blocks in order. */
function TemplateSketch({ id }: { id: ProfileTemplateId }) {
  const block = "rounded-[3px] bg-[color:var(--border)]";
  const cover = "rounded-[3px] bg-[color:var(--brand)]/45";
  const line = "h-1 rounded-full bg-[color:var(--border)]";

  return (
    <span className="block bg-[color:var(--surface-muted)] p-2.5" aria-hidden="true">
      <span className="block h-4 rounded-[4px] bg-[color:var(--brand)]/70" />
      {id === "gallery" ? (
        <span className="mt-1.5 grid grid-cols-3 gap-1">
          {Array.from({ length: 6 }, (_, index) => (
            <span key={index} className={`aspect-[4/3] ${cover}`} />
          ))}
          <span className={`col-span-2 h-3 ${block}`} />
          <span className={`h-3 ${block}`} />
        </span>
      ) : null}
      {id === "cases" ? (
        <span className="mt-1.5 grid gap-1">
          {[0, 1].map((index) => (
            <span key={index} className="grid grid-cols-[2fr_3fr] gap-1">
              <span className={`h-6 ${cover}`} />
              <span className="flex flex-col justify-center gap-1">
                <span className={`w-3/4 ${line}`} />
                <span className={line} />
                <span className={`w-1/2 ${line}`} />
              </span>
            </span>
          ))}
          <span className="grid grid-cols-[2fr_1fr] gap-1">
            <span className={`h-3 ${block}`} />
            <span className={`h-3 ${block}`} />
          </span>
        </span>
      ) : null}
      {id === "resume" ? (
        <span className="mt-1.5 grid gap-1">
          <span className="grid grid-cols-[2fr_1fr] gap-1">
            <span className={`h-5 ${block}`} />
            <span className={`h-5 ${block}`} />
          </span>
          <span className="grid grid-cols-2 gap-1">
            <span className={`h-5 ${block}`} />
            <span className={`h-5 ${block}`} />
          </span>
          <span className="grid grid-cols-3 gap-1">
            {[0, 1, 2].map((index) => (
              <span key={index} className={`h-3.5 ${cover}`} />
            ))}
          </span>
        </span>
      ) : null}
    </span>
  );
}
