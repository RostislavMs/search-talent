"use client";

import { useState, useSyncExternalStore } from "react";
import { buildContinueHref } from "@/lib/auth/redirect";
import { useSearchParam } from "@/lib/auth/use-search-param";
import {
  AUTH_LIMITS,
  getAuthErrorMessage,
  getAuthFieldErrors,
  resetPasswordSchema,
  type AuthFieldErrors,
} from "@/lib/auth/validation";
import { useDictionary, useLocalizedRouter } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import PasswordInput from "@/components/ui/password-input";
import { Button, ButtonLink } from "@/components/ui/Button";

type LinkState = "loading" | "ready" | "invalid";

function noSubscription() {
  return () => {};
}

/** False in the server HTML and while hydrating, so the link is not judged yet. */
function useUrlReadable() {
  return useSyncExternalStore(noSubscription, () => true, () => false);
}

/**
 * The new-password form behind the reset email.
 *
 * The form shows only for a link from that email: `?token_hash=` from the
 * current template, or `?recovery_code=` passed on by /api/auth/callback from
 * the older one. Either is checked only when the new password is saved, so
 * opening the link signs no one in, and being signed in is not enough to set
 * a password without the current one (that is the Security section). The
 * token also works on any device, and a mail scanner that opens links ahead of
 * the person cannot use it up.
 */
export default function ResetPasswordPage() {
  const supabase = createClient();
  const dictionary = useDictionary();
  const router = useLocalizedRouter();
  const tokenHash = useSearchParam("token_hash");
  const recoveryCode = useSearchParam("recovery_code");
  const urlReadable = useUrlReadable();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  // The link works only once; after that the session it opened carries any
  // retry.
  const [linkUsed, setLinkUsed] = useState(false);
  const [linkFailed, setLinkFailed] = useState(false);

  const linkState: LinkState = !urlReadable
    ? "loading"
    : linkFailed || !(tokenHash || recoveryCode)
      ? "invalid"
      : "ready";

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

    if (!linkUsed) {
      const { error: linkError } = tokenHash
        ? await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash })
        : await supabase.auth.exchangeCodeForSession(recoveryCode ?? "");

      if (linkError) {
        setLoading(false);
        setLinkFailed(true);
        return;
      }

      setLinkUsed(true);
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });

    setLoading(false);

    if (updateError) {
      setError(
        updateError.code === "same_password"
          ? dictionary.auth.errors.samePassword
          : dictionary.auth.errors.resetUpdateFailed,
      );
      return;
    }

    setDone(true);
  };

  return (
    <main className="mx-auto max-w-md px-0 py-0 sm:px-4 sm:py-16">
      <section className="rounded-none sm:rounded-hero app-card px-4 py-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-eyebrow text-orange-400">
          {dictionary.auth.resetPassword.eyebrow}
        </p>

        {linkState === "loading" && (
          <p className="mt-6 app-muted">
            {dictionary.auth.resetPassword.verifyingLink}
          </p>
        )}

        {linkState === "invalid" && (
          <>
            <h1 className="font-display mt-4 text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
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

        {linkState === "ready" && !done && (
          <>
            <h1 className="font-display mt-4 text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
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
            <h1 className="font-display mt-4 text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
              {dictionary.auth.resetPassword.doneTitle}
            </h1>
            <p className="mt-3 app-muted">
              {dictionary.auth.resetPassword.doneDescription}
            </p>
            <div className="mt-6">
              {/* The person is signed in by now; the route picks the
                  onboarding or "My Space". */}
              <a
                href={buildContinueHref(router.locale)}
                className="inline-block rounded-2xl bg-[color:var(--foreground)] px-4 py-2 text-sm font-medium text-[color:var(--background)]"
              >
                {dictionary.auth.resetPassword.continue}
              </a>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
