// Company pages (hiring stage 8.1, docs/hiring.md). Pure helpers shared by the
// API, the pages and the tests; the rules they mirror live in
// database/2026-09-30-companies.sql, which stays the authority.

import { slugify } from "@/lib/slug";

export const COMPANY_TYPES = ["company", "school"] as const;
export type CompanyType = (typeof COMPANY_TYPES)[number];

export const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;
export type CompanySize = (typeof COMPANY_SIZES)[number];

export const COMPANY_ROLES = ["owner", "admin", "recruiter"] as const;
export type CompanyRole = (typeof COMPANY_ROLES)[number];

/** Ownership is handed over inside the team, never by invitation. */
export const COMPANY_INVITE_ROLES = ["admin", "recruiter"] as const;
export type CompanyInviteRole = (typeof COMPANY_INVITE_ROLES)[number];

export const COMPANY_MEMBER_STATUSES = ["pending", "accepted", "declined"] as const;
export type CompanyMemberStatus = (typeof COMPANY_MEMBER_STATUSES)[number];

export const COMPANY_LIMITS = {
  nameMin: 2,
  nameMax: 80,
  slugMin: 2,
  slugMax: 60,
  descriptionMax: 2000,
  cityMax: 80,
  websiteMax: 2048,
  /** Team size, pending invitations included (invite_company_member). */
  membersMax: 25,
  /** Pages one person may create (guard_company_columns). */
  companiesPerCreator: 5,
  /** Companies one person may be in at a time (accepted memberships). */
  membershipsPerUser: 3,
  /** Companies one project may be shown on (prepare_company_project). */
  companiesPerProject: 3,
} as const;

/** Routes that live under /companies/ and so cannot be a company's address. */
export const RESERVED_COMPANY_SLUGS = ["new", "edit"] as const;

const COMPANY_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Refusals the team functions answer with, besides 'ok'. */
export const COMPANY_MEMBER_ERRORS = [
  "unauthorized",
  "forbidden",
  "not_found",
  "invalid_role",
  "user_not_found",
  "already_member",
  "already_invited",
  "member_limit",
  "last_owner",
  /** The invited person is already in 3 companies. */
  "invitee_limit",
  /** The caller is already in 3 companies. */
  "membership_limit",
] as const;
export type CompanyMemberError = (typeof COMPANY_MEMBER_ERRORS)[number];

export function isCompanyMemberError(value: unknown): value is CompanyMemberError {
  return (
    typeof value === "string" &&
    (COMPANY_MEMBER_ERRORS as readonly string[]).includes(value)
  );
}

/** HTTP status the API answers a refusal with. */
export function companyMemberErrorStatus(error: CompanyMemberError): number {
  switch (error) {
    case "unauthorized":
      return 401;
    case "forbidden":
      return 403;
    case "not_found":
    case "user_not_found":
      return 404;
    case "invalid_role":
      return 400;
    default:
      return 409;
  }
}

export function isValidCompanySlug(value: string): boolean {
  return (
    value.length >= COMPANY_LIMITS.slugMin &&
    value.length <= COMPANY_LIMITS.slugMax &&
    COMPANY_SLUG_PATTERN.test(value) &&
    !(RESERVED_COMPANY_SLUGS as readonly string[]).includes(value)
  );
}

/**
 * A page address suggested from the name: "Студія Ромашка" → "studiya-romashka".
 * Always valid, so the form can offer it as is.
 */
export function suggestCompanySlug(name: string): string {
  let base = slugify(name, "company")
    .slice(0, COMPANY_LIMITS.slugMax)
    .replace(/-+$/g, "");

  if (
    base.length < COMPANY_LIMITS.slugMin ||
    (RESERVED_COMPANY_SLUGS as readonly string[]).includes(base)
  ) {
    base = `${base}-co`;
  }

  return isValidCompanySlug(base) ? base : "company";
}

export function buildCompanyPath(slug: string): string {
  return `/companies/${slug}`;
}

export const COMPANY_LOGO_MAX_BYTES = 5 * 1024 * 1024;
export const COMPANY_LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/**
 * One stable storage key per company, like the avatar's: a new upload replaces
 * the old file, so nothing is left behind, and no page can point at another
 * company's logo. The page appends `?v=` to refresh caches.
 */
export function buildCompanyLogoKey(companyId: string): string {
  return `companies/${companyId}/logo`;
}

/**
 * The website as it is stored: https unless http was typed, no credentials, no
 * fragment, and no trailing slash on the bare domain. Returns null for anything
 * that is not a public web address.
 */
export function normalizeCompanyWebsite(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed || trimmed.length > COMPANY_LIMITS.websiteMax) {
    return null;
  }

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return null;
  }

  // "https://acme.com@evil.example" reads as acme.com but opens evil.example.
  if (url.username || url.password) {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (!host.includes(".") || host.startsWith(".") || host.endsWith(".")) {
    return null;
  }

  url.hash = "";
  const normalized = url.toString();
  return url.pathname === "/" && !url.search ? normalized.replace(/\/$/, "") : normalized;
}

/** 'https://www.Acme.com/jobs' → 'acme.com'. Same rule as company_website_host(). */
export function getCompanyWebsiteHost(value: string | null | undefined): string | null {
  const normalized = normalizeCompanyWebsite(value);

  if (!normalized) {
    return null;
  }

  return new URL(normalized).hostname.toLowerCase().replace(/^www\./, "") || null;
}

/** The website without the scheme, for a link label: "acme.com/jobs". */
export function formatCompanyWebsiteLabel(value: string | null | undefined): string | null {
  const normalized = normalizeCompanyWebsite(value);

  if (!normalized) {
    return null;
  }

  const url = new URL(normalized);
  const host = url.hostname.replace(/^www\./, "");
  const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
  return `${host}${path}`;
}

/**
 * Mail services anyone can sign up to. An address there says nothing about the
 * company, so it cannot verify one. Also the relay addresses GitHub and Apple
 * hand out instead of a real one.
 */
export const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "ymail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "tutanota.com",
  "tuta.io",
  "fastmail.com",
  "hey.com",
  "duck.com",
  "zoho.com",
  "mail.com",
  "gmx.com",
  "gmx.net",
  "gmx.de",
  "web.de",
  "t-online.de",
  "yandex.ru",
  "yandex.ua",
  "yandex.com",
  "ya.ru",
  "mail.ru",
  "bk.ru",
  "inbox.ru",
  "list.ru",
  "rambler.ru",
  "ukr.net",
  "i.ua",
  "meta.ua",
  "bigmir.net",
  "email.ua",
  "online.ua",
  "qq.com",
  "163.com",
  "users.noreply.github.com",
  "noreply.github.com",
  "privaterelay.appleid.com",
]);

export function getEmailDomain(email: string | null | undefined): string | null {
  const value = email?.trim().toLowerCase();

  if (!value) {
    return null;
  }

  const at = value.lastIndexOf("@");
  const domain = at > 0 ? value.slice(at + 1) : "";
  return domain.includes(".") ? domain : null;
}

export function isPublicEmailDomain(domain: string): boolean {
  if (PUBLIC_EMAIL_DOMAINS.has(domain)) {
    return true;
  }

  // Relay subdomains ("123+me@users.noreply.github.com").
  for (const publicDomain of PUBLIC_EMAIL_DOMAINS) {
    if (domain.endsWith(`.${publicDomain}`)) {
      return true;
    }
  }

  return false;
}

export type CompanyDomainCheck =
  | { ok: true; domain: string }
  | {
      ok: false;
      reason:
        | "school"
        | "no_website"
        | "no_email"
        | "email_unconfirmed"
        | "public_email"
        | "mismatch";
    };

/**
 * Whether the signed-in person's own address vouches for the company's site:
 * jane@acme.com verifies acme.com and jobs.acme.com, but not acme.io, and a
 * gmail address verifies nothing. The other direction (jane@mail.acme.com for
 * acme.com) is not accepted: hosting providers hand out such subdomains.
 *
 * Schools are verified by an admin only: students have addresses on the
 * school's own domain too.
 */
export function checkCompanyEmailDomain({
  type,
  website,
  email,
  emailConfirmed,
}: {
  type: CompanyType;
  website: string | null | undefined;
  email: string | null | undefined;
  emailConfirmed: boolean;
}): CompanyDomainCheck {
  if (type === "school") {
    return { ok: false, reason: "school" };
  }

  const host = getCompanyWebsiteHost(website);
  if (!host) {
    return { ok: false, reason: "no_website" };
  }

  const domain = getEmailDomain(email);
  if (!domain) {
    return { ok: false, reason: "no_email" };
  }

  if (!emailConfirmed) {
    return { ok: false, reason: "email_unconfirmed" };
  }

  if (isPublicEmailDomain(domain)) {
    return { ok: false, reason: "public_email" };
  }

  if (emailDomainCoversHost(domain, host)) {
    return { ok: true, domain };
  }

  return { ok: false, reason: "mismatch" };
}

/** acme.com covers acme.com and jobs.acme.com, not notacme.com. */
export function emailDomainCoversHost(domain: string, host: string | null): boolean {
  return Boolean(host) && (host === domain || Boolean(host?.endsWith(`.${domain}`)));
}

/**
 * "Verify with a work email": a code goes to any address on the website's
 * domain, not only to the one the person signs in with — most people sign in
 * with a personal address.
 */
export const COMPANY_VERIFICATION = {
  codeLength: 6,
  ttlMinutes: 15,
  maxAttempts: 5,
} as const;

export function isCompanyVerificationCode(value: unknown): value is string {
  return typeof value === "string" && /^\d{6}$/.test(value);
}

// --- Who may do what. The SQL functions enforce it; the UI only hides buttons. ---

export function canEditCompany(role: CompanyRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export function canInviteToCompany(role: CompanyRole | null | undefined): boolean {
  return canEditCompany(role);
}

export function canChangeCompanyRoles(role: CompanyRole | null | undefined): boolean {
  return role === "owner";
}

export function canDeleteCompany(role: CompanyRole | null | undefined): boolean {
  return role === "owner";
}

export function canRemoveCompanyMember({
  actorRole,
  target,
  isSelf,
}: {
  actorRole: CompanyRole | null | undefined;
  target: { role: CompanyRole; status: CompanyMemberStatus };
  isSelf: boolean;
}): boolean {
  if (isSelf) {
    return true;
  }

  if (actorRole === "owner") {
    return true;
  }

  if (actorRole === "admin") {
    return target.status !== "accepted" || target.role === "recruiter";
  }

  return false;
}

// --- Shapes the pages work with ------------------------------------------------------

export type CompanySummary = {
  id: string;
  slug: string;
  name: string;
  type: CompanyType;
  logoUrl: string | null;
  verified: boolean;
  moderationStatus: string;
};

export type CompanyDetails = CompanySummary & {
  description: string | null;
  website: string | null;
  size: CompanySize | null;
  countryId: number | null;
  countryName: string | null;
  city: string | null;
  verifiedAt: string | null;
  verificationMethod: "email_domain" | "admin" | null;
  createdAt: string;
  updatedAt: string;
};

export type CompanyPerson = {
  userId: string;
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
  headline: string | null;
};

export type CompanyMember = CompanyPerson & {
  memberId: string;
  role: CompanyRole;
  status: CompanyMemberStatus;
  invitedAt: string;
};

export type CompanyInvitation = {
  memberId: string;
  role: CompanyRole;
  invitedAt: string;
  company: Pick<CompanySummary, "id" | "slug" | "name" | "logoUrl" | "verified">;
  inviter: Pick<CompanyPerson, "userId" | "username" | "name" | "avatarUrl"> | null;
};

export type MyCompany = CompanySummary & {
  role: CompanyRole;
  membersCount: number;
};

export function normalizeCompanyType(value: unknown): CompanyType {
  return value === "school" ? "school" : "company";
}

export function normalizeCompanySize(value: unknown): CompanySize | null {
  return typeof value === "string" && (COMPANY_SIZES as readonly string[]).includes(value)
    ? (value as CompanySize)
    : null;
}

export function normalizeCompanyRole(value: unknown): CompanyRole {
  return typeof value === "string" && (COMPANY_ROLES as readonly string[]).includes(value)
    ? (value as CompanyRole)
    : "recruiter";
}

/** Owners first, then admins, then recruiters; stable within a role. */
export function compareCompanyRoles(a: CompanyRole, b: CompanyRole): number {
  return COMPANY_ROLES.indexOf(a) - COMPANY_ROLES.indexOf(b);
}

/** "Київ, Україна" / "Kyiv, Ukraine" — whichever parts exist. */
export function formatCompanyLocation(
  city: string | null | undefined,
  countryName: string | null | undefined,
): string | null {
  const parts = [city?.trim(), countryName?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * A page is worth indexing only once it is verified: an unverified page is
 * anyone's claim about a company, and a search result is not the place for it.
 */
export function isCompanyIndexable(company: {
  moderationStatus: string;
  verified: boolean;
}): boolean {
  return company.moderationStatus === "approved" && company.verified;
}
