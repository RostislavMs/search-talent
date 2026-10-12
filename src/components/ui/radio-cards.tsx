"use client";

/**
 * A short list of choices as cards: a radio, a label and a line about what
 * the choice means. Label the group with `labelledBy` (the visible heading
 * above it). Used by the message settings and the email settings.
 */
export default function RadioCards<T extends string>({
  name,
  value,
  options,
  onChange,
  labelledBy,
  disabled = false,
}: {
  name: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string; hint?: string }>;
  onChange: (value: T) => void;
  labelledBy: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="space-y-2">
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <label
            key={option.value}
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors ${
              checked ? "border-[color:var(--foreground)]" : "app-border hover:bg-[color:var(--surface-muted)]"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(option.value)}
              className="mt-1 accent-[color:var(--brand)]"
            />
            <span>
              <span className="block text-sm font-medium text-[color:var(--foreground)]">{option.label}</span>
              {option.hint ? <span className="mt-0.5 block text-xs leading-5 app-muted">{option.hint}</span> : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}
