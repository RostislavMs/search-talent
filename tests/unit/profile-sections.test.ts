import { describe, expect, it } from "vitest";
import {
  createDefaultProfileVisibility,
  createProfileCertificateEntry,
  createProfileEducationEntry,
  createProfileLanguageEntry,
  createProfileQaEntry,
  createProfileWorkExperienceEntry,
  normalizeProfileVisibility,
  profileVisibilityKeys,
  sanitizeStorageFileName,
} from "@/lib/profile-sections";

describe("createDefaultProfileVisibility", () => {
  it("returns all keys as true by default", () => {
    const vis = createDefaultProfileVisibility();

    for (const key of profileVisibilityKeys) {
      expect(vis[key]).toBe(true);
    }
  });

  it("applies overrides", () => {
    const vis = createDefaultProfileVisibility({ about: false, skills: false });

    expect(vis.about).toBe(false);
    expect(vis.skills).toBe(false);
    expect(vis.education).toBe(true);
  });
});

describe("normalizeProfileVisibility", () => {
  it("returns defaults for null/undefined/non-object", () => {
    const defaults = createDefaultProfileVisibility();

    expect(normalizeProfileVisibility(null)).toEqual(defaults);
    expect(normalizeProfileVisibility(undefined)).toEqual(defaults);
    expect(normalizeProfileVisibility("string")).toEqual(defaults);
    expect(normalizeProfileVisibility(42)).toEqual(defaults);
  });

  it("returns defaults for arrays", () => {
    const defaults = createDefaultProfileVisibility();

    expect(normalizeProfileVisibility([1, 2, 3])).toEqual(defaults);
  });

  it("applies boolean values from input", () => {
    const result = normalizeProfileVisibility({
      about: false,
      workExperience: false,
    });

    expect(result.about).toBe(false);
    expect(result.workExperience).toBe(false);
    expect(result.skills).toBe(true);
  });

  it("ignores non-boolean values", () => {
    const result = normalizeProfileVisibility({
      about: "yes",
      skills: 1,
      education: null,
    });

    expect(result.about).toBe(true);
    expect(result.skills).toBe(true);
    expect(result.education).toBe(true);
  });

  it("ignores unknown keys", () => {
    const result = normalizeProfileVisibility({
      unknownKey: false,
      about: false,
    });

    expect(result.about).toBe(false);
    expect("unknownKey" in result).toBe(false);
  });
});

describe("factory functions", () => {
  it("createProfileLanguageEntry returns a valid entry with UUID id", () => {
    const entry = createProfileLanguageEntry();

    expect(entry.id).toBeTruthy();
    expect(entry.language_id).toBeNull();
    expect(entry.proficiency_level).toBe("intermediate");
  });

  it("createProfileEducationEntry returns a valid entry", () => {
    const entry = createProfileEducationEntry();

    expect(entry.id).toBeTruthy();
    expect(entry.institution).toBe("");
    expect(entry.degree).toBe("");
    expect(entry.field_of_study).toBe("");
    expect(entry.started_on).toBe("");
    expect(entry.completed_on).toBe("");
    expect(entry.description).toBe("");
  });

  it("createProfileCertificateEntry returns a valid entry", () => {
    const entry = createProfileCertificateEntry();

    expect(entry.id).toBeTruthy();
    expect(entry.title).toBe("");
    expect(entry.issuer).toBe("");
    expect(entry.credential_url).toBe("");
    expect(entry.file_url).toBe("");
    expect(entry.storage_path).toBe("");
  });

  it("createProfileQaEntry returns a valid entry", () => {
    const entry = createProfileQaEntry();

    expect(entry.id).toBeTruthy();
    expect(entry.question).toBe("");
    expect(entry.answer).toBe("");
  });

  it("createProfileWorkExperienceEntry returns a valid entry", () => {
    const entry = createProfileWorkExperienceEntry();

    expect(entry.id).toBeTruthy();
    expect(entry.company_name).toBe("");
    expect(entry.position).toBe("");
    expect(entry.is_current).toBe(false);
  });

  it("each factory generates unique IDs", () => {
    const ids = [
      createProfileLanguageEntry().id,
      createProfileLanguageEntry().id,
      createProfileEducationEntry().id,
      createProfileQaEntry().id,
    ];

    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("sanitizeStorageFileName", () => {
  it("lowercases and trims", () => {
    expect(sanitizeStorageFileName("  MyFile.pdf  ")).toBe("myfile.pdf");
  });

  it("replaces non-word characters with dashes", () => {
    expect(sanitizeStorageFileName("hello world!@#.txt")).toBe("hello-world-.txt");
  });

  it("collapses multiple dashes", () => {
    expect(sanitizeStorageFileName("a---b.txt")).toBe("a-b.txt");
  });

  it("strips leading and trailing dashes", () => {
    expect(sanitizeStorageFileName("-file-.txt")).toBe("file-.txt");
  });

  it("normalizes unicode via NFKD", () => {
    // Accented characters are decomposed
    const result = sanitizeStorageFileName("café.png");
    expect(result).toContain("cafe");
  });
});
