"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import ApplicationStatusPill from "@/components/application-status-pill";
import { Button, ButtonLink } from "@/components/ui/Button";
import FormTextarea from "@/components/ui/form-textarea";
import OptimizedImage from "@/components/ui/optimized-image";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import {
  APPLICATION_LIMITS,
  APPLY_REFUSALS,
  MY_APPLICATIONS_PATH,
  type ApplicationProject,
  type ApplicationStatus,
  type ApplyRefusal,
  type ApplyState,
} from "@/lib/applications";
import { useDictionary, useLocalizedRouter } from "@/lib/i18n/client";
import { formatCount } from "@/lib/vacancies";
import { formatVacancyDate } from "@/lib/vacancy-presentation";

type ApplyErrorKey = ApplyRefusal | "invalid" | "consent" | "projectsRequired" | "generic";

/**
 * «Відгукнутися» on the vacancy page. Every state the visitor can be in gets
 * one plain sentence and the one action that moves them on: sign in, confirm
 * the email, finish the profile, publish a project — or the form itself, in a
 * dialog: 1–3 projects, a message, the contacts the company will get, and the
 * consent to hand them over.
 */
export default function VacancyApplyPanel({
  state,
  locale,
  vacancy,
  projects,
  contacts,
  application,
  loginHref,
  teamHref,
  applicationsCount,
}: {
  state: ApplyState;
  locale: string;
  vacancy: { id: string; title: string; companyName: string };
  projects: ApplicationProject[];
  contacts: { email: string | null; phone: string | null };
  application: { status: ApplicationStatus; createdAt: string } | null;
  loginHref: string;
  teamHref: string;
  applicationsCount: { total: number; fresh: number } | null;
}) {
  const dictionary = useDictionary();
  const copy = dictionary.applications;
  const t = copy.apply;
  const toast = useToast();
  const router = useLocalizedRouter();
  const titleId = useId();
  const messageId = useId();
  const consentId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(() =>
    projects.length === 1 ? [projects[0].id] : [],
  );
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ApplyErrorKey | null>(null);

  const close = useCallback(() => {
    if (sending) return;
    setOpen(false);
    triggerRef.current?.focus();
  }, [sending]);

  useEffect(() => {
    if (!open) return;

    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, close]);

  const errorText = (key: ApplyErrorKey) =>
    t.errors[key]
      .replace("{max}", String(
        key === "message_long"
          ? APPLICATION_LIMITS.messageMax
          : key === "daily_limit"
            ? APPLICATION_LIMITS.perDay
            : APPLICATION_LIMITS.projectsMax,
      ));

  const toggleProject = (id: string) => {
    setError(null);
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length >= APPLICATION_LIMITS.projectsMax
          ? current
          : [...current, id],
    );
  };

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (selected.length === 0) {
      setError("projectsRequired");
      return;
    }
    if (!consent) {
      setError("consent");
      return;
    }

    setSending(true);
    setError(null);
    const result = await apiFetch(`/api/vacancies/${vacancy.id}/applications`, {
      method: "POST",
      body: { project_ids: selected, message, consent: true },
    });
    setSending(false);

    if (!result.ok) {
      const code = result.code;
      setError(
        code && ((APPLY_REFUSALS as readonly string[]).includes(code) || code === "invalid")
          ? (code as ApplyErrorKey)
          : "generic",
      );
      // Applied in another tab, or the vacancy closed meanwhile: the panel
      // behind the dialog should say so too.
      if (code === "already_applied" || code === "not_open" || code === "own_company") {
        router.refresh();
      }
      return;
    }

    setOpen(false);
    toast.success(t.sent);
    router.refresh();
  }

  const appliedOn = application ? formatVacancyDate(application.createdAt, locale) : null;

  let body: ReactNode;

  switch (state) {
    case "team":
      body = (
        <>
          <p className="text-sm leading-6 app-muted">
            {t.teamText}
            {applicationsCount && applicationsCount.total > 0
              ? ` ${formatCount(applicationsCount.total, copy.team.count, locale)}${
                  applicationsCount.fresh > 0
                    ? ` · ${formatCount(applicationsCount.fresh, copy.team.freshCount, locale)}`
                    : ""
                }.`
              : ""}
          </p>
          <ButtonLink href={teamHref} size="sm" className="mt-4">
            {t.teamCta}
          </ButtonLink>
        </>
      );
      break;
    case "applied":
      body = (
        <>
          {application ? (
            <div className="space-y-2">
              <ApplicationStatusPill status={application.status} labels={copy.candidateStatuses} />
              <p className="text-sm leading-6 app-muted">
                {appliedOn ? `${t.appliedText.replace("{date}", appliedOn)} ` : ""}
                {copy.candidateStatusHints[application.status]}
              </p>
            </div>
          ) : null}
          <ButtonLink href={MY_APPLICATIONS_PATH} variant="secondary" size="sm" className="mt-4">
            {t.appliedCta}
          </ButtonLink>
        </>
      );
      break;
    case "closed":
      body = <p className="text-sm leading-6 app-muted">{t.closedText}</p>;
      break;
    case "sign_in":
      body = (
        <>
          <p className="text-sm leading-6 app-muted">{t.signInText}</p>
          <ButtonLink href={loginHref} size="sm" className="mt-4">
            {t.signIn}
          </ButtonLink>
        </>
      );
      break;
    case "confirm_email":
      body = <p className="text-sm leading-6 app-muted">{t.confirmEmailText}</p>;
      break;
    case "need_profile":
      body = (
        <>
          <p className="text-sm leading-6 app-muted">{t.needProfileText}</p>
          <ButtonLink href="/onboarding" size="sm" className="mt-4">
            {t.needProfileCta}
          </ButtonLink>
        </>
      );
      break;
    case "need_project":
      body = (
        <>
          <p className="text-sm leading-6 app-muted">{t.needProjectText}</p>
          <ButtonLink href="/projects/new" size="sm" className="mt-4">
            {t.needProjectCta}
          </ButtonLink>
        </>
      );
      break;
    default:
      body = (
        <>
          <p className="text-sm leading-6 app-muted">{t.intro}</p>
          <Button
            ref={triggerRef}
            className="mt-4 w-full sm:w-auto"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            {t.button}
          </Button>
        </>
      );
  }

  const limitReached = selected.length >= APPLICATION_LIMITS.projectsMax;

  const dialog = open ? (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(2,6,23,0.55)] px-3 py-6 sm:items-center sm:px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-panel border app-border bg-[color:var(--surface)] text-left text-[color:var(--foreground)] shadow-[0_28px_90px_rgba(2,6,23,0.4)]"
      >
        <div className="flex items-start justify-between gap-4 border-b app-border p-5">
          <h2 id={titleId} className="min-w-0 break-words font-display text-lg font-semibold tracking-tight">
            {t.dialogTitle.replace("{title}", vacancy.title)}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label={t.close}
            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border app-border transition hover:bg-[color:var(--surface-muted)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto overflow-x-hidden p-5">
          {/* A fieldset is min-content wide by default: without min-w-0 a long
              project title stretches it past the dialog instead of truncating. */}
          <fieldset className="min-w-0">
            <legend className="text-sm font-semibold">{t.projectsLabel}</legend>
            <p className="mt-1 text-xs leading-5 app-muted">
              {limitReached ? t.projectsLimit.replace("{max}", String(APPLICATION_LIMITS.projectsMax)) : t.projectsHint}
            </p>
            <ul className="mt-3 space-y-2">
              {projects.map((project) => {
                const checked = selected.includes(project.id);
                const disabled = !checked && limitReached;
                return (
                  <li key={project.id}>
                    <label
                      className={`flex items-center gap-3 rounded-xl border p-2.5 transition ${
                        checked
                          ? "border-[color:var(--brand)] bg-[color:var(--surface-muted)]"
                          : "app-border"
                      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-[color:var(--surface-muted)]"}`}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 accent-[color:var(--brand)]"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleProject(project.id)}
                      />
                      <span className="relative h-10 w-16 shrink-0 overflow-hidden rounded-lg bg-[color:var(--surface-muted)]">
                        {project.coverUrl ? (
                          <OptimizedImage src={project.coverUrl} alt="" fill sizes="64px" className="object-cover" />
                        ) : null}
                      </span>
                      <span className="min-w-0 truncate text-sm font-medium" title={project.title}>
                        {project.title}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          <div>
            <label htmlFor={messageId} className="text-sm font-semibold">
              {t.messageLabel}
            </label>
            <FormTextarea
              id={messageId}
              className="mt-2 min-h-28 w-full px-4 py-3 text-sm leading-7 text-[color:var(--foreground)]"
              value={message}
              maxLength={APPLICATION_LIMITS.messageMax}
              placeholder={t.messagePlaceholder}
              onChange={(event) => setMessage(event.target.value)}
            />
            <p className="mt-1 text-right text-xs app-soft" aria-live="polite">
              {t.messageCounter
                .replace("{count}", String(message.length))
                .replace("{max}", String(APPLICATION_LIMITS.messageMax))}
            </p>
          </div>

          <div className="rounded-xl bg-[color:var(--surface-muted)] p-4">
            <p className="text-sm font-semibold">{t.contactsLabel}</p>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex flex-wrap gap-x-2">
                <dt className="app-muted">{t.contactsEmail}:</dt>
                <dd className="break-all">{contacts.email ?? t.contactsNone}</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="app-muted">{t.contactsPhone}:</dt>
                <dd>{contacts.phone ?? t.contactsNone}</dd>
              </div>
            </dl>
            <ButtonLink href="/profile/edit" variant="ghost" size="sm" className="mt-2 -ml-3">
              {t.contactsEdit}
            </ButtonLink>
          </div>

          <div>
            <div className="flex items-start gap-3">
              <input
                id={consentId}
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 accent-[color:var(--brand)]"
                checked={consent}
                onChange={(event) => {
                  setConsent(event.target.checked);
                  setError(null);
                }}
              />
              <label htmlFor={consentId} className="cursor-pointer text-sm leading-6">
                {t.consent.replace("{company}", vacancy.companyName)}
              </label>
            </div>
            <p className="mt-2 text-xs leading-5 app-muted">{t.consentNote}</p>
          </div>

          {error ? (
            <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
              {errorText(error)}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t app-border p-4">
          <Button variant="ghost" onClick={close} disabled={sending}>
            {t.cancel}
          </Button>
          <Button type="submit" disabled={sending}>
            {sending ? t.sending : t.submit}
          </Button>
        </div>
      </form>
    </div>
  ) : null;

  return (
    <section className="rounded-none app-card p-5 sm:rounded-hero sm:p-6" aria-labelledby="vacancy-apply-title">
      <h2 id="vacancy-apply-title" className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
        {state === "team" ? copy.team.eyebrow : t.title}
      </h2>
      <div className="mt-3">{body}</div>
      {dialog ? createPortal(dialog, document.body) : null}
    </section>
  );
}
