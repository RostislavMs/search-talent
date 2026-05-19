"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api-client";
import { useDictionary, useLocalizedRouter } from "@/lib/i18n/client";

type Step = "confirm" | "code" | "done";
type Mode = "erase" | "anonymize";

export default function DeleteAccountSection({ email }: { email: string }) {
  const dictionary = useDictionary();
  const t = dictionary.dashboardProfile.deleteAccount;
  const router = useLocalizedRouter();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("confirm");
  const [mode, setMode] = useState<Mode>("erase");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) {
        closeModal();
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pending]);

  const closeModal = () => {
    if (pending) return;
    setOpen(false);
    setTimeout(() => {
      setStep("confirm");
      setCode("");
      setError(null);
    }, 150);
  };

  const requestCode = async () => {
    setPending(true);
    setError(null);

    const result = await apiFetch("/api/profile/delete/request", {
      method: "POST",
    });

    setPending(false);

    if (!result.ok) {
      setError(result.error || t.sendFailed);
      return;
    }

    setStep("code");
  };

  const resendCode = async () => {
    setResending(true);
    setError(null);

    const result = await apiFetch("/api/profile/delete/request", {
      method: "POST",
    });

    setResending(false);

    if (!result.ok) {
      setError(result.error || t.sendFailed);
    }
  };

  const confirmDelete = async () => {
    const trimmed = code.trim();

    if (!/^\d{6,10}$/u.test(trimmed)) {
      setError(t.codeRequired);
      return;
    }

    setPending(true);
    setError(null);

    const result = await apiFetch("/api/profile/delete/confirm", {
      method: "POST",
      body: { code: trimmed, mode },
    });

    setPending(false);

    if (!result.ok) {
      const reason = result.error;

      if (reason === "code_expired") {
        setError(t.codeExpired);
      } else if (
        reason === "invalid_code" ||
        reason === "Invalid code format"
      ) {
        setError(t.codeInvalid);
      } else {
        setError(reason || t.deleteFailed);
      }
      return;
    }

    setStep("done");

    setTimeout(() => {
      router.replace("/");
      router.refresh();
    }, 1600);
  };

  return (
    <>
      <section className="mt-8 rounded-[2rem] border border-rose-300/50 bg-rose-50/40 p-6 sm:p-8 dark:border-rose-500/30 dark:bg-rose-500/5">
        <h2 className="text-lg font-semibold text-rose-700 dark:text-rose-300">
          {t.sectionTitle}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 app-muted">
          {t.sectionDescription}
        </p>
        <div className="mt-5">
          <Button
            variant="primary"
            onClick={() => {
              setError(null);
              setCode("");
              setMode("erase");
              setStep("confirm");
              setOpen(true);
            }}
            className="bg-rose-600! text-white! hover:opacity-90!"
          >
            {t.openButton}
          </Button>
        </div>
      </section>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(2,6,23,0.55)] px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="w-full max-w-md rounded-[1.75rem] border app-border bg-[color:var(--surface)] p-6 shadow-[0_28px_90px_rgba(2,6,23,0.4)]">
            {step === "confirm" ? (
              <>
                <h2
                  id="delete-account-title"
                  className="text-lg font-semibold text-[color:var(--foreground)]"
                >
                  {t.step1Title}
                </h2>
                <p className="mt-3 text-sm leading-7 app-muted">
                  {t.step1Description}
                </p>

                <fieldset className="mt-5 space-y-3">
                  <legend className="text-sm font-medium text-[color:var(--foreground)]">
                    {t.modeLegend}
                  </legend>
                  {(["erase", "anonymize"] as const).map((option) => (
                    <label
                      key={option}
                      className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition ${
                        mode === option
                          ? "border-rose-400 bg-rose-500/5 dark:border-rose-400/60"
                          : "app-border hover:border-rose-300/60"
                      }`}
                    >
                      <input
                        type="radio"
                        name="delete-account-mode"
                        value={option}
                        checked={mode === option}
                        onChange={() => setMode(option)}
                        disabled={pending}
                        className="mt-1 h-4 w-4 accent-rose-600"
                      />
                      <span className="flex flex-col gap-1">
                        <span className="text-sm font-semibold text-[color:var(--foreground)]">
                          {option === "erase" ? t.modeEraseTitle : t.modeAnonymizeTitle}
                        </span>
                        <span className="text-xs leading-6 app-muted">
                          {option === "erase"
                            ? t.modeEraseDescription
                            : t.modeAnonymizeDescription}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>

                {error ? (
                  <p className="mt-3 text-sm text-rose-500">{error}</p>
                ) : null}
                <div className="mt-6 flex flex-wrap justify-end gap-2">
                  <Button
                    variant="ghost"
                    onClick={closeModal}
                    disabled={pending}
                  >
                    {t.cancel}
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => void requestCode()}
                    disabled={pending}
                    className="bg-rose-600! text-white! hover:opacity-90!"
                  >
                    {pending ? t.sendingCode : t.sendCode}
                  </Button>
                </div>
              </>
            ) : null}

            {step === "code" ? (
              <>
                <h2
                  id="delete-account-title"
                  className="text-lg font-semibold text-[color:var(--foreground)]"
                >
                  {t.step2Title}
                </h2>
                <p className="mt-3 text-sm leading-7 app-muted">
                  {t.step2Description.replace("{email}", email)}
                </p>

                <label
                  htmlFor="delete-account-code"
                  className="mt-5 block text-sm font-medium text-[color:var(--foreground)]"
                >
                  {t.codeLabel}
                </label>
                <input
                  id="delete-account-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6,10}"
                  maxLength={10}
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/gu, "").slice(0, 10))
                  }
                  placeholder={t.codePlaceholder}
                  disabled={pending}
                  className="mt-2 w-full rounded-2xl border app-border bg-[color:var(--surface)] px-4 py-3 text-center text-lg font-semibold tracking-[0.4em] text-[color:var(--foreground)] focus:outline-none focus:ring-2 focus-visible:ring-[color:var(--ring)]"
                />

                {error ? (
                  <p className="mt-3 text-sm text-rose-500">{error}</p>
                ) : null}

                <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => void resendCode()}
                    disabled={pending || resending}
                    className="text-sm font-medium text-[color:var(--muted-foreground)] underline-offset-4 hover:underline disabled:opacity-60"
                  >
                    {resending ? t.resending : t.resend}
                  </button>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      variant="ghost"
                      onClick={closeModal}
                      disabled={pending}
                    >
                      {t.cancel}
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => void confirmDelete()}
                      disabled={pending}
                      className="bg-rose-600! text-white! hover:opacity-90!"
                    >
                      {pending ? t.deleting : t.confirmDelete}
                    </Button>
                  </div>
                </div>
              </>
            ) : null}

            {step === "done" ? (
              <>
                <h2
                  id="delete-account-title"
                  className="text-lg font-semibold text-[color:var(--foreground)]"
                >
                  {t.successTitle}
                </h2>
                <p className="mt-3 text-sm leading-7 app-muted">
                  {t.successDescription}
                </p>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
