"use client";

import { useState } from "react";
import {
  AUTH_LIMITS,
  forgotPasswordSchema,
  getAuthErrorMessage,
  getAuthFieldErrors,
  type AuthFieldErrors,
} from "@/lib/auth/validation";
import { useDictionary, useLocalizedRouter } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import LocalizedLink from "@/components/ui/localized-link";
import { Button, ButtonLink } from "@/components/ui/Button";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const dictionary = useDictionary();
  const router = useLocalizedRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);
    setFieldErrors({});

    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      const nextFieldErrors = getAuthFieldErrors(parsed.error);
      const localizedFieldErrors = Object.fromEntries(
        Object.entries(nextFieldErrors).map(([field, code]) => [
          field,
          getAuthErrorMessage(code || "generic", dictionary),
        ]),
      ) as AuthFieldErrors;

      setFieldErrors(localizedFieldErrors);
      setLoading(false);
      return;
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");
    const resetPagePath = `/${router.locale}/reset-password`;
    const redirectTo = baseUrl
      ? `${baseUrl.replace(/\/$/, "")}/api/auth/callback?next=${encodeURIComponent(resetPagePath)}`
      : `/api/auth/callback?next=${encodeURIComponent(resetPagePath)}`;

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      parsed.data.email,
      { redirectTo },
    );

    setLoading(false);

    if (resetError) {
      setError(dictionary.auth.errors.resetRequestFailed);
      return;
    }

    setSent(true);
  };

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <section className="rounded-hero app-card p-8">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] app-soft">
            {dictionary.auth.forgotPassword.eyebrow}
          </p>
          <ButtonLink href="/" variant="ghost" size="sm">
            {dictionary.auth.home}
          </ButtonLink>
        </div>

        {sent ? (
          <>
            <h1 className="font-display mt-4 text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
              {dictionary.auth.forgotPassword.sentTitle}
            </h1>
            <p className="mt-3 app-muted">
              {dictionary.auth.forgotPassword.sentDescription}
            </p>

            <div className="mt-8">
              <ButtonLink href="/login" variant="secondary">
                {dictionary.auth.forgotPassword.backToLogin}
              </ButtonLink>
            </div>
          </>
        ) : (
          <>
            <h1 className="font-display mt-4 text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
              {dictionary.auth.forgotPassword.title}
            </h1>
            <p className="mt-3 app-muted">
              {dictionary.auth.forgotPassword.description}
            </p>

            <form
              onSubmit={handleSubmit}
              noValidate
              className="mt-8 flex flex-col gap-4"
            >
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="forgot-email"
                  className="text-sm font-medium text-[color:var(--foreground)]"
                >
                  {dictionary.auth.email}
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  placeholder={dictionary.auth.email}
                  className="rounded-2xl border app-border bg-[color:var(--surface)] p-3 text-[color:var(--foreground)]"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                    setFieldErrors((current) => ({
                      ...current,
                      email: undefined,
                    }));
                  }}
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  inputMode="email"
                  maxLength={AUTH_LIMITS.emailMaxLength}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={
                    fieldErrors.email ? "forgot-email-error" : undefined
                  }
                />
                {fieldErrors.email && (
                  <p id="forgot-email-error" className="text-sm text-red-500">
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <Button type="submit" disabled={loading} className="justify-center">
                {loading
                  ? dictionary.auth.forgotPassword.loading
                  : dictionary.auth.forgotPassword.submit}
              </Button>
            </form>

            <div className="mt-6 flex items-center justify-between text-sm app-muted">
              <LocalizedLink
                href="/login"
                className="hover:text-[color:var(--foreground)]"
              >
                {dictionary.auth.forgotPassword.backToLogin}
              </LocalizedLink>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
