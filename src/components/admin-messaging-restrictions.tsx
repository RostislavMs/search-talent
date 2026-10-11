"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api-client";
import type { MessagingRestriction } from "@/lib/db/messages";
import { personLabel } from "@/lib/messages";
import type { ModerationCopy } from "@/lib/moderation-copy";

/** Who cannot write right now, and "Lift" for each. */
export default function AdminMessagingRestrictions({
  copy,
  locale,
  restrictions,
}: {
  copy: ModerationCopy;
  locale: string;
  restrictions: MessagingRestriction[];
}) {
  const router = useRouter();
  const [lifting, setLifting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const dashboard = copy.dashboard;
  const format = (iso: string) =>
    new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", { dateStyle: "medium" }).format(new Date(iso));

  async function lift(userId: string) {
    setLifting(userId);
    setError("");
    const result = await apiFetch("/api/admin/messaging-restrictions", {
      method: "POST",
      body: { userId, scope: null },
    });
    setLifting(null);

    if (!result.ok) {
      setError(result.error || copy.actions.errorFallback);
      return;
    }

    router.refresh();
  }

  return (
    <section className="rounded-none sm:rounded-hero app-card p-5 sm:p-8">
      <h2 className="font-display text-xl font-medium tracking-tight text-[color:var(--foreground)]">
        {dashboard.restrictionsTitle}
      </h2>
      {restrictions.length === 0 ? (
        <p className="mt-3 text-sm app-muted">{dashboard.restrictionsEmpty}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {restrictions.map((item) => (
            <li key={item.userId} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl app-panel px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[color:var(--foreground)]">
                  {personLabel(item.person, item.userId)}
                </p>
                <p className="text-xs app-muted">
                  {dashboard.restrictionScopes[item.scope]} ·{" "}
                  {item.until ? dashboard.restrictionUntil.replace("{date}", format(item.until)) : dashboard.restrictionForever}
                  {item.source === "system" ? ` · ${dashboard.restrictionSystem}` : ""}
                </p>
                {item.reason && item.source === "admin" ? <p className="mt-1 text-xs app-soft">{item.reason}</p> : null}
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled={lifting === item.userId}
                onClick={() => void lift(item.userId)}
              >
                {lifting === item.userId ? copy.actions.saving : dashboard.liftRestriction}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
    </section>
  );
}
