"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import CompanyVerifiedBadge from "@/components/company-verified-badge";
import { Button } from "@/components/ui/Button";
import LocalizedLink from "@/components/ui/localized-link";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { isCompanyVerificationCode, type CompanyDomainCheck } from "@/lib/companies";
import { useDictionary } from "@/lib/i18n/client";

type FailedReason = Extract<CompanyDomainCheck, { ok: false }>["reason"];
type Step = { kind: "email" } | { kind: "code"; email: string };

const LABEL_CLASS = "mb-2 block text-sm font-medium text-[color:var(--foreground)]";

/**
 * Verification block of the company editor.
 *
 * The check is "can you read mail on the website's domain". If the address the
 * person signs in with is already on it, one click is enough (`accountCheck`,
 * worked out on the server). Otherwise they enter any work address on the
 * domain, get a one-time code there and type it in. The server decides again
 * at every step; this component only picks what to offer.
 */
export default function CompanyVerificationCard({
  companyId,
  verified,
  method,
  accountCheck,
  websiteHost,
}: {
  companyId: string;
  verified: boolean;
  method: "email_domain" | "admin" | null;
  /** The domain check for the signed-in account's own email. */
  accountCheck: CompanyDomainCheck;
  websiteHost: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const dictionary = useDictionary();
  const copy = dictionary.companies;
  const ui = copy.verification;
  const fieldId = useId();

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCodeForm, setShowCodeForm] = useState(!accountCheck.ok);
  const [step, setStep] = useState<Step>({ kind: "email" });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  const host = websiteHost ?? "";
  // Only these two block the whole card; the rest are about a particular address.
  const blocked =
    !accountCheck.ok && (accountCheck.reason === "school" || accountCheck.reason === "no_website")
      ? accountCheck.reason
      : null;

  function explain(codeValue: string | undefined, status: number, address: string): string {
    if (status === 429) return ui.codeErrors.rate_limited;
    if (codeValue && codeValue in ui.reasons) {
      return ui.reasons[codeValue as FailedReason].replace("{email}", address).replace("{host}", host);
    }
    if (codeValue && codeValue in ui.codeErrors) {
      return ui.codeErrors[codeValue as keyof typeof ui.codeErrors];
    }
    return ui.error;
  }

  async function finish(body?: { code: string }) {
    setPending(true);
    setError(null);
    const result = await apiFetch(`/api/companies/${companyId}/verify`, {
      method: "POST",
      ...(body ? { body } : {}),
    });
    setPending(false);

    if (!result.ok) {
      setError(explain(result.code, result.status, step.kind === "code" ? step.email : ""));
      return;
    }

    toast.success(ui.success);
    router.refresh();
  }

  async function sendCode(address: string) {
    setPending(true);
    setError(null);
    const result = await apiFetch(`/api/companies/${companyId}/verify/code`, {
      method: "POST",
      body: { email: address },
    });
    setPending(false);

    if (!result.ok) {
      setError(explain(result.code, result.status, address));
      return;
    }

    setCode("");
    setStep({ kind: "code", email: address });
  }

  function onSendSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    if (!address.includes("@")) {
      setError(ui.codeErrors.invalid_email);
      return;
    }
    void sendCode(address);
  }

  function onCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isCompanyVerificationCode(code)) {
      setError(ui.codeErrors.wrong_code);
      return;
    }
    void finish({ code });
  }

  const contactLink = (
    <LocalizedLink
      href="/contacts"
      className="font-medium text-[color:var(--brand)] transition-colors hover:text-[color:var(--brand-strong)]"
    >
      {ui.contact} →
    </LocalizedLink>
  );

  return (
    <section
      className="rounded-none app-card p-5 sm:rounded-hero sm:p-6"
      aria-labelledby="company-verification-title"
    >
      <h2
        id="company-verification-title"
        className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]"
      >
        {verified ? ui.verifiedTitle : ui.title}
      </h2>

      {verified ? (
        <div className="mt-3 space-y-2">
          <CompanyVerifiedBadge label={copy.verified} hint={copy.verifiedHint} />
          <p className="text-sm leading-6 app-muted">
            {method === "admin" ? ui.verifiedByAdmin : ui.verifiedByEmail}
          </p>
          <p className="text-xs leading-5 app-soft">{copy.form.renameWarning}</p>
        </div>
      ) : blocked ? (
        <p className="mt-3 rounded-2xl app-panel p-4 text-sm leading-6 text-[color:var(--foreground)]">
          {ui.reasons[blocked].replace("{email}", "").replace("{host}", host)}{" "}
          {blocked === "school" ? contactLink : null}
        </p>
      ) : (
        <div className="mt-3 space-y-4">
          <p className="text-sm leading-6 app-muted">{ui.description}</p>

          {accountCheck.ok ? (
            <div className="space-y-2">
              <Button onClick={() => void finish()} disabled={pending}>
                {pending && !showCodeForm
                  ? ui.verifying
                  : ui.button.replace("{domain}", accountCheck.domain)}
              </Button>
              {!showCodeForm ? (
                <button
                  type="button"
                  onClick={() => setShowCodeForm(true)}
                  className="block text-sm font-medium text-[color:var(--brand)] transition-colors hover:text-[color:var(--brand-strong)]"
                >
                  {ui.otherEmail}
                </button>
              ) : null}
            </div>
          ) : null}

          {showCodeForm && step.kind === "email" ? (
            <form onSubmit={onSendSubmit} noValidate className="space-y-3">
              <div>
                <label htmlFor={`${fieldId}-email`} className={LABEL_CLASS}>
                  {ui.workEmailLabel.replace("{host}", host)}
                </label>
                <input
                  id={`${fieldId}-email`}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  className="app-input"
                  value={email}
                  maxLength={320}
                  placeholder={ui.workEmailPlaceholder.replace("{host}", host)}
                  aria-describedby={`${fieldId}-email-hint`}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError(null);
                  }}
                />
                <p id={`${fieldId}-email-hint`} className="mt-1.5 text-xs leading-5 app-soft">
                  {ui.howItWorks}
                </p>
              </div>
              <Button type="submit" variant={accountCheck.ok ? "secondary" : "primary"} disabled={pending}>
                {pending ? ui.sending : ui.sendCode}
              </Button>
            </form>
          ) : null}

          {showCodeForm && step.kind === "code" ? (
            <form onSubmit={onCodeSubmit} noValidate className="space-y-3">
              <p role="status" className="text-sm leading-6 text-[color:var(--foreground)]">
                {ui.codeSent.replace("{email}", step.email)}
              </p>
              <div>
                <label htmlFor={`${fieldId}-code`} className={LABEL_CLASS}>
                  {ui.codeLabel}
                </label>
                <input
                  id={`${fieldId}-code`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  className="app-input tracking-[0.3em]"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                    setError(null);
                  }}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={pending || code.length !== 6}>
                  {pending ? ui.verifying : ui.confirm}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => void sendCode(step.email)}
                >
                  {ui.resend}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    setStep({ kind: "email" });
                    setError(null);
                  }}
                >
                  {ui.otherEmail}
                </Button>
              </div>
            </form>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm leading-6 text-rose-500">
              {error}{" "}
              {error === ui.codeErrors.email_unavailable ? contactLink : null}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
