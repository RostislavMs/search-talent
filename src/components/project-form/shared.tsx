"use client";

import { useState, type ReactNode } from "react";
import { isValidPublicUrl } from "@/lib/url-validation";

// Shared presentational primitives used across the project-form steps and the
// per-kind detail fields. Extracted from create-project-form.tsx.

export function Field({
  label,
  children,
  htmlFor,
  className,
  description,
}: {
  label: string;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
  description?: string;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="mb-2 block text-sm font-medium text-[color:var(--foreground)]"
      >
        {label}
      </label>
      {description ? (
        <p className="-mt-1 mb-2 text-xs app-muted">{description}</p>
      ) : null}
      {children}
    </div>
  );
}

export function ChipToggleGroup<T extends string>({
  options,
  value,
  onChange,
  getLabel,
}: {
  options: readonly T[];
  value: T[];
  onChange: (next: T[]) => void;
  getLabel: (option: T) => string;
}) {
  const selected = new Set<T>(value);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isActive = selected.has(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => {
              const next = new Set<T>(value);
              if (isActive) {
                next.delete(option);
              } else {
                next.add(option);
              }
              onChange(Array.from(next));
            }}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              isActive
                ? "border-[color:var(--foreground)] bg-[color:var(--foreground)] text-[color:var(--background)]"
                : "app-border app-muted hover:bg-[color:var(--surface-muted)]"
            }`}
          >
            {getLabel(option)}
          </button>
        );
      })}
    </div>
  );
}

export function UrlField({
  id,
  label,
  description,
  placeholder,
  value,
  onChange,
  invalidMessage,
  className,
}: {
  id: string;
  label: string;
  description?: string;
  placeholder?: string;
  value: string;
  onChange: (next: string) => void;
  invalidMessage: string;
  className?: string;
}) {
  const [touched, setTouched] = useState(false);
  const trimmed = value.trim();
  const invalid = touched && trimmed.length > 0 && !isValidPublicUrl(trimmed);
  const errorId = `${id}-error`;

  return (
    <Field
      label={label}
      htmlFor={id}
      description={description}
      className={className}
    >
      <input
        id={id}
        type="url"
        inputMode="url"
        placeholder={placeholder}
        className={`app-input${invalid ? " border-rose-500 focus:border-rose-500" : ""}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => setTouched(true)}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
      />
      {invalid ? (
        <p id={errorId} className="mt-1.5 text-xs text-rose-500">
          {invalidMessage}
        </p>
      ) : null}
    </Field>
  );
}
