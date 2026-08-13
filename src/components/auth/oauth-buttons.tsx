"use client";

import { useState } from "react";
import { getPublicAuthErrorMessage } from "@/lib/auth/validation";
import { useDictionary, useLocalizedHref } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { buttonStyles } from "@/components/ui/button-styles";

type OAuthProvider = "google" | "github";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.63v3.02h3.89c2.27-2.09 3.56-5.17 3.56-8.89z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.89-3.02c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.72-4.96H1.26v3.11A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27a7.2 7.2 0 0 1 0-4.54V6.62H1.26a12 12 0 0 0 0 10.76l4.02-3.11z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.45-3.45C17.95 1.14 15.24 0 12 0A12 12 0 0 0 1.26 6.62l4.02 3.11C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

/**
 * Shared social sign-in row for /login and /signup. Supabase treats both the
 * same way — the provider callback creates the account when it does not exist
 * yet — so a single component serves login and registration.
 */
export default function OAuthButtons({
  disabled = false,
  onError,
  className,
}: {
  disabled?: boolean;
  onError: (message: string | null) => void;
  className?: string;
}) {
  const supabase = createClient();
  const dictionary = useDictionary();
  const mySpaceHref = useLocalizedHref("/my-space");
  const [pending, setPending] = useState<OAuthProvider | null>(null);

  const startOAuth = async (provider: OAuthProvider) => {
    if (disabled || pending) {
      return;
    }

    setPending(provider);
    onError(null);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const callbackUrl = new URL("/api/auth/callback", baseUrl);
    callbackUrl.searchParams.set("next", mySpaceHref);

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl.toString() },
    });

    if (error) {
      // On success the browser is already navigating to the provider, so the
      // pending state is only ever cleared on failure.
      setPending(null);
      onError(getPublicAuthErrorMessage("oauth", dictionary));
    }
  };

  const providers: Array<{
    id: OAuthProvider;
    label: string;
    description: string;
    icon: React.ReactNode;
  }> = [
    {
      id: "google",
      label: dictionary.auth.oauth.google,
      description: dictionary.auth.login.google,
      icon: <GoogleIcon />,
    },
    {
      id: "github",
      label: dictionary.auth.oauth.github,
      description: dictionary.auth.login.github,
      icon: <GitHubIcon />,
    },
  ];

  return (
    <div className={["grid grid-cols-2 gap-2", className].filter(Boolean).join(" ")}>
      {providers.map((provider) => (
        <button
          key={provider.id}
          type="button"
          onClick={() => startOAuth(provider.id)}
          disabled={disabled || pending !== null}
          aria-label={provider.description}
          title={provider.description}
          className={buttonStyles({
            variant: "secondary",
            className: "gap-2",
          })}
        >
          {provider.icon}
          <span>{provider.label}</span>
        </button>
      ))}
    </div>
  );
}
