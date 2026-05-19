"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { useDictionary } from "@/lib/i18n/client";

type PasswordInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  inputClassName?: string;
};

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    { className, inputClassName, ...rest },
    ref,
  ) {
    const dictionary = useDictionary();
    const [visible, setVisible] = useState(false);

    const toggleLabel = visible
      ? dictionary.auth.hidePassword
      : dictionary.auth.showPassword;

    return (
      <div className={["relative", className].filter(Boolean).join(" ")}>
        <input
          ref={ref}
          type={visible ? "text" : "password"}
          className={[
            "w-full rounded-2xl border app-border bg-[color:var(--surface)] p-3 pr-12 text-[color:var(--foreground)]",
            inputClassName,
          ]
            .filter(Boolean)
            .join(" ")}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={toggleLabel}
          aria-pressed={visible}
          title={toggleLabel}
          className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-[color:var(--muted-foreground)] transition-colors hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]"
          tabIndex={-1}
        >
          {visible ? (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 3l18 18M10.6 6.2A9.7 9.7 0 0112 6c5 0 9 4 10 6-.6 1.2-1.6 2.6-3 3.8M6.6 6.6C4.7 7.9 3.4 9.7 2 12c1 2 5 6 10 6 1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 004.2 4.2"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx="12"
                cy="12"
                r="3"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
          )}
        </button>
      </div>
    );
  },
);

export default PasswordInput;
