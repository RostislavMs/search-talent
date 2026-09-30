import { describe, expect, it } from "vitest";
import {
  buildCompanyLogoKey,
  buildCompanyPath,
  canChangeCompanyRoles,
  canDeleteCompany,
  canEditCompany,
  canInviteToCompany,
  canRemoveCompanyMember,
  checkCompanyEmailDomain,
  compareCompanyRoles,
  COMPANY_LIMITS,
  COMPANY_MEMBER_ERRORS,
  COMPANY_VERIFICATION,
  companyMemberErrorStatus,
  emailDomainCoversHost,
  isCompanyVerificationCode,
  formatCompanyLocation,
  formatCompanyWebsiteLabel,
  getCompanyWebsiteHost,
  getEmailDomain,
  isCompanyIndexable,
  isCompanyMemberError,
  isPublicEmailDomain,
  isValidCompanySlug,
  normalizeCompanyRole,
  normalizeCompanySize,
  normalizeCompanyType,
  normalizeCompanyWebsite,
  suggestCompanySlug,
  type CompanyRole,
} from "@/lib/companies";

describe("company slugs", () => {
  it.each([
    ["acme", true],
    ["acme-studio", true],
    ["a1", true],
    ["a", false],
    ["Acme", false],
    ["acme studio", false],
    ["acme--studio", false],
    ["-acme", false],
    ["acme-", false],
    ["new", false],
    ["edit", false],
    ["x".repeat(61), false],
    ["x".repeat(60), true],
  ])("isValidCompanySlug(%s) is %s", (slug, valid) => {
    expect(isValidCompanySlug(slug)).toBe(valid);
  });

  it("suggests a Latin address from a Ukrainian name", () => {
    expect(suggestCompanySlug("Студія Ромашка")).toBe("studiya-romashka");
  });

  it("pads addresses that are too short or reserved", () => {
    expect(suggestCompanySlug("A")).toBe("a-co");
    expect(suggestCompanySlug("New")).toBe("new-co");
  });

  it("falls back to a generic address when nothing usable is left", () => {
    expect(suggestCompanySlug("🚀✨")).toBe("company");
  });

  it("keeps long names within the limit and valid", () => {
    const slug = suggestCompanySlug("Very long company name ".repeat(6));
    expect(slug.length).toBeLessThanOrEqual(COMPANY_LIMITS.slugMax);
    expect(isValidCompanySlug(slug)).toBe(true);
  });

  it("builds the page path and the logo key", () => {
    expect(buildCompanyPath("acme")).toBe("/companies/acme");
    expect(buildCompanyLogoKey("c-1")).toBe("companies/c-1/logo");
  });
});

describe("company websites", () => {
  it.each([
    ["acme.com", "https://acme.com"],
    ["  https://www.acme.com/  ", "https://www.acme.com"],
    ["http://acme.com/jobs#team", "http://acme.com/jobs"],
    ["https://acme.com/?ref=st", "https://acme.com/?ref=st"],
    ["https://jobs.acme.com/open", "https://jobs.acme.com/open"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeCompanyWebsite(input)).toBe(expected);
  });

  it.each([
    "",
    "   ",
    "javascript:alert(1)",
    "ftp://acme.com",
    "https://acme.com@evil.example",
    "https://user:pass@acme.com",
    "localhost",
    "https://.acme.com",
    `https://acme.com/${"x".repeat(COMPANY_LIMITS.websiteMax)}`,
  ])("rejects %s", (input) => {
    expect(normalizeCompanyWebsite(input)).toBeNull();
  });

  it("reads the host the same way the database does", () => {
    expect(getCompanyWebsiteHost("https://www.Acme.com/jobs")).toBe("acme.com");
    expect(getCompanyWebsiteHost("acme.com")).toBe("acme.com");
    expect(getCompanyWebsiteHost(null)).toBeNull();
  });

  it("formats a short link label", () => {
    expect(formatCompanyWebsiteLabel("https://www.acme.com/")).toBe("acme.com");
    expect(formatCompanyWebsiteLabel("https://acme.com/jobs/")).toBe("acme.com/jobs");
    expect(formatCompanyWebsiteLabel("not a site")).toBeNull();
  });
});

describe("email domains", () => {
  it("takes the part after the last @", () => {
    expect(getEmailDomain("Jane@Acme.com")).toBe("acme.com");
    expect(getEmailDomain("a@b@acme.com")).toBe("acme.com");
    expect(getEmailDomain("jane")).toBeNull();
    expect(getEmailDomain("jane@localhost")).toBeNull();
    expect(getEmailDomain(null)).toBeNull();
  });

  it("knows public mail services and relay subdomains", () => {
    expect(isPublicEmailDomain("gmail.com")).toBe(true);
    expect(isPublicEmailDomain("ukr.net")).toBe(true);
    expect(isPublicEmailDomain("users.noreply.github.com")).toBe(true);
    expect(isPublicEmailDomain("eu.users.noreply.github.com")).toBe(true);
    expect(isPublicEmailDomain("acme.com")).toBe(false);
    expect(isPublicEmailDomain("notgmail.com")).toBe(false);
  });
});

describe("checkCompanyEmailDomain", () => {
  const base = {
    type: "company" as const,
    website: "https://acme.com",
    email: "jane@acme.com",
    emailConfirmed: true,
  };

  it("accepts an address on the website's domain", () => {
    expect(checkCompanyEmailDomain(base)).toEqual({ ok: true, domain: "acme.com" });
  });

  it("accepts a website on a subdomain of the email domain", () => {
    expect(
      checkCompanyEmailDomain({ ...base, website: "https://jobs.acme.com" }),
    ).toEqual({ ok: true, domain: "acme.com" });
  });

  it("does not accept an email subdomain for the parent website", () => {
    expect(checkCompanyEmailDomain({ ...base, email: "jane@mail.acme.com" })).toEqual({
      ok: false,
      reason: "mismatch",
    });
  });

  it.each([
    [{ type: "school" as const }, "school"],
    [{ website: null }, "no_website"],
    [{ website: "not a site" }, "no_website"],
    [{ email: null }, "no_email"],
    [{ emailConfirmed: false }, "email_unconfirmed"],
    [{ email: "jane@gmail.com", website: "https://gmail.com" }, "public_email"],
    [{ email: "jane@acme.io" }, "mismatch"],
    [{ email: "jane@notacme.com" }, "mismatch"],
  ])("refuses %o with %s", (patch, reason) => {
    expect(checkCompanyEmailDomain({ ...base, ...patch })).toEqual({ ok: false, reason });
  });
});

describe("work email codes", () => {
  it("covers the site's own domain and its subdomains only", () => {
    expect(emailDomainCoversHost("acme.com", "acme.com")).toBe(true);
    expect(emailDomainCoversHost("acme.com", "jobs.acme.com")).toBe(true);
    expect(emailDomainCoversHost("acme.com", "notacme.com")).toBe(false);
    expect(emailDomainCoversHost("mail.acme.com", "acme.com")).toBe(false);
    expect(emailDomainCoversHost("acme.com", null)).toBe(false);
  });

  it("accepts six digits and nothing else", () => {
    expect(isCompanyVerificationCode("012345")).toBe(true);
    expect(isCompanyVerificationCode("12345")).toBe(false);
    expect(isCompanyVerificationCode("12345a")).toBe(false);
    expect(isCompanyVerificationCode(123456)).toBe(false);
    expect(COMPANY_VERIFICATION).toEqual({ codeLength: 6, ttlMinutes: 15, maxAttempts: 5 });
  });
});

describe("company permissions", () => {
  const roles: Array<CompanyRole | null> = ["owner", "admin", "recruiter", null];

  it("lets owners and admins edit and invite", () => {
    expect(roles.map(canEditCompany)).toEqual([true, true, false, false]);
    expect(roles.map(canInviteToCompany)).toEqual([true, true, false, false]);
  });

  it("lets only owners change roles and delete the page", () => {
    expect(roles.map(canChangeCompanyRoles)).toEqual([true, false, false, false]);
    expect(roles.map(canDeleteCompany)).toEqual([true, false, false, false]);
  });

  it("mirrors remove_company_member()", () => {
    const accepted = (role: CompanyRole) => ({ role, status: "accepted" as const });
    const pending = (role: CompanyRole) => ({ role, status: "pending" as const });

    expect(canRemoveCompanyMember({ actorRole: "recruiter", target: accepted("owner"), isSelf: true })).toBe(true);
    expect(canRemoveCompanyMember({ actorRole: "owner", target: accepted("owner"), isSelf: false })).toBe(true);
    expect(canRemoveCompanyMember({ actorRole: "admin", target: accepted("recruiter"), isSelf: false })).toBe(true);
    expect(canRemoveCompanyMember({ actorRole: "admin", target: pending("admin"), isSelf: false })).toBe(true);
    expect(canRemoveCompanyMember({ actorRole: "admin", target: accepted("admin"), isSelf: false })).toBe(false);
    expect(canRemoveCompanyMember({ actorRole: "admin", target: accepted("owner"), isSelf: false })).toBe(false);
    expect(canRemoveCompanyMember({ actorRole: "recruiter", target: pending("recruiter"), isSelf: false })).toBe(false);
    expect(canRemoveCompanyMember({ actorRole: null, target: accepted("recruiter"), isSelf: false })).toBe(false);
  });
});

describe("team function refusals", () => {
  it("recognizes every refusal and nothing else", () => {
    for (const error of COMPANY_MEMBER_ERRORS) {
      expect(isCompanyMemberError(error)).toBe(true);
    }
    expect(isCompanyMemberError("ok")).toBe(false);
    expect(isCompanyMemberError(undefined)).toBe(false);
  });

  it("maps refusals to HTTP statuses", () => {
    expect(companyMemberErrorStatus("unauthorized")).toBe(401);
    expect(companyMemberErrorStatus("forbidden")).toBe(403);
    expect(companyMemberErrorStatus("not_found")).toBe(404);
    expect(companyMemberErrorStatus("user_not_found")).toBe(404);
    expect(companyMemberErrorStatus("invalid_role")).toBe(400);
    expect(companyMemberErrorStatus("already_invited")).toBe(409);
    expect(companyMemberErrorStatus("last_owner")).toBe(409);
    expect(companyMemberErrorStatus("member_limit")).toBe(409);
    expect(companyMemberErrorStatus("invitee_limit")).toBe(409);
    expect(companyMemberErrorStatus("membership_limit")).toBe(409);
  });

  it("keeps the limits the database enforces", () => {
    expect(COMPANY_LIMITS).toMatchObject({
      membersMax: 25,
      companiesPerCreator: 5,
      membershipsPerUser: 3,
      companiesPerProject: 3,
    });
  });
});

describe("small helpers", () => {
  it("normalizes stored values", () => {
    expect(normalizeCompanyType("school")).toBe("school");
    expect(normalizeCompanyType("agency")).toBe("company");
    expect(normalizeCompanySize("11-50")).toBe("11-50");
    expect(normalizeCompanySize("5")).toBeNull();
    expect(normalizeCompanyRole("owner")).toBe("owner");
    expect(normalizeCompanyRole("boss")).toBe("recruiter");
  });

  it("orders roles owner → admin → recruiter", () => {
    const roles: CompanyRole[] = ["recruiter", "owner", "admin"];
    expect([...roles].sort(compareCompanyRoles)).toEqual(["owner", "admin", "recruiter"]);
  });

  it("formats the location from whatever exists", () => {
    expect(formatCompanyLocation("Київ", "Україна")).toBe("Київ, Україна");
    expect(formatCompanyLocation(" ", "Ukraine")).toBe("Ukraine");
    expect(formatCompanyLocation(null, null)).toBeNull();
  });

  it("indexes only verified, approved pages", () => {
    expect(isCompanyIndexable({ moderationStatus: "approved", verified: true })).toBe(true);
    expect(isCompanyIndexable({ moderationStatus: "approved", verified: false })).toBe(false);
    expect(isCompanyIndexable({ moderationStatus: "under_review", verified: true })).toBe(false);
  });
});
