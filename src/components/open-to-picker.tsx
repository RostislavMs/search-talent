"use client";

import { useId, useState } from "react";
import { useDictionary } from "@/lib/i18n/client";
import { normalizeOpenTo, openToOptions, type OpenToOption } from "@/lib/open-to";

/**
 * The «Відкрито до пропозицій» switch and the options under it. Controlled:
 * the parent decides whether a change is saved right away (My Space,
 * onboarding) or with the rest of a form (the profile editor).
 *
 * The switch is on when at least one option is chosen. Switching it on opens
 * the options without saving anything; switching it off clears them.
 */
export default function OpenToPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: readonly OpenToOption[];
  onChange: (next: OpenToOption[]) => void;
  disabled?: boolean;
}) {
  const dictionary = useDictionary();
  const t = dictionary.openTo;
  const titleId = useId();
  const hintId = useId();
  const [expanded, setExpanded] = useState(false);
  const isOn = value.length > 0 || expanded;

  const toggleSwitch = () => {
    if (isOn) {
      setExpanded(false);
      if (value.length > 0) onChange([]);
    } else {
      setExpanded(true);
    }
  };

  const toggleOption = (option: OpenToOption) => {
    const next = value.includes(option)
      ? value.filter((item) => item !== option)
      : normalizeOpenTo([...value, option]);

    // Unticking the last option keeps the list open, so the switch doesn't jump.
    setExpanded(next.length === 0);
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p id={titleId} className="font-semibold text-[color:var(--foreground)]">
            {t.toggle}
          </p>
          <p id={hintId} className="mt-1 text-sm leading-6 app-muted">
            {t.toggleHint}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isOn}
          aria-labelledby={titleId}
          aria-describedby={hintId}
          disabled={disabled}
          onClick={toggleSwitch}
          className={[
            "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] disabled:cursor-not-allowed disabled:opacity-60",
            isOn
              ? "border-transparent bg-[color:var(--brand)]"
              : "app-border bg-[color:var(--surface-muted)] hover:bg-[color:var(--surface)]",
          ].join(" ")}
        >
          <span
            aria-hidden="true"
            className={[
              "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
              isOn ? "translate-x-6" : "translate-x-1",
            ].join(" ")}
          />
        </button>
      </div>

      {isOn ? (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            {openToOptions.map((option) => {
              const active = value.includes(option);

              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  disabled={disabled}
                  onClick={() => toggleOption(option)}
                  className={[
                    "cursor-pointer rounded-2xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] disabled:cursor-not-allowed disabled:opacity-60",
                    active
                      ? "border-[color:var(--foreground)] bg-[color:var(--foreground)] text-[color:var(--background)]"
                      : "app-border bg-[color:var(--surface)] text-[color:var(--foreground)] hover:bg-[color:var(--surface-muted)]",
                  ].join(" ")}
                >
                  <span className="block text-sm font-medium">{t.options[option]}</span>
                  <span className={`mt-0.5 block text-xs ${active ? "opacity-80" : "app-muted"}`}>
                    {t.hints[option]}
                  </span>
                </button>
              );
            })}
          </div>
          {value.length === 0 ? <p className="text-sm app-muted">{t.pickOne}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
