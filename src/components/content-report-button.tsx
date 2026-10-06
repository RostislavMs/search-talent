"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { buttonStyles } from "@/components/ui/button-styles";
import FormSelect from "@/components/ui/form-select";
import FormTextarea from "@/components/ui/form-textarea";
import LocalizedLink from "@/components/ui/localized-link";
import { apiFetch } from "@/lib/api-client";
import type { ModerationCopy } from "@/lib/moderation-copy";
import {
  reportReasons,
  type ReportReason,
  type ReportTargetType,
} from "@/lib/moderation";
import { useLoginHref } from "@/lib/auth/use-login-href";

type ContentReportButtonProps = {
  copy: ModerationCopy;
  targetType: ReportTargetType;
  targetId: string;
  isAuthenticated: boolean;
  /**
   * When true, the trigger is rendered as a compact flag icon (no text label)
   * — used by the minimized community-rating row. The report modal itself is
   * unchanged.
   */
  iconOnly?: boolean;
  /**
   * A small text link instead of a button — for the action row under a
   * comment, next to "Reply". Shows nothing to guests (they cannot reply
   * either).
   */
  asLink?: boolean;
};

function FlagIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M4 21V4" />
      <path d="M4 4h11l-1.6 3.5L15 11H4" />
    </svg>
  );
}

export default function ContentReportButton({
  copy,
  targetType,
  targetId,
  isAuthenticated,
  iconOnly = false,
  asLink = false,
}: ContentReportButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("inappropriate_content");
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const reportCopy = copy.report;
  const loginHref = useLoginHref();

  const { triggerLabel, dialogTitle } = {
    project: { triggerLabel: reportCopy.buttonProject, dialogTitle: reportCopy.titleProject },
    company: { triggerLabel: reportCopy.buttonCompany, dialogTitle: reportCopy.titleCompany },
    vacancy: { triggerLabel: reportCopy.buttonVacancy, dialogTitle: reportCopy.titleVacancy },
    profile: { triggerLabel: reportCopy.buttonProfile, dialogTitle: reportCopy.titleProfile },
    article: { triggerLabel: reportCopy.buttonArticle, dialogTitle: reportCopy.titleArticle },
    poll: { triggerLabel: reportCopy.buttonPoll, dialogTitle: reportCopy.titlePoll },
    project_comment: { triggerLabel: reportCopy.buttonComment, dialogTitle: reportCopy.titleComment },
    article_comment: { triggerLabel: reportCopy.buttonComment, dialogTitle: reportCopy.titleComment },
    poll_comment: { triggerLabel: reportCopy.buttonComment, dialogTitle: reportCopy.titleComment },
  }[targetType];

  if (!isAuthenticated) {
    if (asLink) {
      return null;
    }
    if (iconOnly) {
      return (
        <LocalizedLink
          href={loginHref}
          aria-label={triggerLabel}
          title={triggerLabel}
          className={buttonStyles({ variant: "ghost", size: "sm" })}
        >
          <FlagIcon />
        </LocalizedLink>
      );
    }
    return (
      <LocalizedLink
        href={loginHref}
        className={buttonStyles({ variant: "ghost", size: "sm" })}
      >
        {reportCopy.loginToReport}
      </LocalizedLink>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccess("");

    const result = await apiFetch("/api/reports", {
      method: "POST",
      body: { targetType, targetId, reason, details },
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setError(
        result.status === 409
          ? reportCopy.duplicate
          : result.status === 429
            ? reportCopy.rateLimited
            : result.error || reportCopy.errorFallback,
      );
      return;
    }

    setSuccess(reportCopy.success);
    setDetails("");
    setReason("inappropriate_content");
    router.refresh();
  }

  return (
    <>
      {asLink ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="cursor-pointer text-xs font-medium app-soft transition-colors hover:text-[color:var(--foreground)]"
        >
          {triggerLabel}
        </button>
      ) : iconOnly ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(true)}
          aria-label={triggerLabel}
          title={triggerLabel}
        >
          <FlagIcon />
        </Button>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setIsOpen(true)}>
          {triggerLabel}
        </Button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-end bg-black/45 px-4 py-4 sm:items-center sm:px-6">
          <div className="mx-auto w-full max-w-2xl rounded-hero border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-xl">
                <h2 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
                  {dialogTitle}
                </h2>
                <p className="mt-3 text-sm leading-7 app-muted">
                  {reportCopy.description}
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                {reportCopy.close}
              </Button>
            </div>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <label className="block">
                <span className="text-sm font-medium text-[color:var(--foreground)]">
                  {reportCopy.reasonLabel}
                </span>
                <FormSelect
                  value={reason}
                  onChange={(value) => setReason(value as ReportReason)}
                  className="mt-2 w-full"
                  triggerClassName="w-full text-sm"
                  options={reportReasons.map((item) => ({
                    value: item,
                    label: copy.reasonLabels[item],
                  }))}
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-[color:var(--foreground)]">
                  {reportCopy.detailsLabel}
                </span>
                <FormTextarea
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  rows={5}
                  maxLength={1200}
                  placeholder={reportCopy.detailsPlaceholder}
                  className="mt-2 w-full px-4 py-3 text-sm leading-7 text-[color:var(--foreground)]"
                />
              </label>

              {error && <p className="text-sm text-rose-600">{error}</p>}
              {success && <p className="text-sm text-emerald-600">{success}</p>}

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? reportCopy.sending : reportCopy.submit}
                </Button>
                <Button variant="secondary" onClick={() => setIsOpen(false)}>
                  {reportCopy.cancel}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
