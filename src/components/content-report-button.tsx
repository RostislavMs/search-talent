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

type ContentReportButtonProps = {
  copy: ModerationCopy;
  targetType: ReportTargetType;
  targetId: string;
  isAuthenticated: boolean;
};

export default function ContentReportButton({
  copy,
  targetType,
  targetId,
  isAuthenticated,
}: ContentReportButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("inappropriate_content");
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const reportCopy = copy.report;

  if (!isAuthenticated) {
    return (
      <LocalizedLink
        href="/login"
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
      setError(result.error || reportCopy.errorFallback);
      return;
    }

    setSuccess(reportCopy.success);
    setDetails("");
    setReason("inappropriate_content");
    router.refresh();
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setIsOpen(true)}>
        {targetType === "project"
          ? reportCopy.buttonProject
          : reportCopy.buttonProfile}
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-end bg-black/45 px-4 py-4 sm:items-center sm:px-6">
          <div className="mx-auto w-full max-w-2xl rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-xl">
                <h2 className="text-2xl font-semibold text-[color:var(--foreground)]">
                  {targetType === "project"
                    ? reportCopy.titleProject
                    : reportCopy.titleProfile}
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
