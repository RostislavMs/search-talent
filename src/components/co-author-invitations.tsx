"use client";

import { useEffect, useState } from "react";
import OptimizedImage from "@/components/ui/optimized-image";
import type { CoAuthorInvitation, CoAuthorContentType } from "@/lib/co-authors";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";

/**
 * Lists the current user's pending co-author invitations with inline
 * Accept / Decline actions. Accepting the last outstanding invite on a held
 * draft auto-publishes it (server-side). Renders nothing when there are none,
 * so it is safe to mount unconditionally (e.g. atop the notifications page).
 */
export default function CoAuthorInvitations({ locale }: { locale: string }) {
  const dict = getDictionary(isLocale(locale) ? locale : "en").coAuthors;
  const typeLabels: Record<CoAuthorContentType, string> = {
    project: dict.typeProject,
    article: dict.typeArticle,
    poll: dict.typePoll,
  };
  const [invitations, setInvitations] = useState<CoAuthorInvitation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/co-author-invitations");
        const data = (await response.json()) as {
          invitations?: CoAuthorInvitation[];
        };
        if (!cancelled) setInvitations(data.invitations ?? []);
      } catch {
        if (!cancelled) setInvitations([]);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function respond(
    invitation: CoAuthorInvitation,
    action: "accept" | "decline",
  ) {
    setBusyId(invitation.id);
    try {
      const response = await fetch(
        `/api/co-author-invitations/${invitation.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentType: invitation.contentType, action }),
        },
      );
      if (response.ok) {
        setInvitations((prev) =>
          prev.filter((item) => item.id !== invitation.id),
        );
      }
    } finally {
      setBusyId(null);
    }
  }

  if (!loaded || invitations.length === 0) return null;

  return (
    <section className="mb-6 rounded-hero app-card p-5">
      <h2 className="font-display text-lg font-semibold text-[color:var(--foreground)]">
        {dict.invitationsHeading}
      </h2>
      <ul className="mt-4 space-y-3">
        {invitations.map((invitation) => {
          const inviterLabel =
            invitation.inviter.name ||
            invitation.inviter.username ||
            dict.authorFallback;
          const typeLabel = typeLabels[invitation.contentType];
          const busy = busyId === invitation.id;

          return (
            <li
              key={invitation.id}
              className="flex flex-col gap-3 rounded-2xl app-panel p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[color:var(--surface-muted)] text-xs font-semibold text-[color:var(--foreground)]">
                  {invitation.inviter.avatarUrl ? (
                    <OptimizedImage
                      src={invitation.inviter.avatarUrl}
                      alt={inviterLabel}
                      fill
                      sizes="36px"
                      className="object-cover"
                    />
                  ) : (
                    <span>{inviterLabel.slice(0, 1).toUpperCase()}</span>
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-[color:var(--foreground)]">
                    <span className="font-semibold">{inviterLabel}</span>{" "}
                    {dict.invitedYou}
                  </p>
                  <p className="truncate text-sm app-muted">
                    <span className="uppercase tracking-eyebrow text-xs app-soft">
                      {typeLabel}
                    </span>{" "}
                    · «{invitation.contentTitle}»
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => respond(invitation, "accept")}
                  className="rounded-full bg-[color:var(--foreground)] px-4 py-1.5 text-sm font-semibold text-[color:var(--background)] transition hover:opacity-90 disabled:opacity-50"
                >
                  {dict.accept}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => respond(invitation, "decline")}
                  className="rounded-full border app-border px-4 py-1.5 text-sm font-medium app-muted transition hover:text-[color:var(--foreground)] disabled:opacity-50"
                >
                  {dict.decline}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
