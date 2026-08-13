"use client";

import { useState } from "react";
import {
  AUTH_LIMITS,
  getAuthErrorMessage,
  getAuthFieldErrors,
  getPublicAuthErrorMessage,
  loginSchema,
  type AuthFieldErrors,
} from "@/lib/auth/validation";
import { useDictionary, useLocalizedHref } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import AuthDivider from "@/components/auth/auth-divider";
import AuthLegalNote from "@/components/auth/auth-legal-note";
import OAuthButtons from "@/components/auth/oauth-buttons";
import LocalizedLink from "@/components/ui/localized-link";
import PasswordInput from "@/components/ui/password-input";
import { Button, ButtonLink } from "@/components/ui/Button";

export default function LoginPage() {
  const supabase = createClient();
  const dictionary = useDictionary();
  const mySpaceHref = useLocalizedHref("/my-space");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);
    setFieldErrors({});

    const parsed = loginSchema.safeParse({
      email,
      password,
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

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    setLoading(false);

    if (loginError) {
      setError(getPublicAuthErrorMessage("login", dictionary));
      return;
    }

    window.location.assign(mySpaceHref);
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-col justify-center px-0 py-0 sm:min-h-[calc(100svh-4.5rem)] sm:px-4 sm:py-6">
      <section className="w-full rounded-none sm:rounded-hero app-card px-4 py-6 sm:px-7 sm:py-6">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-xs font-semibold uppercase tracking-eyebrow text-orange-400">
            {dictionary.auth.login.eyebrow}
          </p>
          <ButtonLink
            href="/"
            variant="ghost"
            size="sm"
            className="-mr-2 shrink-0 whitespace-nowrap"
          >
            {dictionary.auth.home}
          </ButtonLink>
        </div>

        <h1 className="font-display mt-2 text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
          {dictionary.auth.login.title}
        </h1>

        <OAuthButtons className="mt-5" disabled={loading} onError={setError} />

        <AuthDivider className="my-4" />

        <form onSubmit={handleLogin} noValidate className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="login-email"
              className="text-sm font-medium text-[color:var(--foreground)]"
            >
              {dictionary.auth.email}
            </label>
            <input
              id="login-email"
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
                fieldErrors.email ? "login-email-error" : undefined
              }
            />
            {fieldErrors.email && (
              <p id="login-email-error" className="text-sm text-red-500">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <label
                htmlFor="login-password"
                className="text-sm font-medium text-[color:var(--foreground)]"
              >
                {dictionary.auth.password}
              </label>
              <LocalizedLink
                href="/forgot-password"
                className="text-xs app-muted hover:text-[color:var(--foreground)]"
              >
                {dictionary.auth.forgotPassword.link}
              </LocalizedLink>
            </div>
            <PasswordInput
              id="login-password"
              placeholder={dictionary.auth.password}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
                setFieldErrors((current) => ({
                  ...current,
                  password: undefined,
                }));
              }}
              autoComplete="current-password"
              maxLength={AUTH_LIMITS.passwordMaxLength}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={
                fieldErrors.password ? "login-password-error" : undefined
              }
            />
            {fieldErrors.password && (
              <p id="login-password-error" className="text-sm text-red-500">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" disabled={loading} className="justify-center">
            {loading
              ? dictionary.auth.login.loading
              : dictionary.auth.login.submit}
          </Button>

          <AuthLegalNote />
        </form>

        <div className="mt-4 flex items-center justify-between gap-3 text-sm app-muted">
          <LocalizedLink
            href="/signup"
            className="hover:text-[color:var(--foreground)]"
          >
            {dictionary.auth.login.createAccount}
          </LocalizedLink>
          <LocalizedLink
            href="/talents"
            className="hover:text-[color:var(--foreground)]"
          >
            {dictionary.auth.login.exploreFirst}
          </LocalizedLink>
        </div>
      </section>
    </main>
  );
}
