"use client";

import { requestCookieConsentPreferences } from "@/lib/cookie-consent";

type CookieSettingsButtonProps = {
  label: string;
  className?: string;
};

export default function CookieSettingsButton({
  label,
  className = "",
}: CookieSettingsButtonProps) {
  return (
    <button
      type="button"
      onClick={() => requestCookieConsentPreferences()}
      // Tailwind v4's preflight resets buttons to `cursor: default`, so the
      // affordance has to be explicit. It lives here rather than in the
      // caller's className so every future placement gets it for free.
      className={`cursor-pointer ${className}`.trim()}
    >
      {label}
    </button>
  );
}

