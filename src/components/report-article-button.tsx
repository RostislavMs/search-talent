"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import FormSelect from "@/components/ui/form-select";
import FormTextarea from "@/components/ui/form-textarea";
import { apiFetch } from "@/lib/api-client";
import {
  reportReasons,
  type ReportReason,
} from "@/lib/moderation";
import { getModerationCopy } from "@/lib/moderation-copy";
import type { Locale } from "@/lib/i18n/config";

export default function ReportArticleButton({
  articleId,
  locale,
}: {
  articleId: string;
  locale: string;
}) {
  const router = useRouter();
  const copy = getModerationCopy(locale as Locale);
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("inappropriate_content");
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const ui = locale === "uk"
    ? {
        button: "Поскаржитися на статтю",
        title: "Скарга на статтю",
      }
    : {
        button: "Report article",
        title: "Report article",
      };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccess("");

    const result = await apiFetch("/api/reports", {
      method: "POST",
      body: {
        targetType: "article",
        targetId: articleId,
        reason,
        details,
      },
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error || copy.report.errorFallback);
      return;
    }

    setSuccess(copy.report.success);
    setDetails("");
    setReason("inappropriate_content");
    router.refresh();
  }

  return (
    <>
      <Button variant="ghost" onClick={() => setIsOpen(true)}>
        {ui.button}
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-end bg-black/45 px-4 py-4 sm:items-center sm:px-6">
          <div className="mx-auto w-full max-w-2xl rounded-hero border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-xl">
                <h2 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
                  {ui.title}
                </h2>
                <p className="mt-3 text-sm leading-7 app-muted">
                  {copy.report.description}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                {copy.report.close}
              </Button>
            </div>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <label className="block">
                <span className="text-sm font-medium text-[color:var(--foreground)]">
                  {copy.report.reasonLabel}
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
                  {copy.report.detailsLabel}
                </span>
                <FormTextarea
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  rows={5}
                  maxLength={1200}
                  placeholder={copy.report.detailsPlaceholder}
                  className="mt-2 w-full px-4 py-3 text-sm leading-7 text-[color:var(--foreground)]"
                />
              </label>

              {error && <p className="text-sm text-rose-600">{error}</p>}
              {success && <p className="text-sm text-emerald-600">{success}</p>}

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? copy.report.sending : copy.report.submit}
                </Button>
                <Button variant="secondary" onClick={() => setIsOpen(false)}>
                  {copy.report.cancel}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
