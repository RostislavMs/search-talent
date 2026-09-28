import { describe, expect, it } from "vitest";
import {
  getEditableProfileCompleteness,
  getProfileCompletenessBreakdown,
  getProfileCompletenessItemLabel,
  type EditableProfileCompletenessSource,
  type ProfileCompletenessItemKey,
} from "@/lib/profile-completeness";

type ProfileCompletenessInput = Parameters<
  typeof getProfileCompletenessBreakdown
>[0];

function makeEmptyInput(): ProfileCompletenessInput {
  return {
    username: null,
    name: null,
    avatarUrl: null,
    headline: null,
    bio: null,
    countryId: null,
    city: null,
    website: null,
    github: null,
    twitter: null,
    linkedin: null,
    behance: null,
    dribbble: null,
    artstation: null,
    vimeo: null,
    youtube: null,
    instagram: null,
    hasPrivateContact: false,
    telegramUsername: null,
    preferredContactMethod: null,
    experienceLevel: null,
    experienceYears: null,
    openToCount: 0,
    additionalInfo: null,
    skillsCount: 0,
    languagesCount: 0,
    educationCount: 0,
    certificateCount: 0,
    qaCount: 0,
    workExperienceCount: 0,
  };
}

function makeFullInput(): ProfileCompletenessInput {
  return {
    username: "johndoe",
    name: "John Doe",
    avatarUrl: "https://example.com/avatar.png",
    headline: "Senior Developer",
    bio: "Passionate about code",
    countryId: 1,
    city: "Kyiv",
    website: "https://example.com",
    github: "johndoe",
    twitter: "johndoe",
    linkedin: "johndoe",
    behance: "johndoe",
    dribbble: null,
    artstation: null,
    vimeo: null,
    youtube: null,
    instagram: null,
    hasPrivateContact: true,
    telegramUsername: "johndoe",
    preferredContactMethod: "email",
    experienceLevel: "years_5",
    experienceYears: 5,
    openToCount: 2,
    additionalInfo: "Open to relocation",
    skillsCount: 10,
    languagesCount: 2,
    educationCount: 1,
    certificateCount: 1,
    qaCount: 3,
    workExperienceCount: 2,
  };
}

describe("getProfileCompletenessBreakdown", () => {
  it("returns 0% for a completely empty profile", () => {
    const result = getProfileCompletenessBreakdown(makeEmptyInput());

    expect(result.percent).toBe(0);
    expect(result.items.every((item) => !item.filled)).toBe(true);
  });

  it("returns 100% for a fully filled profile", () => {
    const result = getProfileCompletenessBreakdown(makeFullInput());

    expect(result.percent).toBe(100);
    expect(result.items.every((item) => item.filled)).toBe(true);
  });

  it("returns correct number of items (23)", () => {
    const result = getProfileCompletenessBreakdown(makeEmptyInput());

    expect(result.items).toHaveLength(23);
  });

  it("no longer asks for salary, employment types or work format", () => {
    const keys = getProfileCompletenessBreakdown(makeEmptyInput()).items.map((i) => i.key);

    expect(keys).not.toContain("salary");
    expect(keys).not.toContain("employmentTypes");
    expect(keys).not.toContain("workFormats");
  });

  it("reaches 100% without «Відкрито до…»: the item is optional", () => {
    const full = makeFullInput();
    full.openToCount = 0;

    const result = getProfileCompletenessBreakdown(full);
    const openTo = result.items.find((i) => i.key === "openTo");

    expect(openTo?.optional).toBe(true);
    expect(openTo?.filled).toBe(false);
    expect(result.percent).toBe(100);
  });

  it("marks «Відкрито до…» as filled once an option is chosen", () => {
    const input = makeEmptyInput();
    input.openToCount = 1;

    const result = getProfileCompletenessBreakdown(input);

    expect(result.items.find((i) => i.key === "openTo")?.filled).toBe(true);
    expect(result.percent).toBe(0);
  });

  it("marks portfolioLinks as filled when any portfolio link is present", () => {
    const input = makeEmptyInput();
    input.dribbble = "johndoe";

    const result = getProfileCompletenessBreakdown(input);
    const portfolioItem = result.items.find((i) => i.key === "portfolioLinks");

    expect(portfolioItem?.filled).toBe(true);
  });

  it("marks portfolioLinks as unfilled when no portfolio links are present", () => {
    const result = getProfileCompletenessBreakdown(makeEmptyInput());
    const portfolioItem = result.items.find((i) => i.key === "portfolioLinks");

    expect(portfolioItem?.filled).toBe(false);
  });

  it("marks contact as filled when any contact method is present", () => {
    const telegram = makeEmptyInput();
    telegram.telegramUsername = "johndoe";
    const privateContact = makeEmptyInput();
    privateContact.hasPrivateContact = true;

    for (const input of [telegram, privateContact]) {
      const contactItem = getProfileCompletenessBreakdown(input).items.find(
        (i) => i.key === "contact",
      );
      expect(contactItem?.filled).toBe(true);
    }
  });

  it("marks experience as filled when experienceYears is set (even if experienceLevel is null)", () => {
    const input = makeEmptyInput();
    input.experienceYears = 3;

    const result = getProfileCompletenessBreakdown(input);
    const expItem = result.items.find((i) => i.key === "experience");

    expect(expItem?.filled).toBe(true);
  });

  it("marks experience as filled when experienceLevel is set (even if experienceYears is null)", () => {
    const input = makeEmptyInput();
    input.experienceLevel = "years_3";

    const result = getProfileCompletenessBreakdown(input);
    const expItem = result.items.find((i) => i.key === "experience");

    expect(expItem?.filled).toBe(true);
  });

  it("computes partial percent correctly", () => {
    const input = makeEmptyInput();
    input.username = "alice";
    input.name = "Alice";

    const result = getProfileCompletenessBreakdown(input);

    expect(result.percent).toBeGreaterThan(0);
    expect(result.percent).toBeLessThan(100);
  });

  it("marks count-based fields as filled when count > 0", () => {
    const input = makeEmptyInput();
    input.skillsCount = 5;
    input.languagesCount = 2;

    const result = getProfileCompletenessBreakdown(input);

    expect(result.items.find((i) => i.key === "skills")?.filled).toBe(true);
    expect(result.items.find((i) => i.key === "languages")?.filled).toBe(true);
    expect(result.items.find((i) => i.key === "education")?.filled).toBe(false);
  });
});

describe("getProfileCompletenessItemLabel", () => {
  it("returns English labels for 'en' locale", () => {
    expect(getProfileCompletenessItemLabel("username", "en")).toBe("Username");
    expect(getProfileCompletenessItemLabel("bio", "en")).toBe("Bio");
    expect(getProfileCompletenessItemLabel("skills", "en")).toBe("Skills");
  });

  it("returns Ukrainian labels for 'uk' locale", () => {
    expect(getProfileCompletenessItemLabel("name", "uk")).toBe("Імʼя");
    expect(getProfileCompletenessItemLabel("bio", "uk")).toBe("Біо");
    expect(getProfileCompletenessItemLabel("skills", "uk")).toBe("Навички");
  });

  it("falls back to English labels for unknown locale", () => {
    expect(getProfileCompletenessItemLabel("username", "fr")).toBe("Username");
  });

  it("returns a label for every defined key", () => {
    const keys: ProfileCompletenessItemKey[] = [
      "username", "name", "avatar", "headline", "bio", "country", "city",
      "website", "github", "twitter", "linkedin", "portfolioLinks", "contact",
      "preferredContact", "experience", "openTo", "additionalInfo", "skills",
      "languages", "education", "certificates", "qa", "workExperience",
    ];

    for (const key of keys) {
      expect(getProfileCompletenessItemLabel(key, "en")).toBeTruthy();
      expect(getProfileCompletenessItemLabel(key, "uk")).toBeTruthy();
    }
  });
});

describe("getEditableProfileCompleteness", () => {
  const owner: EditableProfileCompletenessSource = {
    username: "olena",
    name: null,
    avatar_url: null,
    headline: null,
    bio: null,
    country_id: null,
    city: null,
    website: null,
    github: null,
    twitter: null,
    linkedin: null,
    behance: null,
    dribbble: null,
    artstation: null,
    vimeo: null,
    youtube: null,
    instagram: null,
    contact_email: null,
    telegram_username: null,
    phone: null,
    preferred_contact_method: null,
    experience_level: null,
    experience_years: null,
    open_to: [],
    additional_info: null,
    skill_ids: [],
    languages: [],
    education: [],
    certificates: [],
    qas: [],
    work_experience: [],
  };

  it("counts the owner's private email or phone as a contact", () => {
    const contactFilled = (patch: Partial<EditableProfileCompletenessSource>) =>
      getEditableProfileCompleteness({ ...owner, ...patch }).items.find(
        (i) => i.key === "contact",
      )?.filled;

    expect(contactFilled({})).toBe(false);
    expect(contactFilled({ contact_email: "olena@example.com" })).toBe(true);
    expect(contactFilled({ phone: "+380501112233" })).toBe(true);
  });

  it("marks «Відкрито до…» from the owner's status", () => {
    const result = getEditableProfileCompleteness({ ...owner, open_to: ["freelance"] });
    expect(result.items.find((i) => i.key === "openTo")?.filled).toBe(true);
  });
});
