"use client";

import { useState } from "react";
import {
  AUTH_LIMITS,
  changePasswordSchema,
  getAuthErrorMessage,
  getAuthFieldErrors,
  type AuthFieldErrors,
} from "@/lib/auth/validation";
import { useDictionary } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import PasswordInput from "@/components/ui/password-input";

export default function ChangePasswordSection() {
  const supabase = createClient();
  const dictionary = useDictionary();
  const t = dictionary.dashboardProfile.changePassword;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const clearFeedback = () => {
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;

    clearFeedback();
    setFieldErrors({});

    const parsed = changePasswordSchema.safeParse({
      currentPassword,
      newPassword,
      confirmPassword,
    });

    if (!parsed.success) {
      const nextFieldErrors = getAuthFieldErrors(parsed.error);
      setFieldErrors(
        Object.fromEntries(
          Object.entries(nextFieldErrors).map(([field, code]) => [
            field,
            getAuthErrorMessage(code || "generic", dictionary),
          ]),
        ) as AuthFieldErrors,
      );
      return;
    }

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      setLoading(false);
      setError(t.genericError);
      return;
    }

    // Verify the current password by re-authenticating the same user.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInError) {
      setLoading(false);
      setFieldErrors({ currentPassword: t.wrongCurrent });
      return;
    }

    // Changing the password through the user's session triggers Supabase's
    // built-in "Password changed" security notification email.
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setLoading(false);

    if (updateError) {
      setError(t.genericError);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSuccess(true);
  };

  return (
    <section className="rounded-hero app-card p-6 sm:p-8">
      <h2 className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
        {t.sectionTitle}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-7 app-muted">
        {t.sectionDescription}
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-5 flex max-w-md flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="current-password"
            className="text-sm font-medium text-[color:var(--foreground)]"
          >
            {t.currentLabel}
          </label>
          <PasswordInput
            id="current-password"
            value={currentPassword}
            onChange={(event) => {
              setCurrentPassword(event.target.value);
              clearFeedback();
              setFieldErrors((current) => ({ ...current, currentPassword: undefined }));
            }}
            autoComplete="current-password"
            maxLength={AUTH_LIMITS.passwordMaxLength}
            aria-invalid={Boolean(fieldErrors.currentPassword)}
            aria-describedby={
              fieldErrors.currentPassword ? "current-password-error" : undefined
            }
          />
          {fieldErrors.currentPassword && (
            <p id="current-password-error" className="text-sm text-rose-500">
              {fieldErrors.currentPassword}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="new-password"
            className="text-sm font-medium text-[color:var(--foreground)]"
          >
            {t.newLabel}
          </label>
          <PasswordInput
            id="new-password"
            value={newPassword}
            onChange={(event) => {
              setNewPassword(event.target.value);
              clearFeedback();
              setFieldErrors((current) => ({ ...current, newPassword: undefined }));
            }}
            autoComplete="new-password"
            maxLength={AUTH_LIMITS.passwordMaxLength}
            aria-invalid={Boolean(fieldErrors.newPassword)}
            aria-describedby={`new-password-hint${fieldErrors.newPassword ? " new-password-error" : ""}`}
          />
          <p id="new-password-hint" className="text-sm app-muted">
            {dictionary.auth.passwordHint}
          </p>
          {fieldErrors.newPassword && (
            <p id="new-password-error" className="text-sm text-rose-500">
              {fieldErrors.newPassword}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="confirm-new-password"
            className="text-sm font-medium text-[color:var(--foreground)]"
          >
            {t.confirmLabel}
          </label>
          <PasswordInput
            id="confirm-new-password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              clearFeedback();
              setFieldErrors((current) => ({ ...current, confirmPassword: undefined }));
            }}
            autoComplete="new-password"
            maxLength={AUTH_LIMITS.passwordMaxLength}
            aria-invalid={Boolean(fieldErrors.confirmPassword)}
            aria-describedby={
              fieldErrors.confirmPassword ? "confirm-new-password-error" : undefined
            }
          />
          {fieldErrors.confirmPassword && (
            <p id="confirm-new-password-error" className="text-sm text-rose-500">
              {fieldErrors.confirmPassword}
            </p>
          )}
        </div>

        {error && <p className="text-sm text-rose-500">{error}</p>}
        {success && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">{t.success}</p>
        )}

        <div>
          <Button type="submit" disabled={loading}>
            {loading ? t.submitting : t.submit}
          </Button>
        </div>
      </form>
    </section>
  );
}
