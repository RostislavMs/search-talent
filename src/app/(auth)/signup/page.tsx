"use client";

import { useState } from "react";
import {
  AUTH_LIMITS,
  buildAuthRedirectUrl,
  getAuthErrorMessage,
  getAuthFieldErrors,
  getPublicAuthErrorMessage,
  signupSchema,
  type AuthFieldErrors,
} from "@/lib/auth/validation";
import { useDictionary, useLocalizedHref, useLocalizedRouter } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import LocalizedLink from "@/components/ui/localized-link";
import PasswordInput from "@/components/ui/password-input";
import { Button, ButtonLink } from "@/components/ui/Button";

export default function SignupPage() {
  const supabase = createClient();
  const router = useLocalizedRouter();
  const dictionary = useDictionary();
  const verifyHref = useLocalizedHref("/verify");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);
    setFieldErrors({});

    const parsed = signupSchema.safeParse({
      email,
      password,
      confirmPassword,
    });

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

    const { error: signupError } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: buildAuthRedirectUrl(
          router.locale,
          "/verify",
          process.env.NEXT_PUBLIC_APP_URL,
        ),
        // Persist the signup locale into user_metadata so Supabase Auth email
        // templates can localize via {{ .Data.locale }} (see supabase/email-templates).
        data: { locale: router.locale },
      },
    });

    setLoading(false);

    if (signupError) {
      setError(getPublicAuthErrorMessage("signup", dictionary));
      return;
    }

    window.location.assign(verifyHref);
  };

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <section className="rounded-hero app-card p-8">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] app-soft">
            {dictionary.auth.signup.eyebrow}
          </p>
          <ButtonLink href="/" variant="ghost" size="sm">
            {dictionary.auth.home}
          </ButtonLink>
        </div>

        <h1 className="font-display mt-4 text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
          {dictionary.auth.signup.title}
        </h1>

        <p className="mt-3 app-muted">
          {dictionary.auth.signup.description}
        </p>

        <form onSubmit={handleSignup} noValidate className="mt-8 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="signup-email"
              className="text-sm font-medium text-[color:var(--foreground)]"
            >
              {dictionary.auth.email}
            </label>
            <input
              id="signup-email"
              type="email"
              placeholder={dictionary.auth.email}
              className="rounded-2xl border app-border bg-[color:var(--surface)] p-3 text-[color:var(--foreground)]"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
                setFieldErrors((current) => ({ ...current, email: undefined }));
              }}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              inputMode="email"
              maxLength={AUTH_LIMITS.emailMaxLength}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={
                fieldErrors.email ? "signup-email-error" : undefined
              }
            />
            {fieldErrors.email && (
              <p id="signup-email-error" className="text-sm text-red-500">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="signup-password"
              className="text-sm font-medium text-[color:var(--foreground)]"
            >
              {dictionary.auth.password}
            </label>
            <PasswordInput
              id="signup-password"
              placeholder={dictionary.auth.password}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
                setFieldErrors((current) => ({ ...current, password: undefined }));
              }}
              autoComplete="new-password"
              maxLength={AUTH_LIMITS.passwordMaxLength}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={`signup-password-hint${fieldErrors.password ? " signup-password-error" : ""}`}
            />
            <p id="signup-password-hint" className="text-sm app-muted">
              {dictionary.auth.passwordHint}
            </p>
            {fieldErrors.password && (
              <p id="signup-password-error" className="text-sm text-red-500">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="signup-confirm-password"
              className="text-sm font-medium text-[color:var(--foreground)]"
            >
              {dictionary.auth.confirmPassword}
            </label>
            <PasswordInput
              id="signup-confirm-password"
              placeholder={dictionary.auth.confirmPassword}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError(null);
                setFieldErrors((current) => ({ ...current, confirmPassword: undefined }));
              }}
              autoComplete="new-password"
              maxLength={AUTH_LIMITS.passwordMaxLength}
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              aria-describedby={
                fieldErrors.confirmPassword
                  ? "signup-confirm-password-error"
                  : undefined
              }
            />
            {fieldErrors.confirmPassword && (
              <p
                id="signup-confirm-password-error"
                className="text-sm text-red-500"
              >
                {fieldErrors.confirmPassword}
              </p>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" disabled={loading} className="justify-center">
            {loading ? dictionary.auth.signup.loading : dictionary.auth.signup.submit}
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm app-muted">
          <LocalizedLink href="/login" className="hover:text-[color:var(--foreground)]">
            {dictionary.auth.signup.alreadyHaveAccount}
          </LocalizedLink>
          <LocalizedLink href="/projects" className="hover:text-[color:var(--foreground)]">
            {dictionary.auth.signup.browseProjects}
          </LocalizedLink>
        </div>
      </section>
    </main>
  );
}
