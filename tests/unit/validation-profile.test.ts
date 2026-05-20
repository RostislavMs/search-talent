import { describe, expect, it } from "vitest";
import { profilePayloadSchema } from "@/lib/validation/profile";

const minimal = {
  username: null,
  name: null,
  category_id: null,
  headline: null,
  bio: null,
  country_id: null,
  city: null,
  website: null,
  github: null,
  twitter: null,
  linkedin: null,
  contact_email: null,
  telegram_username: null,
  phone: null,
  preferred_contact_method: null,
  experience_years: null,
  experience_level: null,
  employment_types: [],
  work_formats: [],
  salary_expectations: null,
  salary_currency: null,
  additional_info: null,
  profile_visibility: {},
  skill_ids: [],
  languages: [],
  education: [],
  certificates: [],
  qas: [],
  work_experience: [],
};

describe("profilePayloadSchema - basic fields", () => {
  it("accepts an empty profile payload", () => {
    expect(profilePayloadSchema.safeParse(minimal).success).toBe(true);
  });

  it("normalizes username to lowercase", () => {
    const result = profilePayloadSchema.safeParse({
      ...minimal,
      username: "TestUser_42",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe("testuser_42");
    }
  });

  it("rejects too short or too long usernames", () => {
    expect(
      profilePayloadSchema.safeParse({ ...minimal, username: "ab" }).success,
    ).toBe(false);
    expect(
      profilePayloadSchema.safeParse({ ...minimal, username: "a".repeat(33) })
        .success,
    ).toBe(false);
  });

  it("rejects usernames with disallowed characters", () => {
    expect(
      profilePayloadSchema.safeParse({ ...minimal, username: "bad name" })
        .success,
    ).toBe(false);
    expect(
      profilePayloadSchema.safeParse({ ...minimal, username: "Привіт" })
        .success,
    ).toBe(false);
  });

  it("auto-prefixes URLs with https:// when missing", () => {
    const result = profilePayloadSchema.safeParse({
      ...minimal,
      website: "example.com",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.website).toBe("https://example.com");
    }
  });

  it("rejects an invalid contact_email", () => {
    expect(
      profilePayloadSchema.safeParse({
        ...minimal,
        contact_email: "not-an-email",
      }).success,
    ).toBe(false);
  });

  it("accepts a valid contact_email", () => {
    const result = profilePayloadSchema.safeParse({
      ...minimal,
      contact_email: "user@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid phone", () => {
    expect(
      profilePayloadSchema.safeParse({ ...minimal, phone: "ab" }).success,
    ).toBe(false);
  });

  it("accepts a valid phone with +/spaces/dashes", () => {
    expect(
      profilePayloadSchema.safeParse({
        ...minimal,
        phone: "+1 (555) 123-4567",
      }).success,
    ).toBe(true);
  });

  it("rejects too short telegram username", () => {
    expect(
      profilePayloadSchema.safeParse({ ...minimal, telegram_username: "@ab" })
        .success,
    ).toBe(false);
  });

  it("accepts telegram with or without @ prefix", () => {
    expect(
      profilePayloadSchema.safeParse({
        ...minimal,
        telegram_username: "@valid_user",
      }).success,
    ).toBe(true);
    expect(
      profilePayloadSchema.safeParse({
        ...minimal,
        telegram_username: "valid_user",
      }).success,
    ).toBe(true);
  });
});

describe("profilePayloadSchema - enum-like fields", () => {
  it("normalizes empty-string preferred_contact_method to null", () => {
    const result = profilePayloadSchema.safeParse({
      ...minimal,
      preferred_contact_method: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.preferred_contact_method).toBeNull();
    }
  });

  it("rejects unknown preferred_contact_method values outright", () => {
    const result = profilePayloadSchema.safeParse({
      ...minimal,
      preferred_contact_method: "carrier-pigeon" as unknown as string,
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown employment_types entries", () => {
    expect(
      profilePayloadSchema.safeParse({
        ...minimal,
        employment_types: ["full_time", "alien_contract"] as unknown as string[],
      }).success,
    ).toBe(false);
  });

  it("dedupes employment_types and work_formats", () => {
    const result = profilePayloadSchema.safeParse({
      ...minimal,
      employment_types: ["full_time", "full_time"],
      work_formats: ["remote", "remote"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.employment_types).toEqual(["full_time"]);
      expect(result.data.work_formats).toEqual(["remote"]);
    }
  });
});

describe("profilePayloadSchema - nested entries", () => {
  it("rejects work experience with end year before start year (not current)", () => {
    const result = profilePayloadSchema.safeParse({
      ...minimal,
      work_experience: [
        {
          id: "we-1",
          company_name: "Acme",
          position: "Engineer",
          started_year: 2020,
          ended_year: 2010,
          is_current: false,
          responsibilities: null,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts work experience where is_current=true even with backwards years", () => {
    const result = profilePayloadSchema.safeParse({
      ...minimal,
      work_experience: [
        {
          id: "we-1",
          company_name: "Acme",
          position: "Engineer",
          started_year: 2020,
          ended_year: 2010,
          is_current: true,
          responsibilities: null,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects work experience year outside 1900-2100", () => {
    expect(
      profilePayloadSchema.safeParse({
        ...minimal,
        work_experience: [
          {
            id: "we-1",
            company_name: null,
            position: null,
            started_year: 1700,
            ended_year: null,
            is_current: false,
            responsibilities: null,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects more than 50 entries in any nested list", () => {
    const tooManyLanguages = Array.from({ length: 51 }, (_, idx) => ({
      id: `l-${idx}`,
      language_id: idx + 1,
      proficiency_level: "advanced" as const,
    }));
    expect(
      profilePayloadSchema.safeParse({ ...minimal, languages: tooManyLanguages })
        .success,
    ).toBe(false);
  });

  it("requires non-empty Q&A entries", () => {
    expect(
      profilePayloadSchema.safeParse({
        ...minimal,
        qas: [{ id: "q1", question: "", answer: "answer" }],
      }).success,
    ).toBe(false);
    expect(
      profilePayloadSchema.safeParse({
        ...minimal,
        qas: [{ id: "q1", question: "q?", answer: "" }],
      }).success,
    ).toBe(false);
  });
});

describe("profilePayloadSchema - skill_ids", () => {
  it("dedupes skill ids", () => {
    const result = profilePayloadSchema.safeParse({
      ...minimal,
      skill_ids: [1, 2, 2, 3],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.skill_ids.sort()).toEqual([1, 2, 3]);
    }
  });

  it("rejects non-positive skill ids", () => {
    expect(
      profilePayloadSchema.safeParse({ ...minimal, skill_ids: [0] }).success,
    ).toBe(false);
    expect(
      profilePayloadSchema.safeParse({ ...minimal, skill_ids: [-1] }).success,
    ).toBe(false);
  });
});
