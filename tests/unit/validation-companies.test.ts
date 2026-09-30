import { describe, expect, it } from "vitest";
import {
  adminCompanyUpdateSchema,
  companyLogoSchema,
  companyPayloadSchema,
  inviteCompanyMemberSchema,
  respondCompanyInvitationSchema,
  updateCompanyMemberSchema,
} from "@/lib/validation/companies";

const valid = {
  name: "  Acme Studio ",
  slug: "Acme-Studio",
  type: "company",
  description: "  We build things.  ",
  website: "acme.com",
  size: "11-50",
  country_id: 3,
  city: " Kyiv ",
};

describe("companyPayloadSchema", () => {
  it("trims, lowercases the address and normalizes the website", () => {
    const parsed = companyPayloadSchema.parse(valid);
    expect(parsed).toEqual({
      name: "Acme Studio",
      slug: "acme-studio",
      type: "company",
      description: "We build things.",
      website: "https://acme.com",
      size: "11-50",
      country_id: 3,
      city: "Kyiv",
    });
  });

  it("turns empty optional fields into null", () => {
    const parsed = companyPayloadSchema.parse({
      name: "Acme",
      slug: "acme",
      description: "",
      website: "   ",
      size: "",
      country_id: null,
      city: undefined,
    });
    expect(parsed).toMatchObject({
      type: "company",
      description: null,
      website: null,
      size: null,
      country_id: null,
      city: null,
    });
  });

  it("does not take a logo: it has its own route", () => {
    const parsed = companyPayloadSchema.parse({ ...valid, logo_url: "https://evil.example/x.png" });
    expect(parsed).not.toHaveProperty("logo_url");
  });

  it.each([
    [{ name: "A" }, "Name is too short"],
    [{ name: "x".repeat(81) }, "Name is too long"],
    [{ slug: "new" }, "Invalid page address"],
    [{ slug: "acme studio" }, "Invalid page address"],
    [{ website: "javascript:alert(1)" }, "Invalid website"],
    [{ description: "x".repeat(2001) }, "Description is too long"],
    [{ city: "x".repeat(81) }, "City is too long"],
  ])("rejects %o", (patch, message) => {
    const result = companyPayloadSchema.safeParse({ ...valid, ...patch });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });

  it("rejects an unknown type, size or country id", () => {
    expect(companyPayloadSchema.safeParse({ ...valid, type: "agency" }).success).toBe(false);
    expect(companyPayloadSchema.safeParse({ ...valid, size: "5" }).success).toBe(false);
    expect(companyPayloadSchema.safeParse({ ...valid, country_id: -1 }).success).toBe(false);
  });
});

describe("team schemas", () => {
  const userId = "11111111-1111-4111-8111-111111111111";

  it("invites as a recruiter by default and never as an owner", () => {
    expect(inviteCompanyMemberSchema.parse({ userId })).toEqual({ userId, role: "recruiter" });
    expect(inviteCompanyMemberSchema.safeParse({ userId, role: "owner" }).success).toBe(false);
    expect(inviteCompanyMemberSchema.safeParse({ userId: "nope" }).success).toBe(false);
  });

  it("accepts any role for a role change", () => {
    expect(updateCompanyMemberSchema.parse({ role: "owner" })).toEqual({ role: "owner" });
    expect(updateCompanyMemberSchema.safeParse({ role: "boss" }).success).toBe(false);
  });

  it("answers invitations with accept or decline only", () => {
    expect(respondCompanyInvitationSchema.safeParse({ action: "accept" }).success).toBe(true);
    expect(respondCompanyInvitationSchema.safeParse({ action: "maybe" }).success).toBe(false);
  });

  it("wants a URL for the logo", () => {
    expect(companyLogoSchema.safeParse({ logoUrl: "https://cdn.example/companies/x/logo" }).success).toBe(true);
    expect(companyLogoSchema.safeParse({ logoUrl: "not a url" }).success).toBe(false);
  });
});

describe("adminCompanyUpdateSchema", () => {
  it("needs something to change", () => {
    expect(adminCompanyUpdateSchema.safeParse({}).success).toBe(false);
    expect(adminCompanyUpdateSchema.safeParse({ moderation_note: "x" }).success).toBe(false);
  });

  it("accepts the mark and a moderation status", () => {
    expect(adminCompanyUpdateSchema.parse({ verified: true })).toEqual({
      verified: true,
      moderation_note: null,
    });
    expect(
      adminCompanyUpdateSchema.parse({ moderation_status: "removed", moderation_note: " fake " }),
    ).toEqual({ moderation_status: "removed", moderation_note: "fake" });
    expect(adminCompanyUpdateSchema.safeParse({ moderation_status: "gone" }).success).toBe(false);
  });
});
