import "server-only";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildCompanyLogoKey,
  compareCompanyRoles,
  normalizeCompanyRole,
  normalizeCompanySize,
  normalizeCompanyType,
  type CompanyDetails,
  type CompanyInvitation,
  type CompanyMember,
  type CompanyMemberStatus,
  type CompanyPerson,
  type CompanyRole,
  type MyCompany,
} from "@/lib/companies";
import type { NotificationMetadata } from "@/lib/constants/notifications";
import { getProjectRatings } from "@/lib/db/leaderboards";
import { createNotifications } from "@/lib/db/notifications";
import { deleteFromR2, getR2PublicUrl, isR2Configured } from "@/lib/storage/r2";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CompanyPayload } from "@/lib/validation/companies";

export const COMPANY_COLUMNS =
  "id, slug, name, type, description, website, logo_url, size, country_id, city, verified_at, verification_method, moderation_status, created_at, updated_at";

export type CompanyRow = {
  id: string;
  slug: string;
  name: string;
  type: string;
  description: string | null;
  website: string | null;
  logo_url: string | null;
  size: string | null;
  country_id: number | null;
  city: string | null;
  verified_at: string | null;
  verification_method: string | null;
  moderation_status: string;
  created_at: string;
  updated_at: string;
};

type MemberRow = {
  id: string;
  company_id: string;
  user_id: string;
  role: string;
  status: string;
  invited_by: string | null;
  invited_at: string;
};

type ProfileLite = {
  user_id: string;
  username: string | null;
  name: string | null;
  avatar_url: string | null;
  headline: string | null;
};

export function mapCompanyRow(row: CompanyRow, countryName: string | null = null): CompanyDetails {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: normalizeCompanyType(row.type),
    logoUrl: row.logo_url,
    verified: Boolean(row.verified_at),
    moderationStatus: row.moderation_status,
    description: row.description,
    website: row.website,
    size: normalizeCompanySize(row.size),
    countryId: row.country_id,
    countryName,
    city: row.city,
    verifiedAt: row.verified_at,
    verificationMethod:
      row.verification_method === "email_domain" || row.verification_method === "admin"
        ? row.verification_method
        : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * The only logo a page may carry is its own upload (see buildCompanyLogoKey),
 * optionally with the `?v=` cache buster the uploader appends.
 */
export function isCompanyLogoUrl(url: string, companyId: string): boolean {
  const expected = getR2PublicUrl(buildCompanyLogoKey(companyId));

  if (!expected) {
    return false;
  }

  if (url === expected) {
    return true;
  }

  return url.startsWith(`${expected}?`) && /^v=\d{1,16}$/.test(url.slice(expected.length + 1));
}

// --- Verification ------------------------------------------------------------------

export function generateCompanyVerificationCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Codes are stored as an HMAC bound to the company and the person, keyed with
 * the service key (the only context that can read the table anyway), so a
 * leaked row is useless on its own and cannot be replayed for another page.
 */
export function hashCompanyVerificationCode(
  code: string,
  companyId: string,
  userId: string,
): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "company-verification";
  return createHmac("sha256", secret).update(`${companyId}:${userId}:${code}`).digest("hex");
}

export function companyVerificationCodeMatches(
  code: string,
  companyId: string,
  userId: string,
  storedHash: string,
): boolean {
  const expected = Buffer.from(hashCompanyVerificationCode(code, companyId, userId), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return expected.length === stored.length && timingSafeEqual(expected, stored);
}

/**
 * Writes the mark for an email check. Matches on the website that was checked:
 * if someone changed it in the meantime, nothing is written.
 */
export async function markCompanyVerifiedByEmail(
  admin: SupabaseClient,
  { companyId, website, userId }: { companyId: string; website: string; userId: string },
): Promise<boolean> {
  const { data, error } = await admin
    .from("companies")
    .update({
      verified_at: new Date().toISOString(),
      verification_method: "email_domain",
      verified_by: userId,
    })
    .eq("id", companyId)
    .eq("website", website)
    .is("verified_at", null)
    .select("id");

  if (error) {
    console.error("[companies] verify failed", { companyId, error: error.message });
    return false;
  }

  return Boolean(data && data.length > 0);
}

/** Best effort: a leftover file costs storage, not correctness. */
export async function deleteCompanyLogo(companyId: string): Promise<void> {
  if (!isR2Configured()) {
    return;
  }

  try {
    await deleteFromR2(buildCompanyLogoKey(companyId));
  } catch (error) {
    console.error("[companies] logo delete failed", { companyId, error });
  }
}

/**
 * The columns the create/edit form writes. The logo has its own route, and the
 * check mark and moderation belong to the server.
 */
export function companyPayloadToRow(payload: CompanyPayload) {
  return {
    name: payload.name,
    slug: payload.slug,
    type: payload.type,
    description: payload.description,
    website: payload.website,
    size: payload.size,
    country_id: payload.country_id,
    city: payload.city,
  };
}

export type CompanyWriteErrorCode =
  | "slug_taken"
  | "limit"
  | "membership_limit"
  | "email_unconfirmed"
  | "invalid";

/** Turns a failed insert/update into the reason the form shows. */
export function companyWriteErrorCode(
  error: { code?: string | null; message?: string | null } | null,
): CompanyWriteErrorCode | null {
  if (!error) {
    return null;
  }

  if (error.code === "23505") {
    return "slug_taken";
  }

  if (error.message?.includes("company_limit_reached")) {
    return "limit";
  }

  if (error.message?.includes("membership_limit_reached")) {
    return "membership_limit";
  }

  // The insert policy asks for a confirmed email.
  if (error.code === "42501") {
    return "email_unconfirmed";
  }

  return "invalid";
}

async function loadCountryName(
  supabase: SupabaseClient,
  countryId: number | null,
): Promise<string | null> {
  if (!countryId) {
    return null;
  }

  const { data } = await supabase
    .from("countries")
    .select("name")
    .eq("id", countryId)
    .maybeSingle();

  return (data as { name?: string } | null)?.name ?? null;
}

/**
 * A company page as the caller may see it (RLS: approved pages for everyone,
 * any page for its members and admins). Null when there is none to show.
 */
export async function getCompanyBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<CompanyDetails | null> {
  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as CompanyRow;
  return mapCompanyRow(row, await loadCountryName(supabase, row.country_id));
}

export async function getCompanyById(
  supabase: SupabaseClient,
  id: string,
): Promise<CompanyDetails | null> {
  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as CompanyRow;
  return mapCompanyRow(row, await loadCountryName(supabase, row.country_id));
}

/** The caller's role in the company, or null when they are not in its team. */
export async function getCompanyRole(
  supabase: SupabaseClient,
  companyId: string,
  userId: string | null | undefined,
): Promise<CompanyRole | null> {
  if (!userId) {
    return null;
  }

  const { data } = await supabase
    .from("company_members")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .eq("status", "accepted")
    .maybeSingle();

  const role = (data as { role?: string } | null)?.role;
  return role ? normalizeCompanyRole(role) : null;
}

async function hydrateProfiles(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, ProfileLite>> {
  const map = new Map<string, ProfileLite>();
  const unique = Array.from(new Set(userIds.filter(Boolean)));

  if (unique.length === 0) {
    return map;
  }

  const { data } = await supabase
    .from("profiles")
    .select("user_id, username, name, avatar_url, headline")
    .in("user_id", unique);

  for (const row of (data ?? []) as ProfileLite[]) {
    if (row.user_id) {
      map.set(row.user_id, row);
    }
  }

  return map;
}

function toPerson(userId: string, profile: ProfileLite | undefined): CompanyPerson {
  return {
    userId,
    username: profile?.username ?? null,
    name: profile?.name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    headline: profile?.headline ?? null,
  };
}

/**
 * The team, owners first. Visitors get accepted members only (RLS); members of
 * the company also get pending invitations when `includePending` is set.
 * Declined invitations are never listed. People whose profile is hidden drop
 * out, since there is nothing to link to.
 */
export async function listCompanyTeam(
  supabase: SupabaseClient,
  companyId: string,
  options: { includePending?: boolean } = {},
): Promise<CompanyMember[]> {
  const statuses: CompanyMemberStatus[] = options.includePending
    ? ["accepted", "pending"]
    : ["accepted"];

  const { data, error } = await supabase
    .from("company_members")
    .select("id, company_id, user_id, role, status, invited_by, invited_at")
    .eq("company_id", companyId)
    .in("status", statuses)
    .order("invited_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  const rows = data as MemberRow[];
  const profiles = await hydrateProfiles(
    supabase,
    rows.map((row) => row.user_id),
  );

  return rows
    .filter((row) => profiles.has(row.user_id))
    .map((row) => ({
      ...toPerson(row.user_id, profiles.get(row.user_id)),
      memberId: row.id,
      role: normalizeCompanyRole(row.role),
      status: row.status === "pending" ? ("pending" as const) : ("accepted" as const),
      invitedAt: row.invited_at,
    }))
    .sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "accepted" ? -1 : 1;
      }
      return compareCompanyRoles(a.role, b.role);
    });
}

export type CompanyProject = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  score: number | null;
  cover_url: string | null;
  kind: string | null;
  ownerId: string;
  ownerName: string | null;
  ownerUsername: string | null;
  /** pending is an outside author’s request, seen only by the team. */
  status: "approved" | "pending";
  /** The company vouched for it. */
  confirmed: boolean;
};

type CompanyProjectRow = {
  project_id: string;
  status: string;
  confirmed_at: string | null;
  project:
    | ProjectJoinRow
    | ProjectJoinRow[]
    | null;
};

type ProjectJoinRow = {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  score: number | null;
  cover_url: string | null;
  kind: string | null;
  owner_id: string;
  status: string;
  moderation_status: string;
};

/**
 * Projects the authors attached to the company, newest first. Only published,
 * approved ones: the projects policy already hides moderated work from
 * visitors, and a draft is nobody else’s business.
 */
export async function listCompanyProjects(
  supabase: SupabaseClient,
  companyId: string,
  limit = 60,
): Promise<CompanyProject[]> {
  const { data, error } = await supabase
    .from("company_projects")
    .select(
      "project_id, status, confirmed_at, project:project_id ( id, title, slug, description, score, cover_url, kind, owner_id, status, moderation_status )",
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  const rows = (data as unknown as CompanyProjectRow[])
    .map((row) => ({ link: row, project: firstJoined(row.project) }))
    .filter(
      (row): row is { link: CompanyProjectRow; project: ProjectJoinRow } =>
        Boolean(row.project) &&
        row.project!.status === "published" &&
        row.project!.moderation_status === "approved",
    );
  const projects = rows.map((row) => row.project);

  if (projects.length === 0) {
    return [];
  }

  const [ratings, owners] = await Promise.all([
    getProjectRatings(),
    hydrateProfiles(
      supabase,
      projects.map((project) => project.owner_id),
    ),
  ]);

  return rows.map(({ link, project }) => {
    const owner = owners.get(project.owner_id);
    return {
      status: link.status === "pending" ? ("pending" as const) : ("approved" as const),
      confirmed: Boolean(link.confirmed_at),
      id: project.id,
      title: project.title,
      slug: project.slug ?? "",
      description: project.description,
      score: ratings[project.id] ?? project.score,
      cover_url: project.cover_url,
      kind: project.kind,
      ownerId: project.owner_id,
      ownerName: owner?.name ?? null,
      ownerUsername: owner?.username ?? null,
    };
  });
}

/**
 * The person’s own published projects they can still attach to the company.
 * Only one’s own: a project is attached by its author.
 */
export async function listAttachableProjects(
  supabase: SupabaseClient,
  userId: string,
  attachedIds: string[],
): Promise<Array<{ id: string; title: string }>> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, title")
    .eq("owner_id", userId)
    .eq("status", "published")
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !data) {
    return [];
  }

  const attached = new Set(attachedIds);
  return (data as Array<{ id: string; title: string }>).filter((project) => !attached.has(project.id));
}

type JoinedCompany = Pick<
  CompanyRow,
  "id" | "slug" | "name" | "type" | "logo_url" | "verified_at" | "moderation_status"
>;

type MembershipJoinRow = {
  role: string;
  company: JoinedCompany | JoinedCompany[] | null;
};

function firstJoined<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** The companies the person is in, with their role and the team size. */
export async function listMyCompanies(
  supabase: SupabaseClient,
  userId: string,
): Promise<MyCompany[]> {
  const { data, error } = await supabase
    .from("company_members")
    .select(
      "role, company:company_id ( id, slug, name, type, logo_url, verified_at, moderation_status )",
    )
    .eq("user_id", userId)
    .eq("status", "accepted")
    .order("invited_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  const memberships: Array<{ role: CompanyRole; company: JoinedCompany }> = [];
  for (const row of data as unknown as MembershipJoinRow[]) {
    const company = firstJoined(row.company);
    if (company) {
      memberships.push({ role: normalizeCompanyRole(row.role), company });
    }
  }

  const ids = memberships.map((row) => row.company.id);
  const counts = new Map<string, number>();

  if (ids.length > 0) {
    const { data: team } = await supabase
      .from("company_members")
      .select("company_id")
      .in("company_id", ids)
      .eq("status", "accepted");

    for (const row of (team ?? []) as Array<{ company_id: string }>) {
      counts.set(row.company_id, (counts.get(row.company_id) ?? 0) + 1);
    }
  }

  return memberships.map(({ role, company }) => ({
    id: company.id,
    slug: company.slug,
    name: company.name,
    type: normalizeCompanyType(company.type),
    logoUrl: company.logo_url,
    verified: Boolean(company.verified_at),
    moderationStatus: company.moderation_status,
    role,
    membersCount: counts.get(company.id) ?? 1,
  }));
}

/** Whether the person is in any company team; drives the profile menu link. */
export async function hasCompanyMembership(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { count, error } = await supabase
    .from("company_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "accepted");

  return !error && (count ?? 0) > 0;
}

type InvitationJoinRow = {
  id: string;
  role: string;
  invited_at: string;
  invited_by: string | null;
  company:
    | Pick<CompanyRow, "id" | "slug" | "name" | "logo_url" | "verified_at">
    | Array<Pick<CompanyRow, "id" | "slug" | "name" | "logo_url" | "verified_at">>
    | null;
};

/**
 * Invitations waiting for the person's answer, newest first. A company that is
 * hidden by moderation is left out: its page cannot be opened anyway.
 */
export async function listPendingCompanyInvitations(
  supabase: SupabaseClient,
  userId: string,
): Promise<CompanyInvitation[]> {
  const { data, error } = await supabase
    .from("company_members")
    .select(
      "id, role, invited_at, invited_by, company:company_id ( id, slug, name, logo_url, verified_at )",
    )
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("invited_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  const rows = (data as unknown as InvitationJoinRow[])
    .map((row) => ({ ...row, company: firstJoined(row.company) }))
    .filter((row) => Boolean(row.company));

  const inviters = await hydrateProfiles(
    supabase,
    rows.map((row) => row.invited_by ?? "").filter(Boolean),
  );

  return rows.map((row) => {
    const company = row.company!;
    const inviter = row.invited_by ? inviters.get(row.invited_by) : undefined;

    return {
      memberId: row.id,
      role: normalizeCompanyRole(row.role),
      invitedAt: row.invited_at,
      company: {
        id: company.id,
        slug: company.slug,
        name: company.name,
        logoUrl: company.logo_url,
        verified: Boolean(company.verified_at),
      },
      inviter:
        row.invited_by && inviter
          ? {
              userId: row.invited_by,
              username: inviter.username,
              name: inviter.name,
              avatarUrl: inviter.avatar_url,
            }
          : null,
    };
  });
}

// --- Notifications ----------------------------------------------------------------
// Written with the service key (a member writes to another person's feed), and
// never thrown: a lost notification must not undo the change that caused it.

async function loadCompanyForNotification(
  admin: SupabaseClient,
  companyId: string,
): Promise<{ slug: string; name: string } | null> {
  const { data } = await admin
    .from("companies")
    .select("slug, name")
    .eq("id", companyId)
    .maybeSingle();

  return (data as { slug: string; name: string } | null) ?? null;
}

function companyMetadata(
  companyId: string,
  company: { slug: string; name: string },
  extra: NotificationMetadata = {},
): NotificationMetadata {
  return {
    companyId,
    companySlug: company.slug,
    companyName: company.name,
    ...extra,
  };
}

async function loadCompanyManagers(admin: SupabaseClient, companyId: string): Promise<string[]> {
  const { data } = await admin
    .from("company_members")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("status", "accepted")
    .in("role", ["owner", "admin"]);

  return ((data ?? []) as Array<{ user_id: string }>).map((row) => row.user_id);
}

export async function notifyCompanyInvite({
  companyId,
  memberId,
  inviteeUserId,
  actorUserId,
  role,
}: {
  companyId: string;
  memberId: string;
  inviteeUserId: string;
  actorUserId: string;
  role: CompanyRole;
}): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  const company = await loadCompanyForNotification(admin, companyId);
  if (!company) return;

  await createNotifications(admin, {
    recipientUserId: inviteeUserId,
    actorUserId,
    type: "company_invite",
    targetType: "company",
    targetId: companyId,
    metadata: companyMetadata(companyId, company, {
      invitationId: memberId,
      companyRole: role,
    }),
  });
}

export async function notifyCompanyInviteResponse({
  companyId,
  inviterUserId,
  actorUserId,
  accepted,
}: {
  companyId: string;
  inviterUserId: string | null;
  actorUserId: string;
  accepted: boolean;
}): Promise<void> {
  if (!inviterUserId) return;

  const admin = createAdminClient();
  if (!admin) return;

  const company = await loadCompanyForNotification(admin, companyId);
  if (!company) return;

  await createNotifications(admin, {
    recipientUserId: inviterUserId,
    actorUserId,
    type: accepted ? "company_invite_accepted" : "company_invite_declined",
    targetType: "company",
    targetId: companyId,
    metadata: companyMetadata(companyId, company),
  });
}

/**
 * Tells the owners and admins that the page got its check mark. The page is
 * the subject of the message, so there is no actor; the person who just ran
 * the check themselves is left out.
 */
export async function notifyCompanyVerified({
  companyId,
  excludeUserId = null,
}: {
  companyId: string;
  excludeUserId?: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  const [company, managers] = await Promise.all([
    loadCompanyForNotification(admin, companyId),
    loadCompanyManagers(admin, companyId),
  ]);
  const recipients = managers.filter((userId) => userId !== excludeUserId);
  if (!company || recipients.length === 0) return;

  await createNotifications(
    admin,
    recipients.map((recipientUserId) => ({
      recipientUserId,
      actorUserId: null,
      type: "company_verified" as const,
      targetType: "company" as const,
      targetId: companyId,
      metadata: companyMetadata(companyId, company),
    })),
  );
}

/** Someone left the team on their own: their former owners and admins hear of it. */
export async function notifyCompanyMemberLeft({
  companyId,
  userId,
}: {
  companyId: string;
  userId: string;
}): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  const [company, managers] = await Promise.all([
    loadCompanyForNotification(admin, companyId),
    loadCompanyManagers(admin, companyId),
  ]);
  if (!company || managers.length === 0) return;

  await createNotifications(
    admin,
    managers.map((recipientUserId) => ({
      recipientUserId,
      actorUserId: userId,
      type: "company_member_left" as const,
      targetType: "company" as const,
      targetId: companyId,
      metadata: companyMetadata(companyId, company),
    })),
  );
}

/** An owner or admin took someone off the team: that person hears of it. */
export async function notifyCompanyMemberRemoved({
  companyId,
  userId,
  actorUserId,
}: {
  companyId: string;
  userId: string;
  actorUserId: string;
}): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  const company = await loadCompanyForNotification(admin, companyId);
  if (!company) return;

  await createNotifications(admin, {
    recipientUserId: userId,
    actorUserId,
    type: "company_member_removed",
    targetType: "company",
    targetId: companyId,
    metadata: companyMetadata(companyId, company),
  });
}

async function loadProjectForNotification(
  admin: SupabaseClient,
  projectId: string,
): Promise<{ title: string; slug: string | null; owner_id: string } | null> {
  const { data } = await admin
    .from("projects")
    .select("title, slug, owner_id")
    .eq("id", projectId)
    .maybeSingle();

  return (data as { title: string; slug: string | null; owner_id: string } | null) ?? null;
}

/** An outside author asks to show their project: the owners and admins decide. */
export async function notifyCompanyProjectRequest({
  companyId,
  projectId,
  actorUserId,
}: {
  companyId: string;
  projectId: string;
  actorUserId: string;
}): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  const [company, managers, project] = await Promise.all([
    loadCompanyForNotification(admin, companyId),
    loadCompanyManagers(admin, companyId),
    loadProjectForNotification(admin, projectId),
  ]);
  if (!company || !project || managers.length === 0) return;

  await createNotifications(
    admin,
    managers.map((recipientUserId) => ({
      recipientUserId,
      actorUserId,
      type: "company_project_request" as const,
      targetType: "company" as const,
      targetId: companyId,
      metadata: companyMetadata(companyId, company, {
        projectId,
        projectTitle: project.title,
        projectSlug: project.slug ?? undefined,
      }),
    })),
  );
}

/** The company confirmed, or turned down, a project: its author hears of it. */
export async function notifyCompanyProjectDecision({
  companyId,
  projectId,
  actorUserId,
  confirmed,
}: {
  companyId: string;
  projectId: string;
  actorUserId: string;
  confirmed: boolean;
}): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  const [company, project] = await Promise.all([
    loadCompanyForNotification(admin, companyId),
    loadProjectForNotification(admin, projectId),
  ]);
  if (!company || !project) return;

  await createNotifications(admin, {
    recipientUserId: project.owner_id,
    actorUserId,
    type: confirmed ? "company_project_confirmed" : "company_project_declined",
    targetType: "project",
    targetId: projectId,
    metadata: companyMetadata(companyId, company, {
      projectId,
      projectTitle: project.title,
      projectSlug: project.slug ?? undefined,
    }),
  });
}

// --- Admin -------------------------------------------------------------------------

export type AdminCompanyItem = {
  id: string;
  slug: string;
  name: string;
  type: CompanyDetails["type"];
  website: string | null;
  verified: boolean;
  verificationMethod: CompanyDetails["verificationMethod"];
  moderationStatus: string;
  membersCount: number;
  createdAt: string;
  creator: Pick<CompanyPerson, "username" | "name"> | null;
};

export type AdminCompanyFilter = "all" | "unverified" | "verified" | "hidden";

/**
 * Every company for /admin/companies, newest first. Reads with the admin's own
 * session: RLS lets platform admins see hidden pages too.
 */
export async function listCompaniesForAdmin(
  supabase: SupabaseClient,
  filter: AdminCompanyFilter = "all",
  limit = 200,
): Promise<AdminCompanyItem[]> {
  let query = supabase
    .from("companies")
    .select("id, slug, name, type, website, verified_at, verification_method, moderation_status, created_by, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filter === "unverified") {
    query = query.is("verified_at", null).eq("moderation_status", "approved");
  } else if (filter === "verified") {
    query = query.not("verified_at", "is", null);
  } else if (filter === "hidden") {
    query = query.neq("moderation_status", "approved");
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  const rows = data as Array<
    Pick<
      CompanyRow,
      "id" | "slug" | "name" | "type" | "website" | "verified_at" | "verification_method" | "moderation_status" | "created_at"
    > & { created_by: string | null }
  >;

  const ids = rows.map((row) => row.id);
  const counts = new Map<string, number>();

  if (ids.length > 0) {
    const { data: team } = await supabase
      .from("company_members")
      .select("company_id")
      .in("company_id", ids)
      .eq("status", "accepted");

    for (const row of (team ?? []) as Array<{ company_id: string }>) {
      counts.set(row.company_id, (counts.get(row.company_id) ?? 0) + 1);
    }
  }

  const creators = await hydrateProfiles(
    supabase,
    rows.map((row) => row.created_by ?? "").filter(Boolean),
  );

  return rows.map((row) => {
    const creator = row.created_by ? creators.get(row.created_by) : undefined;
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      type: normalizeCompanyType(row.type),
      website: row.website,
      verified: Boolean(row.verified_at),
      verificationMethod:
        row.verification_method === "email_domain" || row.verification_method === "admin"
          ? row.verification_method
          : null,
      moderationStatus: row.moderation_status,
      membersCount: counts.get(row.id) ?? 0,
      createdAt: row.created_at,
      creator: creator ? { username: creator.username, name: creator.name } : null,
    };
  });
}
