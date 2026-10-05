"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { useDictionary } from "@/lib/i18n/client";
import {
  createDefaultProfilePresentation,
  getProfileFonts,
  getProfileHeroBackground,
  getReadableTextColor,
  type ProfilePresentation,
} from "@/lib/profile-presentation";
import {
  applyProfileLook,
  createRandomProfileLook,
  getActiveProfileThemeId,
  getSiteProfileLook,
  profileThemes,
  type ProfileTheme,
} from "@/lib/profile-themes";

/**
 * The first thing on the "Theme" tab: the site look, five ready themes and a
 * random one, each a single click. The previous look is kept for one "Undo"
 * until the author changes something else.
 */
export default function ProfileThemePicker({
  presentation,
  onChange,
}: {
  presentation: ProfilePresentation;
  onChange: (next: ProfilePresentation) => void;
}) {
  const copy = useDictionary().profileThemes;
  const [undo, setUndo] = useState<{
    before: ProfilePresentation;
    after: ProfilePresentation;
  } | null>(null);
  const activeId = getActiveProfileThemeId(presentation);
  // Only while nothing else has changed since: undoing past later edits would
  // throw them away too.
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
        <div className="flex flex-wrap gap-2">
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
          <Button
            variant="secondary"
            size="sm"
            title={copy.randomHint}
            onClick={() => apply(applyProfileLook(presentation, createRandomProfileLook()))}
          >
            {copy.random}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <ThemeOption
          label={copy.site}
          hint={copy.siteHint}
          active={activeId === "site"}
          onSelect={() => apply(applyProfileLook(presentation, getSiteProfileLook()))}
          swatch={<SiteSwatch />}
        />
        {profileThemes.map((theme) => (
          <ThemeOption
            key={theme.id}
            label={copy.names[theme.id]}
            active={activeId === theme.id}
            onSelect={() => apply(applyProfileLook(presentation, theme))}
            swatch={<ThemeSwatch theme={theme} />}
          />
        ))}
      </div>
    </div>
  );
}

function ThemeOption({
  label,
  hint,
  active,
  onSelect,
  swatch,
}: {
  label: string;
  hint?: string;
  active: boolean;
  onSelect: () => void;
  swatch: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={hint}
      onClick={onSelect}
      className={`group cursor-pointer overflow-hidden rounded-2xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] ${
        active
          ? "border-[color:var(--brand)] ring-1 ring-[color:var(--brand)]"
          : "app-border hover:border-[color:var(--foreground)]/30"
      }`}
    >
      {swatch}
      <span className="flex items-center justify-between gap-2 bg-[color:var(--surface)] px-3 py-2">
        <span className="truncate text-sm font-medium text-[color:var(--foreground)]">{label}</span>
        {active ? (
          <span aria-hidden="true" className="text-xs font-semibold text-[color:var(--brand-ink)]">
            ✓
          </span>
        ) : null}
      </span>
    </button>
  );
}

function ThemeSwatch({ theme }: { theme: ProfileTheme }) {
  return (
    <ProfileLookSwatch presentation={applyProfileLook(createDefaultProfilePresentation(), theme)} />
  );
}

/**
 * A thumbnail of a look: page colour, hero strip, a heading and the accent.
 * The hero is drawn with its colours only — a photo isn't part of a look.
 */
export function ProfileLookSwatch({ presentation }: { presentation: ProfilePresentation }) {
  const fonts = getProfileFonts(presentation.fontPreset);

  return (
    <span
      className="block p-2"
      style={{ backgroundColor: presentation.surfaceColor }}
      aria-hidden="true"
    >
      <span
        className="flex h-14 flex-col justify-end rounded-lg px-2.5 pb-2"
        style={{ background: getProfileHeroBackground({ ...presentation, backgroundUrl: null }) }}
      >
        <span
          className="text-base font-semibold leading-none"
          style={{ color: presentation.textColor, fontFamily: fonts.heading }}
        >
          Aa
        </span>
      </span>
      <span className="mt-2 flex items-center gap-1.5 px-0.5">
        <span
          className="h-4 rounded-full px-2 text-[9px] font-semibold leading-4"
          style={{
            backgroundColor: presentation.accentColor,
            color: getReadableTextColor(presentation.accentColor),
            fontFamily: fonts.body,
          }}
        >
          Aa
        </span>
        <span
          className="h-1.5 flex-1 rounded-full"
          style={{ backgroundColor: presentation.mutedColor, opacity: 0.45 }}
        />
      </span>
    </span>
  );
}

/** Half light, half dark: the site look follows the visitor's site theme. */
export function SiteSwatch() {
  return (
    <span className="grid grid-cols-2" aria-hidden="true">
      {[
        { page: "#f4f7fb", text: "#0f172a" },
        { page: "#020817", text: "#e5edf7" },
      ].map((side) => (
        <span key={side.page} className="block p-2" style={{ backgroundColor: side.page }}>
          <span className="flex h-14 flex-col justify-end rounded-lg bg-brand-hero px-2 pb-2">
            <span className="font-display text-base font-semibold leading-none text-white">Aa</span>
          </span>
          <span className="mt-2 flex items-center gap-1.5 px-0.5">
            <span className="h-4 w-6 rounded-full bg-[#f59e0b]" />
            <span
              className="h-1.5 flex-1 rounded-full"
              style={{ backgroundColor: side.text, opacity: 0.3 }}
            />
          </span>
        </span>
      ))}
    </span>
  );
}
