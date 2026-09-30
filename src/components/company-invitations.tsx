"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import CompanyLogo from "@/components/company-logo";
import { Button } from "@/components/ui/Button";
import LocalizedLink from "@/components/ui/localized-link";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { buildCompanyPath, COMPANY_LIMITS, type CompanyInvitation } from "@/lib/companies";
import { useDictionary } from "@/lib/i18n/client";

/**
 * Invitations to company teams waiting for an answer, with Accept / Decline.
 * Pass `initialInvitations` when the page already loaded them; without it the
 * list is fetched (the notifications page). Renders nothing when there are none.
 */
export default function CompanyInvitations({
  initialInvitations,
}: {
  initialInvitations?: CompanyInvitation[];
}) {
  const router = useRouter();
  const toast = useToast();
  const dictionary = useDictionary();
  const copy = dictionary.companies;
  const ui = copy.invitations;
  const [invitations, setInvitations] = useState<CompanyInvitation[]>(
    initialInvitations ?? [],
  );
  const [loaded, setLoaded] = useState(Boolean(initialInvitations));
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (initialInvitations) return;

    let cancelled = false;
    void (async () => {
      const result = await apiFetch<{ invitations?: CompanyInvitation[] }>(
        "/api/company-invitations",
      );
      if (!cancelled) {
        setInvitations(result.ok ? (result.data.invitations ?? []) : []);
        setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialInvitations]);

  async function respond(invitation: CompanyInvitation, action: "accept" | "decline") {
    setBusyId(invitation.memberId);
    const result = await apiFetch(`/api/company-invitations/${invitation.memberId}`, {
      method: "PATCH",
      body: { action },
    });
    setBusyId(null);

    if (!result.ok) {
      toast.error(
        result.code === "membership_limit"
          ? copy.team.errors.membership_limit.replace(
              "{limit}",
              String(COMPANY_LIMITS.membershipsPerUser),
            )
          : ui.error,
      );
      return;
    }

    setInvitations((current) =>
      current.filter((item) => item.memberId !== invitation.memberId),
    );
    toast.success(action === "accept" ? ui.accepted : ui.declined);
    router.refresh();
  }

  if (!loaded || invitations.length === 0) {
    return null;
  }

  return (
    <section className="mb-6 rounded-hero app-card p-5" aria-labelledby="company-invitations-title">
      <h2
        id="company-invitations-title"
        className="font-display text-lg font-semibold text-[color:var(--foreground)]"
      >
        {ui.heading}
      </h2>
      <p className="mt-1 text-sm app-muted">{ui.joinNote}</p>
      <ul className="mt-4 space-y-3">
        {invitations.map((invitation) => {
          const busy = busyId === invitation.memberId;
          const inviter =
            invitation.inviter?.name ||
            (invitation.inviter?.username ? `@${invitation.inviter.username}` : ui.someone);

          return (
            <li
              key={invitation.memberId}
              className="flex flex-col gap-3 rounded-2xl app-panel p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <CompanyLogo
                  name={invitation.company.name}
                  logoUrl={invitation.company.logoUrl}
                  alt={copy.logoAlt.replace("{name}", invitation.company.name)}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="text-sm text-[color:var(--foreground)]">
                    <span className="font-semibold">{inviter}</span> {ui.invitedYou}{" "}
                    <LocalizedLink
                      href={buildCompanyPath(invitation.company.slug)}
                      className="font-semibold transition-colors hover:text-[color:var(--brand)]"
                    >
                      {invitation.company.name}
                    </LocalizedLink>
                  </p>
                  <p className="text-xs app-muted">
                    {ui.asRole.replace("{role}", copy.roles[invitation.role])}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 gap-2">
                <Button size="sm" disabled={busy} onClick={() => void respond(invitation, "accept")}>
                  {ui.accept}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void respond(invitation, "decline")}
                >
                  {ui.decline}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
