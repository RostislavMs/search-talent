"use client";

import { Button } from "@/components/ui/Button";
import { useCurrentLocale, useDictionary } from "@/lib/i18n/client";
import type { ProfilePresentation } from "@/lib/profile-presentation";
import { checkProfileContrast, fixProfileContrast } from "@/lib/profile-themes";

/**
 * Says whether the profile's text, secondary text and accent can be read on
 * its backgrounds, with a "Fix" that nudges just those colours. Shown on every
 * style tab whose colours change the answer; silent for the site look.
 */
export default function ProfileContrastCheck({
  presentation,
  onChange,
}: {
  presentation: ProfilePresentation;
  onChange: (next: ProfilePresentation) => void;
}) {
  const copy = useDictionary().profileThemes;
  const locale = useCurrentLocale();
  const checks = checkProfileContrast(presentation);

  if (checks.length === 0) {
    return null;
  }

  const failing = checks.filter((check) => !check.passes);

  if (failing.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm app-muted" role="status">
        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
        {copy.contrastOk}
      </p>
    );
  }

  const fixed = fixProfileContrast(presentation);
  const stillFailing = checkProfileContrast(fixed).some((check) => !check.passes);
  const canImprove =
    fixed.textColor !== presentation.textColor ||
    fixed.mutedColor !== presentation.mutedColor ||
    fixed.accentColor !== presentation.accentColor;
  const number = new Intl.NumberFormat(locale === "uk" ? "uk-UA" : "en-US", {
    maximumFractionDigits: 1,
  });

  return (
    <div
      className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4"
      role="status"
    >
      <div className="min-w-0 space-y-1.5">
        <ul className="space-y-1 text-sm font-medium text-[color:var(--foreground)]">
          {failing.map((check) => (
            <li
              key={check.id}
              className="flex items-center gap-2"
              title={copy.ratio
                .replace("{ratio}", number.format(check.ratio))
                .replace("{min}", number.format(check.min))}
            >
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
              {copy.issues[check.id]}
            </li>
          ))}
        </ul>
        {stillFailing ? (
          <p className="text-xs leading-5 app-muted">{copy.mixedBackgrounds}</p>
        ) : null}
      </div>
      {canImprove ? (
        <Button variant="secondary" size="sm" title={copy.fixHint} onClick={() => onChange(fixed)}>
          {copy.fix}
        </Button>
      ) : null}
    </div>
  );
}
