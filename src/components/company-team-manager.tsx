"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import CoAuthorPicker, { type CoAuthorOption } from "@/components/co-author-picker";
import { Button } from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import FormSelect from "@/components/ui/form-select";
import LocalizedLink from "@/components/ui/localized-link";
import OptimizedImage from "@/components/ui/optimized-image";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import {
  canChangeCompanyRoles,
  canInviteToCompany,
  canRemoveCompanyMember,
  COMPANY_INVITE_ROLES,
  COMPANY_LIMITS,
  COMPANY_ROLES,
  isCompanyMemberError,
  type CompanyInviteRole,
  type CompanyMember,
  type CompanyRole,
} from "@/lib/companies";
import { useCurrentLocale, useDictionary } from "@/lib/i18n/client";
import { createLocalePath } from "@/lib/i18n/config";

type PendingAction =
  | { kind: "remove"; member: CompanyMember }
  | { kind: "leave"; member: CompanyMember };

/**
 * The team of a company page: who is in it, their roles, pending invitations,
 * and inviting someone new. Every change goes through the team functions in the
 * database; after it the server page is refreshed, so the list never drifts
 * from what is stored.
 */
export default function CompanyTeamManager({
  companyId,
  companyName,
  viewerUserId,
  viewerRole,
  members,
}: {
  companyId: string;
  companyName: string;
  viewerUserId: string;
  viewerRole: CompanyRole;
  members: CompanyMember[];
}) {
  const router = useRouter();
  const toast = useToast();
  const locale = useCurrentLocale();
  const dictionary = useDictionary();
  const copy = dictionary.companies;
  const ui = copy.team;

  const [picked, setPicked] = useState<CoAuthorOption[]>([]);
  const [inviteRole, setInviteRole] = useState<CompanyInviteRole>("recruiter");
  const [inviting, setInviting] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<PendingAction | null>(null);

  const canInvite = canInviteToCompany(viewerRole);
  const canChangeRoles = canChangeCompanyRoles(viewerRole);
  const ownersCount = members.filter(
    (member) => member.status === "accepted" && member.role === "owner",
  ).length;
  const self = members.find((member) => member.userId === viewerUserId) ?? null;
  const canLeave = Boolean(self) && !(self?.role === "owner" && ownersCount <= 1);

  function failure(code: string | undefined, status: number) {
    if (status === 429) return ui.errors.rate_limited;
    if (isCompanyMemberError(code)) {
      return ui.errors[code]
        .replace("{max}", String(COMPANY_LIMITS.membersMax))
        .replace("{limit}", String(COMPANY_LIMITS.membershipsPerUser));
    }
    return ui.errors.generic;
  }

  function displayName(member: Pick<CompanyMember, "name" | "username">) {
    return member.name || (member.username ? `@${member.username}` : copy.invitations.someone);
  }

  async function invite() {
    const person = picked[0];
    if (!person || inviting) return;

    setInviting(true);
    const result = await apiFetch(`/api/companies/${companyId}/members`, {
      method: "POST",
      body: { userId: person.userId, role: inviteRole },
    });
    setInviting(false);

    if (!result.ok) {
      toast.error(failure(result.code, result.status));
      return;
    }

    toast.success(ui.invited);
    setPicked([]);
    router.refresh();
  }

  async function changeRole(member: CompanyMember, role: CompanyRole) {
    if (role === member.role) return;

    setBusyMemberId(member.memberId);
    const result = await apiFetch(`/api/companies/${companyId}/members/${member.memberId}`, {
      method: "PATCH",
      body: { role },
    });
    setBusyMemberId(null);

    if (!result.ok) {
      toast.error(failure(result.code, result.status));
      return;
    }

    toast.success(ui.roleChanged);
    router.refresh();
  }

  async function runConfirmed() {
    if (!confirm) return;

    const { member, kind } = confirm;
    setBusyMemberId(member.memberId);
    const result = await apiFetch(`/api/companies/${companyId}/members/${member.memberId}`, {
      method: "DELETE",
    });
    setBusyMemberId(null);
    setConfirm(null);

    if (!result.ok) {
      toast.error(failure(result.code, result.status));
      return;
    }

    toast.success(ui.done);

    if (kind === "leave") {
      router.push(createLocalePath(locale, "/my-space/companies"));
      return;
    }

    router.refresh();
  }

  const roleOptions = COMPANY_ROLES.map((role) => ({ value: role, label: copy.roles[role] }));
  const inviteRoleOptions = COMPANY_INVITE_ROLES.map((role) => ({
    value: role,
    label: copy.roles[role],
  }));

  return (
    <section
      className="rounded-none app-card p-5 sm:rounded-hero sm:p-6"
      aria-labelledby="company-team-title"
    >
      <h2
        id="company-team-title"
        className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]"
      >
        {ui.title}
      </h2>
      <p className="mt-1 text-sm leading-6 app-muted">{ui.description}</p>

      <ul className="mt-5 divide-y divide-[color:var(--border)] border-y border-[color:var(--border)]">
        {members.map((member) => {
          const isSelf = member.userId === viewerUserId;
          const name = displayName(member);
          const busy = busyMemberId === member.memberId;
          const removable =
            !isSelf &&
            canRemoveCompanyMember({ actorRole: viewerRole, target: member, isSelf });
          const roleEditable = canChangeRoles && member.status === "accepted";

          return (
            <li
              key={member.memberId}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[color:var(--surface-muted)] text-sm font-semibold text-[color:var(--foreground)]">
                  {member.avatarUrl ? (
                    <OptimizedImage
                      src={member.avatarUrl}
                      alt=""
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  ) : (
                    <span aria-hidden="true">{name.replace("@", "").slice(0, 1).toUpperCase()}</span>
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">
                    {member.username ? (
                      <LocalizedLink
                        href={`/u/${member.username}`}
                        className="transition-colors hover:text-[color:var(--brand)]"
                      >
                        {name}
                      </LocalizedLink>
                    ) : (
                      name
                    )}
                    {isSelf ? <span className="font-normal app-soft"> · {ui.you}</span> : null}
                  </p>
                  <p className="truncate text-xs app-muted">
                    {member.status === "pending"
                      ? `${ui.pending} · ${copy.roles[member.role]}`
                      : member.headline || copy.roles[member.role]}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {roleEditable ? (
                  <div className="w-44" aria-label={ui.changeRole.replace("{name}", name)} role="group">
                    <FormSelect
                      options={roleOptions}
                      value={member.role}
                      disabled={busy}
                      onChange={(value) => void changeRole(member, value as CompanyRole)}
                    />
                  </div>
                ) : member.status === "accepted" ? (
                  <span className="rounded-full border app-border px-3 py-1 text-xs font-medium app-soft">
                    {copy.roles[member.role]}
                  </span>
                ) : null}

                {removable ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setConfirm({ kind: "remove", member })}
                  >
                    {member.status === "pending" ? ui.cancelInvite : ui.remove}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {canInvite ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-[color:var(--foreground)]">{ui.invite}</h3>
          <p className="mt-1 text-xs leading-5 app-soft">
            {ui.inviteHint.replace("{max}", String(COMPANY_LIMITS.membersMax))}
          </p>
          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_auto] lg:items-start">
            <CoAuthorPicker
              value={picked}
              onChange={setPicked}
              locale={locale}
              max={1}
              excludeUserIds={members.map((member) => member.userId)}
              showHint={false}
              inputLabel={ui.invite}
              labels={{
                searchPlaceholder: ui.searchPlaceholder,
                searching: ui.searching,
                limitReached: ui.pickAnother,
                remove: ui.removeSelected,
              }}
            />
            <div role="group" aria-label={ui.role}>
              <FormSelect
                options={inviteRoleOptions}
                value={inviteRole}
                onChange={(value) => setInviteRole(value as CompanyInviteRole)}
              />
            </div>
            <Button onClick={() => void invite()} disabled={picked.length === 0 || inviting}>
              {inviting ? ui.inviting : ui.inviteButton}
            </Button>
          </div>
          <p className="mt-2 text-xs leading-5 app-soft">{copy.roleHints[inviteRole]}</p>
        </div>
      ) : null}

      {canLeave && self ? (
        <div className="mt-6 border-t app-border pt-5">
          <Button
            variant="secondary"
            size="sm"
            disabled={busyMemberId === self.memberId}
            onClick={() => setConfirm({ kind: "leave", member: self })}
          >
            {ui.leave}
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={
          confirm?.kind === "leave"
            ? ui.leaveTitle.replace("{company}", companyName)
            : confirm
              ? confirm.member.status === "pending"
                ? `${ui.cancelInvite}?`
                : ui.removeTitle.replace("{name}", displayName(confirm.member))
              : ""
        }
        description={
          confirm?.kind === "leave"
            ? ui.leaveText
            : confirm?.member.status === "pending"
              ? undefined
              : ui.removeText
        }
        confirmLabel={
          confirm?.kind === "leave"
            ? ui.leave
            : confirm?.member.status === "pending"
              ? ui.cancelInvite
              : ui.remove
        }
        cancelLabel={ui.confirmCancel}
        pending={Boolean(confirm && busyMemberId === confirm.member.memberId)}
        onConfirm={() => void runConfirmed()}
        onCancel={() => setConfirm(null)}
      />
    </section>
  );
}
