"use client";

import { useEffect, useState } from "react";
import {
  AUTH_LIMITS,
  getAuthErrorMessage,
  getAuthFieldErrors,
  resetPasswordSchema,
  type AuthFieldErrors,
} from "@/lib/auth/validation";
import { useDictionary, useLocalizedHref } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import PasswordInput from "@/components/ui/password-input";
import { Button, ButtonLink } from "@/components/ui/Button";

type SessionState = "loading" | "ready" | "invalid";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const dictionary = useDictionary();
  const loginHref = useLocalizedHref("/login");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [sessionState, setSessionState] = useState<SessionState>("loading");

  useEffect(() => {
    let cancelled = false;

    const hydrateSession = async () => {
      try {
        if (typeof window === "undefined") return;

        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        const queryParams = new URLSearchParams(window.location.search);

        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const tokenType = hashParams.get("type") || queryParams.get("type");
        const code = queryParams.get("code");

        if (accessToken && refreshToken && tokenType === "recovery") {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (cancelled) return;
          if (sessionError) {
            setSessionState("invalid");
            return;
          }

          window.history.replaceState(null, "", window.location.pathname);
          setSessionState("ready");
          return;
        }

        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);

          if (cancelled) return;
          if (exchangeError) {
            setSessionState("invalid");
            return;
          }

          window.history.replaceState(null, "", window.location.pathname);
          setSessionState("ready");
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (cancelled) return;
        setSessionState(session ? "ready" : "invalid");
      } catch {
        if (!cancelled) {
          setSessionState("invalid");
        }
      }
    };

    hydrateSession();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);
    setFieldErrors({});

    const parsed = resetPasswordSchema.safeParse({ password, confirmPassword });
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

    const { error: updateError } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });

    setLoading(false);

    if (updateError) {
      setError(dictionary.auth.errors.resetUpdateFailed);
      return;
    }

    setDone(true);
  };

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <section className="rounded-[2rem] app-card p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] app-soft">
          {dictionary.auth.resetPassword.eyebrow}
        </p>

        {sessionState === "loading" && (
          <p className="mt-6 app-muted">
            {dictionary.auth.resetPassword.verifyingLink}
          </p>
        )}

        {sessionState === "invalid" && (
          <>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[color:var(--foreground)]">
              {dictionary.auth.resetPassword.title}
            </h1>
            <p className="mt-3 text-sm text-red-500">
              {dictionary.auth.resetPassword.invalidSession}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/forgot-password">
                {dictionary.auth.forgotPassword.submit}
              </ButtonLink>
              <ButtonLink href="/login" variant="ghost">
                {dictionary.auth.resetPassword.backToLogin}
              </ButtonLink>
            </div>
          </>
        )}

        {sessionState === "ready" && !done && (
          <>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[color:var(--foreground)]">
              {dictionary.auth.resetPassword.title}
            </h1>
            <p className="mt-3 app-muted">
              {dictionary.auth.resetPassword.description}
            </p>

            <form
              onSubmit={handleSubmit}
              noValidate
              className="mt-8 flex flex-col gap-4"
            >
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="reset-password"
                  className="text-sm font-medium text-[color:var(--foreground)]"
                >
                  {dictionary.auth.password}
                </label>
                <PasswordInput
                  id="reset-password"
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
                  autoComplete="new-password"
                  maxLength={AUTH_LIMITS.passwordMaxLength}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={`reset-password-hint${fieldErrors.password ? " reset-password-error" : ""}`}
                />
                <p id="reset-password-hint" className="text-sm app-muted">
                  {dictionary.auth.passwordHint}
                </p>
                {fieldErrors.password && (
                  <p id="reset-password-error" className="text-sm text-red-500">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="reset-confirm-password"
                  className="text-sm font-medium text-[color:var(--foreground)]"
                >
                  {dictionary.auth.confirmPassword}
                </label>
                <PasswordInput
                  id="reset-confirm-password"
                  placeholder={dictionary.auth.confirmPassword}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError(null);
                    setFieldErrors((current) => ({
                      ...current,
                      confirmPassword: undefined,
                    }));
                  }}
                  autoComplete="new-password"
                  maxLength={AUTH_LIMITS.passwordMaxLength}
                  aria-invalid={Boolean(fieldErrors.confirmPassword)}
                  aria-describedby={
                    fieldErrors.confirmPassword
                      ? "reset-confirm-password-error"
                      : undefined
                  }
                />
                {fieldErrors.confirmPassword && (
                  <p
                    id="reset-confirm-password-error"
                    className="text-sm text-red-500"
                  >
                    {fieldErrors.confirmPassword}
                  </p>
                )}
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <Button type="submit" disabled={loading} className="justify-center">
                {loading
                  ? dictionary.auth.resetPassword.loading
                  : dictionary.auth.resetPassword.submit}
              </Button>
            </form>
          </>
        )}

        {done && (
          <>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[color:var(--foreground)]">
              {dictionary.auth.resetPassword.doneTitle}
            </h1>
            <p className="mt-3 app-muted">
              {dictionary.auth.resetPassword.doneDescription}
            </p>
            <div className="mt-6">
              <a
                href={loginHref}
                className="inline-block rounded-2xl bg-[color:var(--foreground)] px-4 py-2 text-sm font-medium text-[color:var(--background)]"
              >
                {dictionary.auth.resetPassword.backToLogin}
              </a>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
